import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      intent,
      budget_max,
      budget_min,
      location,
      max_distance_km,
      must_have = [],
      nice_to_have = [],
      custom_note,
      who_is_searching,
      rooms_needed,
      smart_working,
    } = body;

    if (!intent || !budget_max) {
      return NextResponse.json(
        { error: "intent e budget_max sono obbligatori" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Generate a session token
    const sessionId = crypto.randomUUID();

    // Save context to chat_contexts
    const { data, error } = await supabase
      .from("chat_contexts")
      .insert({
        session_id: sessionId,
        intent,
        budget_max,
        budget_min: budget_min ?? null,
        location_lat: location?.lat ?? null,
        location_lng: location?.lng ?? null,
        location_label: location?.label ?? null,
        max_distance_km: max_distance_km ?? null,
        must_have,
        nice_to_have,
        who_is_searching: who_is_searching ?? null,
        rooms_needed: rooms_needed ?? null,
        smart_working: smart_working ?? false,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Error saving chat context:", error);
      return NextResponse.json(
        { error: "Errore nel salvataggio del contesto" },
        { status: 500 }
      );
    }

    // Also create a chat_session
    await supabase.from("chat_sessions").insert({
      session_token: sessionId,
      filters_extracted: {
        intent,
        budget_max,
        budget_min,
        location,
        max_distance_km,
        must_have,
        nice_to_have,
        custom_note,
        who_is_searching,
        rooms_needed,
        smart_working,
      },
    });

    return NextResponse.json({
      context_id: data.id,
      session_id: sessionId,
    });
  } catch {
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
