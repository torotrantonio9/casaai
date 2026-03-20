"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ChatMessages, type ChatMessage, type ListingCard } from "./ChatMessages";

interface Props {
  sessionId: string | null;
  contextId: string | null;
  welcomeMessage?: string;
  autoMessage?: string;
  inputPlaceholder?: string;
  initialDisabled?: boolean;
}

export function ChatWidget({
  sessionId,
  contextId,
  welcomeMessage,
  autoMessage,
  inputPlaceholder,
  initialDisabled = false,
}: Props) {
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
  const [inputEnabled, setInputEnabled] = useState(!initialDisabled);
  const [customPlaceholder, setCustomPlaceholder] = useState(
    inputPlaceholder ?? "Descrivi la casa dei tuoi sogni..."
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const autoSentRef = useRef(false);

  const scrollToBottom = useCallback(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingText, scrollToBottom]);

  const streamChatMessage = useCallback(
    async (
      allMessages: ChatMessage[],
      options?: { hidden?: boolean; onDone?: () => void }
    ) => {
      setIsStreaming(true);
      setStreamingText("");
      setListings([]);

      abortRef.current = new AbortController();
      const timeoutId = setTimeout(() => abortRef.current?.abort(), 45000);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: allMessages.map((m) => ({
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
        if (!reader) throw new Error("Nessuna risposta dal server");

        const decoder = new TextDecoder();
        let fullText = "";
        let sseBuffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          sseBuffer += decoder.decode(value, { stream: true });
          const parts = sseBuffer.split("\n\n");
          sseBuffer = parts.pop() ?? "";

          for (const part of parts) {
            const lines = part.split("\n");
            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const jsonStr = line.slice(6).trim();
              if (!jsonStr) continue;

              try {
                const event = JSON.parse(jsonStr);
                if (event.type === "text") {
                  fullText += event.content;
                  const displayText = fullText
                    .replace(/<!--FILTERS:[\s\S]*?-->/, "")
                    .replace(/<!--LISTING_SCORES:[\s\S]*?-->/, "");
                  setStreamingText(displayText);
                } else if (event.type === "listings") {
                  setListings(event.data);
                } else if (event.type === "error") {
                  setMessages((prev) => [
                    ...prev,
                    {
                      role: "assistant",
                      content:
                        event.content ??
                        "Si è verificato un errore. Riprova tra poco.",
                    },
                  ]);
                  setStreamingText("");
                } else if (event.type === "done") {
                  // Extract AI scores for listings
                  const scoresMatch = fullText.match(
                    /<!--LISTING_SCORES:([\s\S]*?)-->/
                  );
                  if (scoresMatch) {
                    try {
                      const scores = JSON.parse(scoresMatch[1]) as {
                        id: string;
                        match_score?: number;
                        ai_reason?: string;
                      }[];
                      setListings((prev) =>
                        prev.map((l) => {
                          const s = scores.find((sc) => sc.id === l.id);
                          if (s) {
                            return {
                              ...l,
                              match_score: s.match_score ?? l.match_score,
                              ai_reason: s.ai_reason ?? l.ai_reason,
                            };
                          }
                          return l;
                        })
                      );
                    } catch {
                      // ignore parse errors
                    }
                  }

                  const displayText = fullText
                    .replace(/<!--FILTERS:[\s\S]*?-->/, "")
                    .replace(/<!--LISTING_SCORES:[\s\S]*?-->/, "");
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
        }

        if (fullText) {
          const displayText = fullText
            .replace(/<!--FILTERS:[\s\S]*?-->/, "")
            .replace(/<!--LISTING_SCORES:[\s\S]*?-->/, "");
          if (displayText.trim() && streamingText) {
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: displayText },
            ]);
            setStreamingText("");
          }
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content:
                "La risposta ha impiegato troppo tempo. Riprova tra poco.",
            },
          ]);
          setStreamingText("");
          return;
        }
        const errorMsg =
          err instanceof Error && err.message
            ? err.message
            : "Si è verificato un errore. Riprova tra poco.";
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: errorMsg },
        ]);
        setStreamingText("");
      } finally {
        clearTimeout(timeoutId);
        setIsStreaming(false);
        abortRef.current = null;
        options?.onDone?.();
      }
    },
    [sessionId, contextId, streamingText]
  );

  // Auto-send message after wizard completion
  useEffect(() => {
    if (autoMessage && !autoSentRef.current && sessionId) {
      autoSentRef.current = true;
      const autoMsg: ChatMessage = { role: "user", content: autoMessage };
      // Don't show auto-message in chat — it's hidden
      const allMsgs = [...messages, autoMsg];
      streamChatMessage(allMsgs, {
        hidden: true,
        onDone: () => {
          setInputEnabled(true);
          setCustomPlaceholder("Vuoi affinare la ricerca? Chiedi all'AI...");
        },
      });
    }
  }, [autoMessage, sessionId, messages, streamChatMessage]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isStreaming) return;

    const userMessage: ChatMessage = { role: "user", content: text };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");

    await streamChatMessage(newMessages);
  }

  return (
    <div className="flex h-full flex-col rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
        <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
        <h3 className="text-sm font-semibold" style={{ color: "#111827" }}>
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
          placeholder={customPlaceholder}
          disabled={isStreaming || !inputEnabled}
          style={{ color: "#111827", background: "#ffffff" }}
          className="flex-1 rounded-lg border px-3 py-2 text-sm focus:ring-1 focus:outline-none disabled:opacity-50"
          // Explicit inline border colors for clarity
          onFocus={(e) => (e.currentTarget.style.borderColor = "#1e40af")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "#cbd5e1")}
        />
        <button
          type="submit"
          disabled={isStreaming || !input.trim() || !inputEnabled}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: "#1e40af" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#1d3461")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#1e40af")}
        >
          Invia
        </button>
      </form>
    </div>
  );
}
