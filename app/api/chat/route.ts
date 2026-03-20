import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { streamChat } from "@/lib/ai/claude";
import { CHAT_SYSTEM_PROMPT, buildContextMessage } from "@/lib/ai/prompts";
import { semanticSearch, type SearchFilters } from "@/lib/ai/search";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  // Helper: SSE error response that always sends "done"
  function sseError(message: string) {
    const stream = new ReadableStream({
      start(controller) {
        const errorEvent = JSON.stringify({ type: "error", content: message });
        controller.enqueue(encoder.encode(`data: ${errorEvent}\n\n`));
        const doneEvent = JSON.stringify({ type: "done" });
        controller.enqueue(encoder.encode(`data: ${doneEvent}\n\n`));
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
      console.error("[chat/route] ANTHROPIC_API_KEY mancante o non configurata");
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

    let systemPrompt = CHAT_SYSTEM_PROMPT;

    // Load context if provided
    let searchFilters: SearchFilters = {};

    if (context_id || session_id) {
      const supabase = createAdminClient();

      // Try loading from chat_contexts using session_id
      if (session_id) {
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
          systemPrompt = `${CHAT_SYSTEM_PROMPT}\n\n${contextMessage}`;

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
    }

    // Try to extract the user's latest message for semantic search
    const lastUserMessage = [...messages]
      .reverse()
      .find((m: { role: string }) => m.role === "user");

    let listingsData: string = "";
    let listingsForClient: unknown[] = [];

    // Detect auto-trigger from wizard completion
    const isAutoTrigger =
      lastUserMessage?.content?.includes("Mostrami subito i migliori annunci");

    if (lastUserMessage) {
      // More results + looser filters for wizard auto-trigger
      const searchLimit = isAutoTrigger ? 8 : 5;
      const adjustedFilters = { ...searchFilters };
      if (isAutoTrigger) {
        // Widen budget ±20%
        if (adjustedFilters.price_max) {
          adjustedFilters.price_max = Math.round(adjustedFilters.price_max * 1.2);
        }
        if (adjustedFilters.price_min) {
          adjustedFilters.price_min = Math.round(adjustedFilters.price_min * 0.8);
        }
        // Widen radius +5km
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
            photos: r.photos,
            type: r.type,
            property_type: r.property_type,
            has_parking: r.has_parking,
            has_elevator: r.has_elevator,
            has_garden: r.has_garden,
            has_terrace: r.has_terrace,
            ai_reason: null,   // will be enriched by AI via LISTING_SCORES
            match_score: Math.floor(Math.random() * 15) + 82,  // initial 82-97, refined by AI
          }));

          listingsData = `\n\n[RISULTATI RICERCA - mostra questi all'utente]\n${results
            .map(
              (r, i) =>
                `${i + 1}. [ID:${r.id}] "${r.title}" - €${r.price.toLocaleString("it-IT")}${r.price_period === "month" ? "/mese" : ""} - ${r.address}, ${r.city} - ${r.surface_sqm}m² - ${r.rooms} locali - Piano ${r.floor ?? "N/D"} - ${r.property_type}${r.has_parking ? " - Posto auto" : ""}${r.has_garden ? " - Giardino" : ""}${r.has_elevator ? " - Ascensore" : ""}${r.has_terrace ? " - Terrazzo" : ""}`
            )
            .join("\n")}

ISTRUZIONI IMPORTANTI: Nella tua risposta testuale, per ogni annuncio che menzioni devi includere un blocco JSON nascosto alla fine del messaggio in questo formato esatto:
<!--LISTING_SCORES:${JSON.stringify(results.map(r => ({ id: r.id })))}-->
Il blocco deve contenere per ogni listing: "id", "match_score" (numero 0-100 basato su quanto l'annuncio corrisponde alle preferenze dell'utente), "ai_reason" (UNA frase breve, max 15 parole, che spiega perché è adatto a questo utente specifico).
Esempio: <!--LISTING_SCORES:[{"id":"abc","match_score":92,"ai_reason":"Vicino al centro con giardino e posto auto"}]-->`;
        }
      } catch {
        // Search failed — continue without listings
      }
    }

    // Build messages for Claude
    const claudeMessages = messages.map(
      (m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })
    );

    // Append listings context to the last user message
    if (listingsData && claudeMessages.length > 0) {
      const last = claudeMessages[claudeMessages.length - 1];
      if (last.role === "user") {
        last.content += listingsData;
      }
    }

    // For wizard auto-trigger, prepend instruction to start with results
    if (isAutoTrigger) {
      systemPrompt += `\n\nL'utente ha appena completato il wizard di configurazione. Inizia SUBITO con "Ecco le migliori proposte che ho trovato per te:" e presenta i risultati senza fare domande aggiuntive. Se non ci sono risultati, suggerisci di ampliare la ricerca.`;
    }

    // Create a combined stream that sends listings + Claude response
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
        // Send listings event first if we have results
        if (listingsForClient.length > 0) {
          const listingsEvent = JSON.stringify({
            type: "listings",
            data: listingsForClient,
          });
          controller.enqueue(
            encoder.encode(`data: ${listingsEvent}\n\n`)
          );
        }

        // Pipe Claude's stream
        const reader = claudeStream.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
        } catch (streamErr) {
          console.error("[chat/route] Errore durante streaming Claude:", streamErr);
          const errorEvent = JSON.stringify({
            type: "error",
            content: "Si è verificato un errore durante la generazione della risposta.",
          });
          controller.enqueue(encoder.encode(`data: ${errorEvent}\n\n`));
        } finally {
          // Always send "done" event
          const doneEvent = JSON.stringify({ type: "done" });
          controller.enqueue(encoder.encode(`data: ${doneEvent}\n\n`));
          reader.releaseLock();
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
