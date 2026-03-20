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

let msgCounter = 0;
function nextId(): string {
  msgCounter += 1;
  return `msg-${Date.now()}-${msgCounter}`;
}

function makeTextMsg(
  role: "user" | "assistant",
  content: string
): ChatMessage {
  return { id: nextId(), role, type: "text", content, listings: [] };
}

function makeListingsMsg(listings: ListingCard[]): ChatMessage {
  return {
    id: nextId(),
    role: "assistant",
    type: "listings",
    content: "",
    listings,
  };
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
      return [makeTextMsg("assistant", welcomeMessage)];
    }
    return [
      makeTextMsg(
        "assistant",
        "Ciao! Sono l'assistente AI di CasaAI. Dimmi come vorresti vivere e ti aiuterò a trovare la casa perfetta."
      ),
    ];
  });
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [inputEnabled, setInputEnabled] = useState(!initialDisabled);
  const [customPlaceholder, setCustomPlaceholder] = useState(
    inputPlaceholder ?? "Descrivi la casa dei tuoi sogni..."
  );
  const [shownListingIds, setShownListingIds] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [searchStatus, setSearchStatus] = useState<string | null>(null);
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
      options?: { hidden?: boolean; onDone?: () => void; isAutoTrigger?: boolean }
    ) => {
      setIsStreaming(true);
      setStreamingText("");
      setSearchStatus("Ricerca in corso...");

      abortRef.current = new AbortController();
      const timeoutId = setTimeout(() => abortRef.current?.abort(), 45000);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: allMessages
              .filter((m) => m.type === "text" && m.content)
              .map((m) => ({
                role: m.role,
                content: m.content,
              })),
            session_id: sessionId,
            context_id: contextId,
            is_auto_trigger: options?.isAutoTrigger ?? false,
            shown_listing_ids: shownListingIds,
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
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() || "";

          for (const part of parts) {
            const line = part.trim();
            if (!line.startsWith("data: ")) continue;
            const raw = line.slice(6).trim();
            if (raw === "[DONE]") continue;

            try {
              const event = JSON.parse(raw);
              console.log("SSE EVENT:", event.type, event);

              if (event.type === "listings" && event.data?.length > 0) {
                // Track shown listing IDs (BUG 4 fix: use state)
                const newIds = event.data.map((l: ListingCard) => l.id);
                setShownListingIds((prev) => [
                  ...new Set([...prev, ...newIds]),
                ]);
                // Insert listings as their own message
                setMessages((prev) => [
                  ...prev,
                  makeListingsMsg(event.data),
                ]);
                setSearchStatus(`Trovati ${event.data.length} risultati`);
              } else if (event.type === "text" && event.content) {
                fullText += event.content;
                setStreamingText(fullText);
              } else if (event.type === "suggestions" && Array.isArray(event.data)) {
                setSuggestions(event.data);
              } else if (event.type === "error") {
                setMessages((prev) => [
                  ...prev,
                  makeTextMsg(
                    "assistant",
                    event.content ??
                      "Si è verificato un errore. Riprova tra poco."
                  ),
                ]);
                setStreamingText("");
              } else if (event.type === "done") {
                if (fullText.trim()) {
                  setMessages((prev) => [
                    ...prev,
                    makeTextMsg("assistant", fullText),
                  ]);
                }
                setStreamingText("");
              }
            } catch (e) {
              console.warn("SSE parse error:", raw, e);
            }
          }
        }

        // Fallback: if stream ended without "done" event
        if (fullText.trim()) {
          setMessages((prev) => {
            // Avoid duplicating if "done" event already added it
            const lastMsg = prev[prev.length - 1];
            if (lastMsg?.role === "assistant" && lastMsg.content === fullText) {
              return prev;
            }
            return [...prev, makeTextMsg("assistant", fullText)];
          });
          setStreamingText("");
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          setMessages((prev) => [
            ...prev,
            makeTextMsg(
              "assistant",
              "La risposta ha impiegato troppo tempo. Riprova tra poco."
            ),
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
          makeTextMsg("assistant", errorMsg),
        ]);
        setStreamingText("");
      } finally {
        clearTimeout(timeoutId);
        setIsStreaming(false);
        setSearchStatus(null);
        abortRef.current = null;
        options?.onDone?.();
      }
    },
    [sessionId, contextId, shownListingIds]
  );

  // Auto-send message after wizard completion
  useEffect(() => {
    if (autoMessage && !autoSentRef.current && sessionId) {
      autoSentRef.current = true;
      const autoMsg = makeTextMsg("user", autoMessage);
      // Don't show auto-message in chat — it's hidden
      const allMsgs = [...messages, autoMsg];
      streamChatMessage(allMsgs, {
        hidden: true,
        isAutoTrigger: true,
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

    const userMessage = makeTextMsg("user", text);
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setSuggestions([]);

    await streamChatMessage(newMessages);
  }

  return (
    <div className="flex h-full flex-col border border-gray-200 bg-white shadow-sm" style={{ borderRadius: "0 0 16px 16px", overflow: "hidden" }}>
      {/* Spin keyframe for search spinner */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Gradient Header */}
      <div style={{
        background: "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)",
        padding: "16px 20px",
        borderRadius: "16px 16px 0 0"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 36, height: 36,
            background: "rgba(255,255,255,0.2)",
            borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18
          }}>🏠</div>
          <div>
            <div style={{ color: "white", fontWeight: 600, fontSize: 14 }}>
              Assistente CasaAI
            </div>
            <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 11, display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 6, height: 6, background: "#4ade80", borderRadius: "50%", display: "inline-block" }} />
              Online · risponde in pochi secondi
            </div>
          </div>
        </div>
      </div>

      {/* Search progress bar */}
      {searchStatus && (
        <div style={{
          padding: "8px 16px",
          background: "#eff6ff",
          borderBottom: "1px solid #dbeafe",
          fontSize: 12,
          color: "#1e40af",
          display: "flex",
          alignItems: "center",
          gap: 8
        }}>
          <div style={{
            width: 12, height: 12,
            border: "2px solid #93c5fd",
            borderTopColor: "#1e40af",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite"
          }} />
          {searchStatus}
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <ChatMessages
          messages={messages}
          isStreaming={isStreaming}
          streamingText={streamingText}
        />
      </div>

      {/* Quick reply suggestions */}
      {suggestions.length > 0 && !isStreaming && (
        <div style={{ display: "flex", gap: 8, padding: "8px 16px", flexWrap: "wrap" }}>
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => {
                setSuggestions([]);
                setInput(s);
                // Auto-submit
                const userMessage = makeTextMsg("user", s);
                const newMessages = [...messages, userMessage];
                setMessages(newMessages);
                streamChatMessage(newMessages);
              }}
              style={{
                background: "#eff6ff",
                border: "1px solid #bfdbfe",
                borderRadius: 20,
                padding: "6px 14px",
                fontSize: 12,
                fontWeight: 500,
                color: "#1e40af",
                cursor: "pointer",
                transition: "all 0.2s"
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#dbeafe"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "#eff6ff"; }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

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
          onFocus={(e) => (e.currentTarget.style.borderColor = "#1e40af")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "#cbd5e1")}
        />
        <button
          type="submit"
          disabled={isStreaming || !input.trim() || !inputEnabled}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: "#1e40af" }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = "#1d3461")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "#1e40af")
          }
        >
          Invia
        </button>
      </form>
    </div>
  );
}
