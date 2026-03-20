import { NextRequest, NextResponse } from "next/server";
import { chatJSON } from "@/lib/ai/claude";
import { VALUATION_SYSTEM_PROMPT, PRICE_PER_SQM_2026 } from "@/lib/ai/prompts";
import { findComparables } from "@/lib/ai/search";

interface ValuationRequest {
  address: string;
  city: string;
  province: string;
  type: "apartment" | "house" | "villa";
  surface_sqm: number;
  rooms: number;
  floor?: number;
  year_built?: number;
  energy_class?: string;
  has_parking?: boolean;
  has_garden?: boolean;
  has_elevator?: boolean;
}

interface ValuationResponse {
  valuation_min: number;
  valuation_max: number;
  valuation_central: number;
  confidence: "high" | "medium" | "low";
  price_per_sqm: number;
  zone_average_price_sqm: number;
  positive_factors: string[];
  negative_factors: string[];
  market_trend: string;
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "Servizio AI non configurato. Contatta l'amministratore." },
        { status: 503 }
      );
    }

    const body: ValuationRequest = await request.json();

    if (!body.address || !body.city || !body.type || !body.surface_sqm) {
      return NextResponse.json(
        { error: "Campi obbligatori: address, city, type, surface_sqm" },
        { status: 400 }
      );
    }

    // Find comparable listings — don't fail if none found
    let comparables: Awaited<ReturnType<typeof findComparables>> = [];
    try {
      comparables = await findComparables({
        city: body.city,
        property_type: body.type,
        surface_sqm: body.surface_sqm,
        rooms: body.rooms,
        limit: 10,
      });
    } catch (err) {
      console.error("[valuation] Errore ricerca comparabili:", err);
    }

    // Build context for Claude
    const propertyDetails = [
      `Indirizzo: ${body.address}, ${body.city} (${body.province})`,
      `Tipo: ${body.type}`,
      `Superficie: ${body.surface_sqm} m²`,
      `Locali: ${body.rooms}`,
      body.floor != null ? `Piano: ${body.floor}` : null,
      body.year_built ? `Anno costruzione: ${body.year_built}` : null,
      body.energy_class ? `Classe energetica: ${body.energy_class}` : null,
      body.has_parking ? "Posto auto: Sì" : null,
      body.has_garden ? "Giardino: Sì" : null,
      body.has_elevator ? "Ascensore: Sì" : null,
    ]
      .filter(Boolean)
      .join("\n");

    let comparablesText: string;
    if (comparables.length > 0) {
      comparablesText = `Annunci comparabili trovati (${comparables.length}):\n${comparables
        .map(
          (c) =>
            `- "${c.title}" - €${c.price.toLocaleString("it-IT")} - ${c.surface_sqm}m² - ${c.rooms} locali - ${c.city}`
        )
        .join("\n")}`;
    } else {
      // Use hardcoded 2026 price data as fallback
      const cityKey = Object.keys(PRICE_PER_SQM_2026).find(
        (k) => k.toLowerCase() === body.city.toLowerCase()
      );
      const priceData = cityKey
        ? PRICE_PER_SQM_2026[cityKey]
        : null;

      if (priceData) {
        comparablesText =
          `Nessun annuncio comparabile trovato nel database.\n` +
          `Usa questi dati di mercato 2026 per ${body.city}:\n` +
          `- Prezzo medio/m²: €${priceData.avg}\n` +
          `- Range prezzo/m²: €${priceData.min} - €${priceData.max}\n` +
          `- Stima indicativa: €${priceData.avg * body.surface_sqm} (media) ` +
          `Range: €${priceData.min * body.surface_sqm} - €${priceData.max * body.surface_sqm}\n` +
          `Indica confidenza "medium" basandoti su dati medi di mercato.`;
      } else {
        comparablesText =
          "Nessun annuncio comparabile trovato e nessun dato di mercato disponibile per questa zona. " +
          "Effettua una stima conservativa basandoti su medie italiane generali. " +
          `Indica confidenza "low".`;
      }
    }

    const userMessage = `Valuta questo immobile:\n\n${propertyDetails}\n\n${comparablesText}`;

    const result = await chatJSON<ValuationResponse>({
      systemPrompt: VALUATION_SYSTEM_PROMPT,
      userMessage,
      maxTokens: 1500,
    });

    return NextResponse.json({
      ...result,
      comparable_listings: comparables.slice(0, 5),
    });
  } catch (err) {
    console.error("[valuation] Errore:", err);
    const message =
      err instanceof Error ? err.message : "Errore durante la valutazione";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
