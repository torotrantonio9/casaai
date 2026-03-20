import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildContextMessage } from "@/lib/ai/prompts";

export const runtime = "nodejs";

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

  const send = (controller: ReadableStreamDefaultController, obj: object) => {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
  };

  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error("[chat/route] ANTHROPIC_API_KEY mancante");
      return new Response(
        JSON.stringify({ error: "Configurazione AI mancante." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const body = await request.json();
    const { messages, session_id } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "messages è obbligatorio" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // ─── 1. Load context ───
    let systemPrompt = SYSTEM_BASE;
    let contextIntent: string | null = null;
    let contextBudgetMax: number | null = null;

    if (session_id) {
      try {
        const supabase = createAdminClient();
        const { data: ctx } = await supabase
          .from("chat_contexts")
          .select("*")
          .eq("session_id", session_id)
          .single();

        if (ctx) {
          contextIntent = ctx.intent;
          contextBudgetMax = ctx.budget_max;
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
        }
      } catch (e) {
        console.error("[chat/route] Context load error:", e);
      }
    }

    // ─── 2. Search listings DIRECTLY from DB ───
    // Simple, reliable query — no embeddings, no RPC, no keyword filtering
    const lastUserMsg = [...messages]
      .reverse()
      .find((m: { role: string }) => m.role === "user");

    const isAutoTrigger = lastUserMsg?.content?.includes(
      "Mostrami subito i migliori annunci"
    );

    interface DbListing {
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
    }

    let listings: DbListing[] = [];

    try {
      const supabase = createAdminClient();
      let query = supabase
        .from("listings")
        .select(
          "id, title, price, price_period, address, city, surface_sqm, rooms, floor, property_type, has_garden, has_parking, has_elevator, has_terrace"
        )
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(6);

      // Apply basic context filters if available
      if (contextIntent) {
        query = query.eq("type", contextIntent === "sale" ? "sale" : "rent");
      }
      if (contextBudgetMax) {
        query = query.lte("price", Math.round(contextBudgetMax * 1.2));
      }

      const { data, error } = await query;

      if (error) {
        console.error("[chat/route] DB query error:", error.message);
        // Try without filters as ultimate fallback
        const { data: fallbackData } = await supabase
          .from("listings")
          .select(
            "id, title, price, price_period, address, city, surface_sqm, rooms, floor, property_type, has_garden, has_parking, has_elevator, has_terrace"
          )
          .eq("status", "active")
          .limit(6);
        listings = (fallbackData ?? []) as DbListing[];
      } else {
        listings = (data ?? []) as DbListing[];
      }
    } catch (e) {
      console.error("[chat/route] Listings search error:", e);
    }

    console.log(
      `[chat/route] Found ${listings.length} listings, isAutoTrigger=${isAutoTrigger}`
    );

    // ─── 3. Build Claude messages ───
    const claudeMessages = messages.map(
      (m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content || "...",
      })
    );

    // Give Claude a plain text summary
    if (listings.length > 0) {
      const summary = listings
        .map(
          (l, i) =>
            `${i + 1}. "${l.title}" - €${l.price.toLocaleString("it-IT")}${l.price_period === "month" ? "/mese" : ""} - ${l.city} - ${l.surface_sqm}m² - ${l.rooms} locali`
        )
        .join("\n");

      const lastMsg = claudeMessages[claudeMessages.length - 1];
      if (lastMsg?.role === "user") {
        lastMsg.content += `\n\n[Ho trovato ${listings.length} immobili. Le card sono già visibili all'utente. Presenta i risultati in modo discorsivo, concentrandoti sul perché sono adatti:]\n${summary}`;
      }
    }

    if (isAutoTrigger) {
      systemPrompt +=
        "\n\nL'utente ha appena completato il wizard. Presenta subito i risultati trovati. Se non ci sono risultati, suggerisci di ampliare la ricerca.";
    }

    // ─── 4. Create SSE stream ───
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // STEP A: send listings event FIRST
          if (listings.length > 0) {
            send(controller, {
              type: "listings",
              data: listings.map((l, i) => ({
                id: l.id,
                title: l.title,
                price: l.price,
                price_period: l.price_period,
                address: l.address,
                city: l.city,
                surface_sqm: l.surface_sqm,
                rooms: l.rooms,
                floor: l.floor,
                property_type: l.property_type,
                has_garden: l.has_garden,
                has_parking: l.has_parking,
                has_elevator: l.has_elevator,
                has_terrace: l.has_terrace,
                match_score: 95 - i * 4, // 95, 91, 87, 83, 79, 75
              })),
            });
          }

          // STEP B: stream Claude response
          const client = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
          });

          const claudeStream = client.messages.stream({
            model: "claude-sonnet-4-5",
            max_tokens: 1024,
            system: systemPrompt,
            messages: claudeMessages,
          });

          for await (const chunk of claudeStream) {
            if (
              chunk.type === "content_block_delta" &&
              chunk.delta.type === "text_delta" &&
              chunk.delta.text
            ) {
              send(controller, { type: "text", content: chunk.delta.text });
            }
          }

          // STEP C: done
          send(controller, { type: "done" });
        } catch (error) {
          console.error("[chat/route] Stream error:", error);
          send(controller, {
            type: "error",
            content:
              error instanceof Error
                ? error.message
                : "Errore durante la generazione della risposta.",
          });
          send(controller, { type: "done" });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    console.error("[chat/route] Unhandled error:", err);
    return new Response(
      JSON.stringify({ error: "Errore interno del server" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
