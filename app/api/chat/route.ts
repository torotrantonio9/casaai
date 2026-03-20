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

/* ─── Conversation State ─── */

interface ConversationState {
  filters: {
    city?: string;
    max_price?: number;
    min_price?: number;
    rooms_min?: number;
    has_elevator?: boolean;
    has_parking?: boolean;
    has_garden?: boolean;
    has_terrace?: boolean;
    type?: string; // sale or rent
    property_type?: string;
  };
  shown_listing_ids: string[];
  search_count: number;
  user_profile: {
    who?: string;
    rooms_needed?: number;
    priorities?: string[];
  };
}

function emptyConversationState(): ConversationState {
  return {
    filters: {},
    shown_listing_ids: [],
    search_count: 0,
    user_profile: {},
  };
}

/* ─── Intent detection ─── */

type ChatIntent =
  | "new_search"
  | "refine"
  | "show_cards"
  | "question"
  | "contact"
  | "compare";

const WANTS_NEW_LISTINGS_RE =
  /\b(mostra|cerca|trova|vedi|altri|nuov[ie]|divers[ie]|alternativ[ie]|cambia|aggiorna|ricerc[ao]|proposte|annunci|risultati|opzioni|fammi vedere|visualizza|guarda)\b/i;

const IS_QUESTION_RE =
  /\b(qual[eè]|com'è|quanto|dove|perch[eé]|dimmi|spieg|confronta|differenz|megli[oa]|consigli|consiglia|preferisci|suggeris)\b/i;

const REFS_SHOWN_RE =
  /\b(quest[ie]|ultime?|sopra|precedenti?|già mostrat[ie]|quell[ie])\b/i;

function detectIntent(
  userText: string,
  hasShownListings: boolean
): ChatIntent {
  // 'show_cards' if user references shown listings
  if (
    /\b(mostrami|fammi vedere|visualizza)\b/i.test(userText) &&
    /\b(quest[ie]|ultime?|sopra|precedenti?)\b/i.test(userText) &&
    hasShownListings
  )
    return "show_cards";
  // 'contact' if user wants to contact agency
  if (
    /\b(contatt|chiam|telefon|visit[ao]|appuntamento|agenzia)\b/i.test(
      userText
    )
  )
    return "contact";
  // 'compare' if user wants to compare
  if (
    /\b(confronta|paragona|differenz|meglio tra|versus|vs)\b/i.test(userText)
  )
    return "compare";
  // 'refine' if user adds constraints to existing search
  if (
    hasShownListings &&
    /\b(solo|filtra|con|senza|ascensore|parcheggio|giardino|terrazzo|piano|locali|budget|prezzo|meno|più)\b/i.test(
      userText
    )
  )
    return "refine";
  // 'question' if asking about shown listings
  if (
    /\b(qual[eè]|com'è|quanto|dove|perch[eé]|dimmi|spieg|confronta)\b/i.test(
      userText
    )
  )
    return "question";
  // Default: new search
  return "new_search";
}

// Keep legacy function for backward compat within the file
function detectMessageIntent(text: string): {
  wantsNewListings: boolean;
  isQuestion: boolean;
} {
  return {
    wantsNewListings: WANTS_NEW_LISTINGS_RE.test(text),
    isQuestion: IS_QUESTION_RE.test(text),
  };
}

/* ─── City extraction ─── */

const KNOWN_CITIES = [
  "napoli",
  "salerno",
  "caserta",
  "avellino",
  "benevento",
  "pozzuoli",
  "roma",
  "milano",
  "torino",
  "firenze",
  "bologna",
  "bari",
  "palermo",
  "catania",
  "genova",
  "venezia",
  "verona",
  "padova",
  "brescia",
  "modena",
  "parma",
  "reggio calabria",
  "perugia",
  "cagliari",
  "trieste",
  "livorno",
  "taranto",
  "foggia",
  "lecce",
  "latina",
  "giugliano",
  "marano",
  "torre del greco",
  "portici",
  "ercolano",
  "castellammare",
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

/* ─── Price extraction from user text ─── */

function extractPrice(text: string): { min?: number; max?: number } {
  const lower = text.toLowerCase();
  const result: { min?: number; max?: number } = {};

  // "meno di 200k", "sotto 200000", "massimo 200k"
  const maxMatch = lower.match(
    /\b(?:meno di|sotto|massimo|max|fino a|entro)\s*(?:€\s*)?(\d+)\s*(?:k|mila|\.000)?\b/
  );
  if (maxMatch) {
    let val = parseInt(maxMatch[1], 10);
    if (val < 10000 && /k|mila/i.test(maxMatch[0])) val *= 1000;
    result.max = val;
  }

  // "più di 100k", "almeno 100000", "minimo 100k"
  const minMatch = lower.match(
    /\b(?:più di|sopra|almeno|minimo|min|da)\s*(?:€\s*)?(\d+)\s*(?:k|mila|\.000)?\b/
  );
  if (minMatch) {
    let val = parseInt(minMatch[1], 10);
    if (val < 10000 && /k|mila/i.test(minMatch[0])) val *= 1000;
    result.min = val;
  }

  return result;
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

/* ─── Filter merging: accumulate new filters into existing state ─── */

function mergeFiltersFromMessage(
  state: ConversationState,
  userText: string,
  contextBudgetMax: number | null,
  contextIntent: string | null,
  contextRooms: number | null,
  contextWho: string | null
): ConversationState {
  const newState = structuredClone(state);

  // City: override if user explicitly mentions a new city
  const cityFromUser = extractCity(userText);
  if (cityFromUser) {
    newState.filters.city = cityFromUser;
  }

  // Features: accumulate (once set, stay set unless user says "senza")
  const features = extractFeatureFilters(userText);
  if (features.wantsElevator) newState.filters.has_elevator = true;
  if (features.wantsParking) newState.filters.has_parking = true;
  if (features.wantsGarden) newState.filters.has_garden = true;
  if (features.wantsTerrace) newState.filters.has_terrace = true;

  // Handle "senza" (removal of features)
  const lower = userText.toLowerCase();
  if (/\bsenza\s+ascensore\b/i.test(lower))
    newState.filters.has_elevator = false;
  if (/\bsenza\s+(?:parcheggio|posto auto|garage)\b/i.test(lower))
    newState.filters.has_parking = false;
  if (/\bsenza\s+giardino\b/i.test(lower))
    newState.filters.has_garden = false;
  if (/\bsenza\s+terrazzo\b/i.test(lower))
    newState.filters.has_terrace = false;

  // Rooms: override if user explicitly mentions
  const roomsFromUser = extractRooms(userText);
  if (roomsFromUser) {
    newState.filters.rooms_min = roomsFromUser;
  } else if (!newState.filters.rooms_min && contextRooms) {
    newState.filters.rooms_min = contextRooms;
  }

  // Price: merge from user text or context
  const priceFromUser = extractPrice(userText);
  if (priceFromUser.max) newState.filters.max_price = priceFromUser.max;
  if (priceFromUser.min) newState.filters.min_price = priceFromUser.min;
  if (!newState.filters.max_price && contextBudgetMax) {
    newState.filters.max_price = contextBudgetMax;
  }

  // Type from context
  if (contextIntent && !newState.filters.type) {
    newState.filters.type = contextIntent;
  }

  // User profile from context
  if (contextWho && !newState.user_profile.who) {
    newState.user_profile.who = contextWho;
  }
  if (contextRooms && !newState.user_profile.rooms_needed) {
    newState.user_profile.rooms_needed = contextRooms;
  }

  return newState;
}

/* ─── Suggestions generation ─── */

function generateSuggestions(
  intent: ChatIntent,
  state: ConversationState,
  listingsCount: number
): string[] {
  if (intent === "new_search" || intent === "refine") {
    if (listingsCount === 0) {
      return ["Amplia il budget", "Prova un'altra zona", "Rimuovi filtri"];
    }
    // After search with results
    const suggestions: string[] = [];
    if (!state.filters.has_elevator) suggestions.push("Filtra con ascensore");
    if (!state.filters.rooms_min) suggestions.push("Solo trilocali");
    suggestions.push("Cambia zona");
    return suggestions.slice(0, 3);
  }

  if (intent === "show_cards") {
    return ["Mostrami altri annunci", "Cerca in altra zona", "Contatta l'agenzia"];
  }

  if (intent === "question") {
    return [
      "Mostrami altri annunci",
      "Cerca in altra zona",
      "Contatta l'agenzia",
    ];
  }

  if (intent === "contact") {
    return ["Torna alla ricerca", "Mostrami altri annunci"];
  }

  if (intent === "compare") {
    return ["Vedi altri risultati", "Cambia budget", "Cerca zona diversa"];
  }

  // Default
  return ["Cerca casa", "Mostrami annunci"];
}

/* ─── Personalized system prompt based on user profile ─── */

function getProfilePromptAddition(who?: string): string {
  switch (who) {
    case "solo":
      return "\n\nL'utente cerca per sé, enfatizza praticità e comodità.";
    case "coppia":
      return "\n\nL'utente cerca per la coppia, enfatizza spazi per due e zona romantica.";
    case "famiglia":
      return "\n\nL'utente cerca per la famiglia, enfatizza vicinanza scuole, parchi, sicurezza quartiere.";
    case "investimento":
      return "\n\nL'utente investe, enfatizza rendimento, potenziale di rivalutazione, facilità di affitto.";
    default:
      return "";
  }
}

/* ─── Build FilterSet from ConversationState for scoring ─── */

function buildFilterSet(state: ConversationState): FilterSet {
  return {
    city: state.filters.city ?? null,
    wantsElevator: state.filters.has_elevator ?? false,
    wantsParking: state.filters.has_parking ?? false,
    wantsGarden: state.filters.has_garden ?? false,
    wantsTerrace: state.filters.has_terrace ?? false,
    maxBudget: state.filters.max_price ?? 300000,
    rooms: state.filters.rooms_min ?? null,
  };
}

/* ─── Main POST handler ─── */

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

    // ─── 1. Load context and conversation state ───
    let systemPrompt = SYSTEM_BASE;
    let contextIntent: string | null = null;
    let contextBudgetMax: number | null = null;
    let contextRooms: number | null = null;
    let contextWho: string | null = null;
    let conversationState: ConversationState = emptyConversationState();

    const supabase = createAdminClient();

    if (session_id) {
      try {
        // Load chat context
        const { data: ctx } = await supabase
          .from("chat_contexts")
          .select("*")
          .eq("session_id", session_id)
          .single();

        if (ctx) {
          contextIntent = ctx.intent;
          contextBudgetMax = ctx.budget_max;
          contextRooms = ctx.rooms_needed ?? null;
          contextWho = ctx.who_is_searching ?? null;
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

        // Load existing conversation state from chat_sessions
        const { data: session } = await supabase
          .from("chat_sessions")
          .select("extracted_filters")
          .eq("session_id", session_id)
          .single();

        if (session?.extracted_filters) {
          // Restore persisted state, ensuring all fields exist
          const persisted = session.extracted_filters as Partial<ConversationState>;
          conversationState = {
            filters: { ...emptyConversationState().filters, ...persisted.filters },
            shown_listing_ids: persisted.shown_listing_ids ?? [],
            search_count: persisted.search_count ?? 0,
            user_profile: { ...emptyConversationState().user_profile, ...persisted.user_profile },
          };
        }
      } catch (e) {
        console.error("[chat/route] Context/state load error:", e);
      }
    }

    // ─── 2. Parse user text and merge filters into state ───
    const lastUserMsg = [...messages]
      .reverse()
      .find((m: { role: string }) => m.role === "user");
    const userText = lastUserMsg?.content?.toLowerCase() ?? "";

    const isAutoTrigger =
      is_auto_trigger ||
      userText.includes("mostrami subito i migliori annunci");

    const hasShownListings =
      (Array.isArray(shown_listing_ids) && shown_listing_ids.length > 0) ||
      conversationState.shown_listing_ids.length > 0;
    const shownIds = [
      ...new Set([
        ...(shown_listing_ids as string[]),
        ...conversationState.shown_listing_ids,
      ]),
    ];

    // Detect intent with new expanded detection
    const intent = detectIntent(userText, hasShownListings);
    // Also keep legacy detection for backward compat in shouldSendListings logic
    const { wantsNewListings, isQuestion } = detectMessageIntent(userText);

    const isFirstSearch = isAutoTrigger || !hasShownListings;

    // BUG 3: Detect "mostrami queste 2 case" — user wants to re-see shown listings
    const wantsToSeeShown =
      /\b(mostrami|fammi vedere|vedi|guarda|visualizza)\b/i.test(userText);
    const refsShown = REFS_SHOWN_RE.test(userText);
    const wantsReshow = wantsToSeeShown && refsShown && shownIds.length > 0;

    // Decide whether to send listings
    const shouldSendListings =
      isFirstSearch ||
      wantsNewListings ||
      wantsReshow ||
      intent === "refine";

    // Merge filters from current message into conversation state
    conversationState = mergeFiltersFromMessage(
      conversationState,
      userText,
      contextBudgetMax,
      contextIntent,
      contextRooms,
      contextWho
    );

    // Build FilterSet from the accumulated state
    const currentFilters = buildFilterSet(conversationState);

    // Add personalized prompt based on user profile
    const profileAddition = getProfilePromptAddition(
      conversationState.user_profile.who
    );
    if (profileAddition) {
      systemPrompt += profileAddition;
    }

    console.log(
      `[chat/route] intent=${intent}, isFirstSearch=${isFirstSearch}, wantsNewListings=${wantsNewListings}, wantsReshow=${wantsReshow}, isQuestion=${isQuestion}, shouldSendListings=${shouldSendListings}, city=${currentFilters.city}, rooms=${currentFilters.rooms}, searchCount=${conversationState.search_count}`
    );

    // ─── 3. Search listings (only if needed) ───
    let listings: DbListing[] = [];

    if (shouldSendListings) {
      try {
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
          // Normal search with dynamic filters from accumulated state
          let query = supabase
            .from("listings")
            .select(
              "id, title, price, price_period, address, city, surface_sqm, rooms, floor, property_type, has_garden, has_parking, has_elevator, has_terrace"
            )
            .eq("status", "active")
            .lte(
              "price",
              Math.round((currentFilters.maxBudget) * 1.15)
            )
            .order("created_at", { ascending: false })
            .limit(6);

          // Apply intent/type filter
          if (conversationState.filters.type) {
            query = query.eq(
              "type",
              conversationState.filters.type === "sale" ? "sale" : "rent"
            );
          }

          // Apply city filter from accumulated state
          if (currentFilters.city) {
            query = query.ilike("city", `%${currentFilters.city}%`);
          }

          // Apply feature filters from accumulated state
          if (currentFilters.wantsElevator) {
            query = query.eq("has_elevator", true);
          }
          if (currentFilters.wantsParking) {
            query = query.eq("has_parking", true);
          }
          if (currentFilters.wantsGarden) {
            query = query.eq("has_garden", true);
          }
          if (currentFilters.wantsTerrace) {
            query = query.eq("has_terrace", true);
          }

          // Apply min price filter if set
          if (conversationState.filters.min_price) {
            query = query.gte("price", conversationState.filters.min_price);
          }

          // Exclude already-shown listings when asking for new ones
          if (wantsNewListings && shownIds.length > 0) {
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

      // Update conversation state with new shown listings and search count
      if (listings.length > 0) {
        const newShownIds = listings.map((l) => l.id);
        conversationState.shown_listing_ids = [
          ...new Set([...conversationState.shown_listing_ids, ...newShownIds]),
        ];
        conversationState.search_count += 1;
      }
    }

    console.log(
      `[chat/route] Found ${listings.length} listings to send`
    );

    // ─── 4. Save conversation state to chat_sessions ───
    if (session_id) {
      try {
        await supabase.from("chat_sessions").upsert(
          {
            session_id,
            extracted_filters: conversationState as unknown as Record<string, unknown>,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "session_id" }
        );
      } catch (e) {
        console.error("[chat/route] State save error:", e);
      }
    }

    // ─── 5. Build Claude messages ───
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
      if (currentFilters.city) appliedFilters.push(`città: ${currentFilters.city}`);
      if (currentFilters.wantsElevator) appliedFilters.push("ascensore");
      if (currentFilters.wantsParking) appliedFilters.push("posto auto");
      if (currentFilters.wantsGarden) appliedFilters.push("giardino");
      if (currentFilters.wantsTerrace) appliedFilters.push("terrazzo");
      if (currentFilters.rooms) appliedFilters.push(`${currentFilters.rooms} locali`);
      appliedFilters.push(
        `budget max €${currentFilters.maxBudget.toLocaleString("it-IT")}`
      );

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

    // ─── 6. Create SSE stream ───
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

          // STEP C: send contextual suggestions
          const suggestions = generateSuggestions(
            intent,
            conversationState,
            listings.length
          );
          if (suggestions.length > 0) {
            send(controller, { type: "suggestions", data: suggestions });
          }

          // STEP D: done
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
