"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ChatMessages, type ChatMessage, type ListingCard } from "./ChatMessages";

interface Props {
  sessionId: string | null;
  contextId: string | null;
  welcomeMessage?: string;
}

export function ChatWidget({ sessionId, contextId, welcomeMessage }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (welcomeMessage) {
      return [{ role: "assistant", content: welcomeMessage }];
    }
    return [
      {
        role: "assistant",
        content:
          "Ciao! Sono l'assistente AI di CasaAI. Dimmi come vorresti vivere e ti aiuterò a trovare la casa perfetta.",
      },
    ];
  });
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [listings, setListings] = useState<ListingCard[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingText, scrollToBottom]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isStreaming) return;

    const userMessage: ChatMessage = { role: "user", content: text };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsStreaming(true);
    setStreamingText("");
    setListings([]);

    abortRef.current = new AbortController();

    // 30-second timeout
    const timeoutId = setTimeout(() => {
      abortRef.current?.abort();
    }, 30000);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          session_id: sessionId,
          context_id: contextId,
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const errorBody = await res.json().catch(() => null);
        throw new Error(errorBody?.error ?? `Errore ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6);
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr);
            if (event.type === "text") {
              fullText += event.content;
              // Strip hidden filter block from display
              const displayText = fullText.replace(
                /<!--FILTERS:[\s\S]*?-->/,
                ""
              );
              setStreamingText(displayText);
            } else if (event.type === "listings") {
              setListings(event.data);
            } else if (event.type === "error") {
              // Server-sent error — show in chat
              setMessages((prev) => [
                ...prev,
                {
                  role: "assistant",
                  content: event.content ?? "Si è verificato un errore. Riprova tra poco.",
                },
              ]);
              setStreamingText("");
            } else if (event.type === "done") {
              const displayText = fullText.replace(
                /<!--FILTERS:[\s\S]*?-->/,
                ""
              );
              if (displayText.trim()) {
                setMessages((prev) => [
                  ...prev,
                  { role: "assistant", content: displayText },
                ]);
              }
              setStreamingText("");
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // Could be user abort or timeout
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "La risposta ha impiegato troppo tempo. Riprova tra poco.",
          },
        ]);
        setStreamingText("");
        return;
      }
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Si è verificato un errore. Riprova tra poco.",
        },
      ]);
      setStreamingText("");
    } finally {
      clearTimeout(timeoutId);
      setIsStreaming(false);
      abortRef.current = null;
    }
  }

  return (
    <div className="flex h-full flex-col rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
        <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
        <h3 className="text-sm font-semibold text-gray-900">
          Assistente CasaAI
        </h3>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <ChatMessages
          messages={messages}
          listings={listings}
          isStreaming={isStreaming}
          streamingText={streamingText}
        />
      </div>

      {/* Input */}
      <form
        onSubmit={sendMessage}
        className="flex items-center gap-2 border-t border-gray-100 px-3 py-3"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Descrivi la casa dei tuoi sogni..."
          disabled={isStreaming}
          className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isStreaming || !input.trim()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Invia
        </button>
      </form>
    </div>
  );
}
