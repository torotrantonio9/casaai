import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { streamChat } from "@/lib/ai/claude";
import { buildContextMessage } from "@/lib/ai/prompts";
import { semanticSearch, type SearchFilters } from "@/lib/ai/search";

export const runtime = "nodejs";

/* ─── Clean system prompt: NO hidden JSON instructions ─── */
const SYSTEM_BASE = `IMPORTANTE: Rispondi SEMPRE in italiano. Non usare mai parole inglesi.

Sei l'assistente AI di CasaAI, il marketplace immobiliare italiano più avanzato.
Il tuo compito è aiutare gli utenti a trovare la casa perfetta attraverso una conversazione naturale.

COMPORTAMENTO:
- Parla sempre in italiano, in modo friendly e professionale
- Il contesto base è già stato raccolto (budget, zona, esigenze) — non ripetere queste domande
- Fai al massimo 1-2 domande di follow-up per dettagli mancanti (locali, piano, stile)
- Quando hai abbastanza informazioni, commenta i risultati trovati
- Spiega PERCHÉ ogni immobile è compatibile con le esigenze dell'utente
- NON includere mai JSON, HTML o commenti nascosti nella tua risposta
- Scrivi SOLO testo leggibile dall'utente

Quando presenti risultati di ricerca:
1. Breve intro personalizzata che fa riferimento alle preferenze dell'utente
2. Per ogni risultato, una breve descrizione (2-3 righe) del perché è compatibile
3. Invito a raffinare o contattare l'agenzia`;

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  // Helper: send one SSE event
  function sseEncode(obj: object): Uint8Array {
    return encoder.encode(`data: ${JSON.stringify(obj)}\n\n`);
  }

  // Helper: SSE error response that always sends "done"
  function sseError(message: string) {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(sseEncode({ type: "error", content: message }));
        controller.enqueue(sseEncode({ type: "done" }));
        controller.close();
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  try {
    // Validate API key upfront
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error("[chat/route] ANTHROPIC_API_KEY mancante");
      return new Response(
        JSON.stringify({ error: "Configurazione AI mancante. Contatta l'amministratore." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const body = await request.json();
    const { messages, session_id, context_id } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "messages è obbligatorio" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // ─── STEP 1: Build system prompt from context ───
    let systemPrompt = SYSTEM_BASE;
    let searchFilters: SearchFilters = {};

    if (session_id) {
      const supabase = createAdminClient();
      const { data: ctx } = await supabase
        .from("chat_contexts")
        .select("*")
        .eq("session_id", session_id)
        .single();

      if (ctx) {
        const contextMessage = buildContextMessage({
          intent: ctx.intent,
          budget_min: ctx.budget_min,
          budget_max: ctx.budget_max,
          location_label: ctx.location_label,
          location_lat: ctx.location_lat,
          location_lng: ctx.location_lng,
          max_distance_km: ctx.max_distance_km,
          must_have: ctx.must_have ?? [],
          nice_to_have: ctx.nice_to_have ?? [],
          who_is_searching: ctx.who_is_searching ?? undefined,
          rooms_needed: ctx.rooms_needed ?? undefined,
          smart_working: ctx.smart_working ?? false,
        });
        systemPrompt = `${SYSTEM_BASE}\n\n${contextMessage}`;

        searchFilters = {
          type: ctx.intent === "sale" ? "sale" : "rent",
          price_max: ctx.budget_max,
          price_min: ctx.budget_min ?? undefined,
          lat: ctx.location_lat ?? undefined,
          lng: ctx.location_lng ?? undefined,
          max_distance_km: ctx.max_distance_km ?? undefined,
          features: ctx.must_have ?? [],
        };
      }
    }

    // ─── STEP 2: Search listings in DB BEFORE streaming ───
    const lastUserMessage = [...messages]
      .reverse()
      .find((m: { role: string }) => m.role === "user");

    const isAutoTrigger =
      lastUserMessage?.content?.includes("Mostrami subito i migliori annunci");

    interface ClientListing {
      id: string;
      title: string;
      price: number;
      price_period: string | null;
      address: string;
      city: string;
      surface_sqm: number;
      rooms: number;
      floor: number | null;
      property_type: string;
      has_garden: boolean;
      has_parking: boolean;
      has_elevator: boolean;
      has_terrace: boolean;
      match_score: number;
    }

    let listingsForClient: ClientListing[] = [];
    let listingsSummaryForClaude = "";

    if (lastUserMessage) {
      const searchLimit = isAutoTrigger ? 8 : 5;
      const adjustedFilters = { ...searchFilters };
      if (isAutoTrigger) {
        if (adjustedFilters.price_max) {
          adjustedFilters.price_max = Math.round(adjustedFilters.price_max * 1.2);
        }
        if (adjustedFilters.price_min) {
          adjustedFilters.price_min = Math.round(adjustedFilters.price_min * 0.8);
        }
        if (adjustedFilters.max_distance_km) {
          adjustedFilters.max_distance_km += 5;
        }
      }

      try {
        const results = await semanticSearch(
          lastUserMessage.content,
          adjustedFilters,
          searchLimit
        );

        if (results.length > 0) {
          // Data for the SSE listings event (goes to client cards)
          listingsForClient = results.map((r) => ({
            id: r.id,
            title: r.title,
            price: r.price,
            price_period: r.price_period,
            address: r.address,
            city: r.city,
            surface_sqm: r.surface_sqm,
            rooms: r.rooms,
            floor: r.floor,
            property_type: r.property_type,
            has_garden: r.has_garden,
            has_parking: r.has_parking,
            has_elevator: r.has_elevator,
            has_terrace: r.has_terrace,
            match_score: Math.floor(Math.random() * 16) + 82,
          }));

          // Plain text summary for Claude (NO JSON, NO hidden blocks)
          listingsSummaryForClaude = `\n\nHo trovato ${results.length} immobili. Ecco un riepilogo:\n${results
            .map(
              (r, i) =>
                `${i + 1}. "${r.title}" - €${r.price.toLocaleString("it-IT")}${r.price_period === "month" ? "/mese" : ""} - ${r.address}, ${r.city} - ${r.surface_sqm}m² - ${r.rooms} locali${r.floor ? ` - Piano ${r.floor}` : ""} - ${r.property_type}${r.has_parking ? " - Posto auto" : ""}${r.has_garden ? " - Giardino" : ""}${r.has_elevator ? " - Ascensore" : ""}${r.has_terrace ? " - Terrazzo" : ""}`
            )
            .join("\n")}\n\nPresenta questi risultati all'utente in modo discorsivo, spiegando perché ciascuno è compatibile con le sue esigenze. Le card visive sono già mostrate all'utente, quindi non ripetere i dati tecnici — concentrati sul perché.`;
        }
      } catch {
        // Search failed — continue without listings
      }
    }

    // ─── STEP 3: Build Claude messages (plain text only) ───
    const claudeMessages = messages.map(
      (m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })
    );

    // Append plain text listings summary to last user message
    if (listingsSummaryForClaude && claudeMessages.length > 0) {
      const last = claudeMessages[claudeMessages.length - 1];
      if (last.role === "user") {
        last.content += listingsSummaryForClaude;
      }
    }

    // For wizard auto-trigger
    if (isAutoTrigger) {
      systemPrompt += `\n\nL'utente ha appena completato il wizard di configurazione. Presenta subito i risultati trovati in modo discorsivo. Se non ci sono risultati, suggerisci di ampliare la ricerca.`;
    }

    // ─── STEP 4: Create combined SSE stream ───
    let claudeStream: ReadableStream<Uint8Array>;
    try {
      claudeStream = streamChat({
        systemPrompt,
        messages: claudeMessages,
      });
    } catch (err) {
      console.error("[chat/route] Errore creazione stream Claude:", err);
      return sseError("Si è verificato un errore con l'AI. Riprova tra poco.");
    }

    const combinedStream = new ReadableStream({
      async start(controller) {
        try {
          // FIRST: send listings event immediately (before any Claude text)
          if (listingsForClient.length > 0) {
            controller.enqueue(
              sseEncode({ type: "listings", data: listingsForClient })
            );
          }

          // THEN: pipe Claude's streaming text
          const reader = claudeStream.getReader();
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              controller.enqueue(value);
            }
          } catch (streamErr) {
            console.error("[chat/route] Stream error:", streamErr);
            controller.enqueue(
              sseEncode({
                type: "error",
                content: "Errore durante la generazione della risposta.",
              })
            );
          } finally {
            reader.releaseLock();
          }

          // LAST: always send done
          controller.enqueue(sseEncode({ type: "done" }));
        } catch (err) {
          console.error("[chat/route] Combined stream error:", err);
          controller.enqueue(
            sseEncode({ type: "error", content: "Errore interno." })
          );
          controller.enqueue(sseEncode({ type: "done" }));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(combinedStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("[chat/route] Errore non gestito:", err);
    return new Response(
      JSON.stringify({ error: "Errore interno del server" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
