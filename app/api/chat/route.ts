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

    if (lastUserMessage) {
      try {
        const results = await semanticSearch(
          lastUserMessage.content,
          searchFilters,
          5
        );

        if (results.length > 0) {
          listingsForClient = results.map((r) => ({
            id: r.id,
            title: r.title,
            price: r.price,
            city: r.city,
            surface_sqm: r.surface_sqm,
            rooms: r.rooms,
            photos: r.photos,
            type: r.type,
          }));

          listingsData = `\n\n[RISULTATI RICERCA - mostra questi all'utente]\n${results
            .map(
              (r, i) =>
                `${i + 1}. "${r.title}" - €${r.price.toLocaleString("it-IT")} - ${r.city} - ${r.surface_sqm}m² - ${r.rooms} locali - ${r.property_type}${r.has_parking ? " - Posto auto" : ""}${r.has_garden ? " - Giardino" : ""}${r.has_elevator ? " - Ascensore" : ""}${r.has_terrace ? " - Terrazzo" : ""}`
            )
            .join("\n")}`;
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
