"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ListingCard {
  id: string;
  title: string;
  price: number;
  price_period?: string | null;
  address?: string;
  city: string;
  surface_sqm: number;
  rooms: number;
  floor?: number | null;
  photos: string[];
  type: string;
  property_type?: string;
  has_parking?: boolean;
  has_elevator?: boolean;
  has_garden?: boolean;
  has_terrace?: boolean;
  ai_reason?: string;
  match_score?: number;
}

interface Props {
  messages: ChatMessage[];
  listings: ListingCard[];
  isStreaming: boolean;
  streamingText: string;
}

/* ───────── helpers ───────── */

function matchBadgeColor(score: number): string {
  if (score > 90) return "#2d6a4f";
  if (score > 80) return "#e07b39";
  return "#9e6b4a";
}

function listingEmoji(listing: ListingCard): string {
  if (listing.property_type === "apartment") return "\u{1F3E2}";
  if (listing.has_garden) return "\u{1F33F}";
  return "\u{1F3E0}";
}

/* ───────── Single listing card ───────── */

function ResultCard({ listing }: { listing: ListingCard }) {
  const router = useRouter();
  const [shadow, setShadow] = useState("none");
  const score = listing.match_score;

  return (
    <div
      onClick={() => router.push(`/annunci/${listing.id}`)}
      onMouseEnter={() => setShadow("0 4px 20px rgba(0,0,0,0.1)")}
      onMouseLeave={() => setShadow("none")}
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 16,
        overflow: "hidden",
        cursor: "pointer",
        background: "white",
        transition: "box-shadow 0.2s",
        boxShadow: shadow,
      }}
    >
      {/* Image area + match badge */}
      <div
        style={{
          position: "relative",
          height: 140,
          background: "#f5f0eb",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ fontSize: 48 }}>{listingEmoji(listing)}</span>
        {typeof score === "number" && (
          <div
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              background: matchBadgeColor(score),
              color: "white",
              borderRadius: 20,
              padding: "4px 10px",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {score}% match
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: 14 }}>
        {/* Price */}
        <div
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: "#111827",
            marginBottom: 8,
          }}
        >
          €&nbsp;{listing.price.toLocaleString("it-IT")}
          {listing.price_period === "month" ? "/mese" : ""}
        </div>

        {/* Address */}
        <div
          style={{
            fontSize: 13,
            color: "#6b7280",
            marginBottom: 10,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          📍 {listing.address ? `${listing.address}, ` : ""}
          {listing.city}
        </div>

        {/* Technical details */}
        <div
          style={{
            display: "flex",
            gap: 12,
            fontSize: 12,
            color: "#6b7280",
            marginBottom: 12,
          }}
        >
          <span>⇄ {listing.rooms} locali</span>
          <span>⬚ {listing.surface_sqm}m²</span>
          {listing.floor != null && <span>▤ {listing.floor}° piano</span>}
        </div>

        {/* AI reason */}
        <div
          style={{
            fontSize: 12,
            borderTop: "1px solid #f3f4f6",
            paddingTop: 10,
          }}
        >
          <span style={{ color: "#e07b39", fontWeight: 600 }}>
            ✦ Perché ti consiglio questo:{" "}
          </span>
          <span style={{ color: "#374151" }}>
            {listing.ai_reason ||
              "Ottima compatibilità con le tue preferenze"}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ───────── Listings block (header + grid + footer) ───────── */

function ListingsBlock({ listings }: { listings: ListingCard[] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{ width: "100%" }}
    >
      {/* HEADER */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
          paddingBottom: 12,
          borderBottom: "1px solid #e5e7eb",
        }}
      >
        <span style={{ fontWeight: 600, color: "#111827" }}>
          ✦ Ho trovato {listings.length} immobili per te
        </span>
        <span style={{ fontSize: 12, color: "#6b7280" }}>
          Ordinati per compatibilità con la tua ricerca
        </span>
      </div>

      {/* GRID — 3 cols desktop, 1 mobile */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: 16,
        }}
      >
        {listings.map((listing) => (
          <ResultCard key={listing.id} listing={listing} />
        ))}
      </div>

      {/* FOOTER */}
      <div
        style={{
          marginTop: 16,
          padding: "14px 16px",
          background: "#f9fafb",
          borderRadius: 12,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: 13, color: "#6b7280" }}>
          Vuoi raffinare la ricerca? Aggiungi dettagli come zona specifica,
          piano, esposizione...
        </span>
        <button
          onClick={() => {
            const el = document.querySelector<HTMLInputElement>(
              'input[type="text"]'
            );
            el?.focus();
          }}
          style={{
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            padding: "8px 16px",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
            whiteSpace: "nowrap",
            marginLeft: 12,
            color: "#111827",
          }}
        >
          Raffina →
        </button>
      </div>
    </motion.div>
  );
}

/* ───────── Main export ───────── */

export function ChatMessages({
  messages,
  listings,
  isStreaming,
  streamingText,
}: Props) {
  return (
    <div className="flex flex-col gap-3 p-4">
      {messages.map((msg, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
        >
          <div
            className="max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed"
            style={
              msg.role === "user"
                ? {
                    background: "#1e40af",
                    color: "#ffffff",
                    borderBottomRightRadius: 0,
                  }
                : {
                    background: "#f9fafb",
                    color: "#111827",
                    border: "1px solid #e2e8f0",
                    borderBottomLeftRadius: 0,
                  }
            }
          >
            {msg.content}
          </div>
        </motion.div>
      ))}

      {/* Listing cards — shown immediately when received via SSE */}
      {listings.length > 0 && <ListingsBlock listings={listings} />}

      {/* Streaming message */}
      {isStreaming && streamingText && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-start"
        >
          <div
            className="max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed"
            style={{
              background: "#f9fafb",
              color: "#111827",
              border: "1px solid #e2e8f0",
              borderBottomLeftRadius: 0,
            }}
          >
            {streamingText}
            <span
              className="ml-0.5 inline-block h-4 w-0.5 animate-pulse"
              style={{ background: "#94a3b8" }}
            />
          </div>
        </motion.div>
      )}

      {/* Streaming indicator */}
      {isStreaming && !streamingText && (
        <div className="flex justify-start">
          <div
            className="rounded-2xl px-4 py-3"
            style={{ background: "#f9fafb", border: "1px solid #e2e8f0" }}
          >
            <div className="flex gap-1">
              <span
                className="h-2 w-2 animate-bounce rounded-full [animation-delay:0ms]"
                style={{ background: "#94a3b8" }}
              />
              <span
                className="h-2 w-2 animate-bounce rounded-full [animation-delay:150ms]"
                style={{ background: "#94a3b8" }}
              />
              <span
                className="h-2 w-2 animate-bounce rounded-full [animation-delay:300ms]"
                style={{ background: "#94a3b8" }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
