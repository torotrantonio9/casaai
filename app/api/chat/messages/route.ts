import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get("conversation_id");

  if (!conversationId) {
    return NextResponse.json(
      { error: "conversation_id è obbligatorio" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // Fetch messages from chat_sessions
  const { data } = await supabase
    .from("chat_sessions")
    .select("messages")
    .eq("id", conversationId)
    .single();

  return NextResponse.json({ messages: data?.messages ?? [] });
}

export async function POST(request: NextRequest) {
  try {
    const { conversation_id, content } = await request.json();

    if (!conversation_id || !content) {
      return NextResponse.json(
        { error: "conversation_id e content sono obbligatori" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Append message to chat_sessions.messages JSONB array
    const { data: session } = await supabase
      .from("chat_sessions")
      .select("messages")
      .eq("id", conversation_id)
      .single();

    const existingMessages = (session?.messages as unknown[]) ?? [];
    const newMessage = {
      role: "agent",
      content,
      timestamp: new Date().toISOString(),
    };

    await supabase
      .from("chat_sessions")
      .update({ messages: [...existingMessages, newMessage] })
      .eq("id", conversation_id);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
