import { NextRequest, NextResponse } from "next/server";
import { chatJSON } from "@/lib/ai/claude";
import { LEAD_SCORING_PROMPT } from "@/lib/ai/prompts";
import { createAdminClient } from "@/lib/supabase/admin";

interface ScoreResult {
  score: number;
  reason: string;
  priority: "high" | "medium" | "low";
}

export async function POST(request: NextRequest) {
  try {
    const { lead_id, listing_id, message, buyer_profile } =
      await request.json();

    if (!lead_id || !message) {
      return NextResponse.json(
        { error: "lead_id e message sono obbligatori" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Fetch listing info for context
    let listingContext = "";
    if (listing_id) {
      const { data: listing } = await supabase
        .from("listings")
        .select("title, price, city, type, property_type, rooms, surface_sqm")
        .eq("id", listing_id)
        .single();

      if (listing) {
        listingContext = `\nANNUNCIO: "${listing.title}" - €${listing.price} - ${listing.city} - ${listing.type} - ${listing.property_type} - ${listing.rooms} locali - ${listing.surface_sqm}m²`;
      }
    }

    const buyerContext = buyer_profile
      ? `\nPROFILO BUYER: ${JSON.stringify(buyer_profile)}`
      : "";

    const userMessage = `MESSAGGIO DEL LEAD:\n"${message}"${listingContext}${buyerContext}\n\nOra/data richiesta: ${new Date().toLocaleString("it-IT")}`;

    const result = await chatJSON<ScoreResult>({
      systemPrompt: LEAD_SCORING_PROMPT,
      userMessage,
      maxTokens: 300,
    });

    // Update lead with score
    await supabase
      .from("leads")
      .update({
        ai_score: result.score,
        ai_score_reason: result.reason,
      })
      .eq("id", lead_id);

    return NextResponse.json(result);
  } catch (err) {
    console.error("Score lead error:", err);
    return NextResponse.json(
      { error: "Errore nel lead scoring" },
      { status: 500 }
    );
  }
}
