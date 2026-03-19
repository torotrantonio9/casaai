import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Non autenticato" },
        { status: 401 }
      );
    }

    // Fetch all user data
    const [profile, savedSearches, savedListings, chatSessions, leads] =
      await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase
          .from("saved_searches")
          .select("*")
          .eq("user_id", user.id),
        supabase
          .from("saved_listings")
          .select("*")
          .eq("user_id", user.id),
        supabase
          .from("chat_sessions")
          .select("*")
          .eq("user_id", user.id),
        supabase
          .from("leads")
          .select("*")
          .eq("buyer_id", user.id),
      ]);

    const exportData = {
      exported_at: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
      },
      profile: profile.data,
      saved_searches: savedSearches.data ?? [],
      saved_listings: savedListings.data ?? [],
      chat_sessions: chatSessions.data ?? [],
      leads_submitted: leads.data ?? [],
    };

    return NextResponse.json(exportData);
  } catch {
    return NextResponse.json(
      { error: "Errore nell'esportazione" },
      { status: 500 }
    );
  }
}
