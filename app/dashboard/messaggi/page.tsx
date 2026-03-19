"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

interface Conversation {
  id: string;
  buyer_name: string;
  listing_title: string;
  last_message: string;
  unread: number;
  updated_at: string;
}

interface Message {
  id: string;
  sender_role: "agent" | "buyer";
  content: string;
  created_at: string;
}

// Mock conversations until realtime is fully wired
const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: "1",
    buyer_name: "Marco Rossi",
    listing_title: "Trilocale Vomero",
    last_message: "Quando posso venire a vederlo?",
    unread: 2,
    updated_at: "2026-03-19T10:30:00",
  },
  {
    id: "2",
    buyer_name: "Anna Bianchi",
    listing_title: "Bilocale Chiaia",
    last_message: "Il prezzo è trattabile?",
    unread: 0,
    updated_at: "2026-03-18T15:20:00",
  },
];

const MOCK_MESSAGES: Message[] = [
  {
    id: "1",
    sender_role: "buyer",
    content: "Buongiorno, sono interessato a questo appartamento.",
    created_at: "2026-03-19T09:00:00",
  },
  {
    id: "2",
    sender_role: "agent",
    content: "Buongiorno! Certo, è ancora disponibile. Vuole fissare una visita?",
    created_at: "2026-03-19T09:15:00",
  },
  {
    id: "3",
    sender_role: "buyer",
    content: "Quando posso venire a vederlo?",
    created_at: "2026-03-19T10:30:00",
  },
];

export default function MessaggiPage() {
  const [conversations] = useState<Conversation[]>(MOCK_CONVERSATIONS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages] = useState<Message[]>(MOCK_MESSAGES);
  const [newMessage, setNewMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, selectedId]);

  // Setup Supabase realtime subscription
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        () => {
          // In production: reload messages for selected conversation
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim() || !selectedId) return;

    try {
      await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: selectedId,
          content: newMessage,
        }),
      });
      setNewMessage("");
    } catch {
      // Handle error
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Messaggi</h1>

      <div className="mt-6 flex h-[calc(100vh-16rem)] overflow-hidden rounded-xl border border-gray-200 bg-white">
        {/* Conversation list */}
        <div className="w-72 flex-shrink-0 overflow-y-auto border-r border-gray-200">
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => setSelectedId(conv.id)}
              className={`w-full border-b border-gray-100 p-4 text-left transition-colors ${
                selectedId === conv.id ? "bg-blue-50" : "hover:bg-gray-50"
              }`}
            >
              <div className="flex items-start justify-between">
                <p className="text-sm font-semibold text-gray-900">
                  {conv.buyer_name}
                </p>
                {conv.unread > 0 && (
                  <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-xs text-white">
                    {conv.unread}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-gray-500">
                {conv.listing_title}
              </p>
              <p className="mt-1 truncate text-xs text-gray-600">
                {conv.last_message}
              </p>
            </button>
          ))}
        </div>

        {/* Messages */}
        {selectedId ? (
          <div className="flex flex-1 flex-col">
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender_role === "agent" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm ${
                      msg.sender_role === "agent"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {msg.content}
                    <p
                      className={`mt-1 text-xs ${
                        msg.sender_role === "agent"
                          ? "text-blue-200"
                          : "text-gray-400"
                      }`}
                    >
                      {new Date(msg.created_at).toLocaleTimeString("it-IT", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <form
              onSubmit={sendMessage}
              className="flex items-center gap-2 border-t px-4 py-3"
            >
              <input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Scrivi un messaggio..."
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Invia
              </button>
            </form>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-gray-400">
            Seleziona una conversazione
          </div>
        )}
      </div>
    </div>
  );
}
