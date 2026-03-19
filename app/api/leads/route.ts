import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      listing_id,
      buyer_name,
      buyer_email,
      buyer_phone,
      message,
      source = "contact_form",
    } = body;

    if (!listing_id || !message) {
      return NextResponse.json(
        { error: "listing_id e message sono obbligatori" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Get listing to find agency_id
    const { data: listing } = await supabase
      .from("listings")
      .select("agency_id")
      .eq("id", listing_id)
      .single();

    const lead = {
      listing_id,
      agency_id: listing?.agency_id ?? null,
      buyer_name,
      buyer_email,
      buyer_phone,
      message,
      source,
      status: "new",
    };

    const { data, error } = await supabase
      .from("leads")
      .insert(lead)
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Trigger AI scoring asynchronously
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    fetch(`${baseUrl}/api/ai/score-lead`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lead_id: data.id,
        listing_id,
        message,
      }),
    }).catch(() => {
      // Fire-and-forget: scoring failure shouldn't block lead creation
    });

    // Increment leads_count on listing
    try {
      await supabase.rpc("increment_leads_count", {
        listing_id_param: listing_id,
      });
    } catch {
      // If RPC doesn't exist yet, ignore
    }

    return NextResponse.json({ id: data.id, status: "new" }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
