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

/* ─── Intent detection helpers ─── */

const WANTS_NEW_LISTINGS_RE =
  /\b(mostra|cerca|trova|vedi|altri|nuov[ie]|divers[ie]|alternativ[ie]|cambia|aggiorna|ricerc[ao]|proposte|annunci|risultati|opzioni|fammi vedere|visualizza|guarda)\b/i;

const IS_QUESTION_RE =
  /\b(qual[eè]|com'è|quanto|dove|perch[eé]|dimmi|spieg|confronta|differenz|megli[oa]|consigli|consiglia|preferisci|suggeris)\b/i;

const REFS_SHOWN_RE =
  /\b(quest[ie]|ultime?|sopra|precedenti?|già mostrat[ie]|quell[ie])\b/i;

/* ─── City extraction ─── */

const KNOWN_CITIES = [
  "napoli", "salerno", "caserta", "avellino", "benevento",
  "pozzuoli", "roma", "milano", "torino", "firenze", "bologna",
  "bari", "palermo", "catania", "genova", "venezia", "verona",
  "padova", "brescia", "modena", "parma", "reggio calabria",
  "perugia", "cagliari", "trieste", "livorno", "taranto",
  "foggia", "lecce", "latina", "giugliano", "marano",
  "torre del greco", "portici", "ercolano", "castellammare",
];

function extractCity(text: string): string | null {
  const lower = text.toLowerCase();
  // Check longest city names first to avoid partial matches
  const sorted = [...KNOWN_CITIES].sort((a, b) => b.length - a.length);
  for (const city of sorted) {
    if (lower.includes(city)) {
      return city.charAt(0).toUpperCase() + city.slice(1);
    }
  }
  return null;
}

/* ─── Feature extraction ─── */

function extractFeatureFilters(text: string) {
  const lower = text.toLowerCase();
  return {
    wantsElevator: /\b(ascensore|elevator)\b/i.test(lower),
    wantsParking: /\b(parcheggio|posto auto|garage|box auto)\b/i.test(lower),
    wantsGarden: /\b(giardino|garden|verde privato)\b/i.test(lower),
    wantsTerrace: /\b(terrazzo|terrazza|balcone grande)\b/i.test(lower),
  };
}

/* ─── Rooms extraction ─── */

function extractRooms(text: string): number | null {
  const lower = text.toLowerCase();
  if (/\bmonolocale\b/.test(lower)) return 1;
  if (/\bbilocale\b/.test(lower)) return 2;
  if (/\btrilocale\b/.test(lower)) return 3;
  if (/\bquadrilocale\b/.test(lower)) return 4;
  const match = lower.match(/\b(\d)\s*(?:locali|stanze|vani|camere)\b/);
  if (match) return parseInt(match[1], 10);
  return null;
}

/* ─── Match score calculation ─── */

interface FilterSet {
  city?: string | null;
  wantsElevator: boolean;
  wantsParking: boolean;
  wantsGarden: boolean;
  wantsTerrace: boolean;
  maxBudget: number;
  rooms?: number | null;
}

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

function calculateMatchScore(listing: DbListing, filters: FilterSet): number {
  let score = 100;

  // Price penalty
  const priceDiff = (listing.price - filters.maxBudget) / filters.maxBudget;
  if (priceDiff > 0) score -= Math.min(30, priceDiff * 100);

  // Feature penalties
  if (filters.wantsElevator && !listing.has_elevator) score -= 20;
  if (filters.wantsParking && !listing.has_parking) score -= 15;
  if (filters.wantsGarden && !listing.has_garden) score -= 15;
  if (filters.wantsTerrace && !listing.has_terrace) score -= 10;

  // Room mismatch penalty
  if (filters.rooms && listing.rooms !== filters.rooms) {
    score -= Math.abs(listing.rooms - filters.rooms) * 8;
  }

  // City mismatch penalty
  if (
    filters.city &&
    listing.city.toLowerCase() !== filters.city.toLowerCase()
  ) {
    score -= 25;
  }

  return Math.max(40, Math.min(99, Math.round(score)));
}

function generateAiReason(listing: DbListing, filters: FilterSet): string {
  const reasons: string[] = [];

  if (
    filters.city &&
    listing.city.toLowerCase() === filters.city.toLowerCase()
  ) {
    reasons.push(`In ${listing.city}`);
  }
  if (listing.price <= filters.maxBudget) {
    reasons.push(
      `nel budget (€${listing.price >= 1000 ? (listing.price / 1000).toFixed(0) + "k" : listing.price})`
    );
  }
  if (filters.wantsElevator && listing.has_elevator) {
    reasons.push("con ascensore");
  }
  if (filters.wantsParking && listing.has_parking) {
    reasons.push("con posto auto");
  }
  if (filters.wantsGarden && listing.has_garden) {
    reasons.push("con giardino");
  }
  if (filters.wantsTerrace && listing.has_terrace) {
    reasons.push("con terrazzo");
  }
  if (filters.rooms && listing.rooms === filters.rooms) {
    reasons.push(`${listing.rooms} locali come richiesto`);
  }

  if (reasons.length > 0) {
    return reasons.join(", ") + ".";
  }
  return `${listing.rooms} locali, ${listing.surface_sqm}m² a ${listing.city}.`;
}

function detectMessageIntent(text: string): {
  wantsNewListings: boolean;
  isQuestion: boolean;
} {
  return {
    wantsNewListings: WANTS_NEW_LISTINGS_RE.test(text),
    isQuestion: IS_QUESTION_RE.test(text),
  };
}

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
    const {
      messages,
      session_id,
      is_auto_trigger = false,
      shown_listing_ids = [],
    } = body;

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
    let contextRooms: number | null = null;

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
          contextRooms = ctx.rooms_needed ?? null;
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

    // ─── 2. Parse user text for filters ───
    const lastUserMsg = [...messages]
      .reverse()
      .find((m: { role: string }) => m.role === "user");
    const userText = lastUserMsg?.content?.toLowerCase() ?? "";
    const allText = messages
      .map((m: { content?: string }) => m.content || "")
      .join(" ")
      .toLowerCase();

    const isAutoTrigger =
      is_auto_trigger ||
      userText.includes("mostrami subito i migliori annunci");

    const hasShownListings =
      Array.isArray(shown_listing_ids) && shown_listing_ids.length > 0;
    const shownIds = (shown_listing_ids as string[]) || [];

    const isFirstSearch = isAutoTrigger || !hasShownListings;

    const { wantsNewListings, isQuestion } = detectMessageIntent(userText);

    // BUG 3: Detect "mostrami queste 2 case" — user wants to re-see shown listings
    const wantsToSeeShown =
      /\b(mostrami|fammi vedere|vedi|guarda|visualizza)\b/i.test(userText);
    const refsShown = REFS_SHOWN_RE.test(userText);
    const wantsReshow = wantsToSeeShown && refsShown && shownIds.length > 0;

    // Decide whether to send listings
    const shouldSendListings = isFirstSearch || wantsNewListings || wantsReshow;

    // Extract filters from conversation text
    const cityFromUser = extractCity(userText);
    const cityFromAll = extractCity(allText);
    const cityFilter = cityFromUser ?? cityFromAll ?? null;

    const featureFilters = extractFeatureFilters(allText);
    const roomsFromUser = extractRooms(userText);
    const roomsFilter = roomsFromUser ?? contextRooms ?? null;

    const maxBudget = contextBudgetMax ?? 300000;

    const currentFilters: FilterSet = {
      city: cityFilter,
      ...featureFilters,
      maxBudget,
      rooms: roomsFilter,
    };

    console.log(
      `[chat/route] isFirstSearch=${isFirstSearch}, wantsNewListings=${wantsNewListings}, wantsReshow=${wantsReshow}, isQuestion=${isQuestion}, shouldSendListings=${shouldSendListings}, city=${cityFilter}, rooms=${roomsFilter}`
    );

    // ─── 3. Search listings (only if needed) ───
    let listings: DbListing[] = [];

    if (shouldSendListings) {
      try {
        const supabase = createAdminClient();

        // BUG 3: Re-show already-shown listings
        if (wantsReshow && !wantsNewListings) {
          // Parse how many the user wants (default to last 2)
          const countMatch = userText.match(/\b(\d+)\b/);
          const wantedCount = countMatch ? parseInt(countMatch[1], 10) : 2;
          const idsToShow = shownIds.slice(-wantedCount);

          const { data: reshowData } = await supabase
            .from("listings")
            .select(
              "id, title, price, price_period, address, city, surface_sqm, rooms, floor, property_type, has_garden, has_parking, has_elevator, has_terrace"
            )
            .in("id", idsToShow);

          listings = (reshowData ?? []) as DbListing[];
        } else {
          // Normal search with dynamic filters (BUG 1 fix)
          let query = supabase
            .from("listings")
            .select(
              "id, title, price, price_period, address, city, surface_sqm, rooms, floor, property_type, has_garden, has_parking, has_elevator, has_terrace"
            )
            .eq("status", "active")
            .lte("price", Math.round(maxBudget * 1.15))
            .order("created_at", { ascending: false })
            .limit(6);

          // Apply intent filter
          if (contextIntent) {
            query = query.eq(
              "type",
              contextIntent === "sale" ? "sale" : "rent"
            );
          }

          // Apply city filter from user text
          if (cityFilter) {
            query = query.ilike("city", `%${cityFilter}%`);
          }

          // Apply feature filters from user text
          if (featureFilters.wantsElevator) {
            query = query.eq("has_elevator", true);
          }
          if (featureFilters.wantsParking) {
            query = query.eq("has_parking", true);
          }
          if (featureFilters.wantsGarden) {
            query = query.eq("has_garden", true);
          }
          if (featureFilters.wantsTerrace) {
            query = query.eq("has_terrace", true);
          }

          // Exclude already-shown listings when asking for new ones
          if (wantsNewListings && hasShownListings) {
            query = query.not(
              "id",
              "in",
              `(${shownIds.map((id) => `${id}`).join(",")})`
            );
          }

          const { data, error } = await query;

          if (error) {
            console.error("[chat/route] DB query error:", error.message);
            // Fallback without filters
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
        }
      } catch (e) {
        console.error("[chat/route] Listings search error:", e);
      }
    }

    console.log(
      `[chat/route] Found ${listings.length} listings to send`
    );

    // ─── 4. Build Claude messages ───
    const claudeMessages = messages.map(
      (m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content || "...",
      })
    );

    // Give Claude context about listings
    if (shouldSendListings && listings.length > 0) {
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
    } else if (shouldSendListings && listings.length === 0) {
      // BUG 5: No results — tell Claude to explain and suggest alternatives
      const appliedFilters: string[] = [];
      if (cityFilter) appliedFilters.push(`città: ${cityFilter}`);
      if (featureFilters.wantsElevator) appliedFilters.push("ascensore");
      if (featureFilters.wantsParking) appliedFilters.push("posto auto");
      if (featureFilters.wantsGarden) appliedFilters.push("giardino");
      if (featureFilters.wantsTerrace) appliedFilters.push("terrazzo");
      if (roomsFilter) appliedFilters.push(`${roomsFilter} locali`);
      appliedFilters.push(`budget max €${maxBudget.toLocaleString("it-IT")}`);

      const filterSummary = appliedFilters.join(", ");

      const lastMsg = claudeMessages[claudeMessages.length - 1];
      if (lastMsg?.role === "user") {
        lastMsg.content += `\n\n[La ricerca con filtri (${filterSummary}) ha restituito 0 risultati. NON mostrare card. Spiega all'utente che non ci sono annunci con questi criteri e suggerisci di allargare la ricerca (es. rimuovere un filtro, ampliare il budget, provare un'altra zona).]`;
      }
    } else if (!shouldSendListings && hasShownListings) {
      // Follow-up: remind Claude what listings were already shown
      systemPrompt +=
        `\n\n[CONTESTO FOLLOW-UP: L'utente ha già visto ${shownIds.length} annunci nelle card sopra. ` +
        `Non ripresentarli. Rispondi alla domanda dell'utente facendo riferimento agli annunci già mostrati se pertinente. ` +
        `Se l'utente chiede dettagli su un annuncio specifico, aiutalo. ` +
        `Se vuole nuovi risultati, suggerisci di chiedere "mostrami altri annunci" o di cambiare i criteri.]`;
    }

    if (isAutoTrigger) {
      systemPrompt +=
        "\n\nL'utente ha appena completato il wizard. Presenta subito i risultati trovati. Se non ci sono risultati, suggerisci di ampliare la ricerca.";
    }

    // ─── 5. Create SSE stream ───
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // STEP A: send listings event FIRST (only if needed and we have results)
          if (shouldSendListings && listings.length > 0) {
            // BUG 2 fix: calculate real match_score and ai_reason
            const scoredListings = listings
              .map((l) => ({
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
                match_score: calculateMatchScore(l, currentFilters),
                ai_reason: generateAiReason(l, currentFilters),
              }))
              .sort((a, b) => b.match_score - a.match_score);

            send(controller, {
              type: "listings",
              data: scoredListings,
            });
          }
          // BUG 5: if shouldSendListings but 0 results, don't send listings event at all

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
