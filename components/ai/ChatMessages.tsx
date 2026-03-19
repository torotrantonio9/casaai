"use client";

import { motion } from "framer-motion";
import Link from "next/link";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ListingCard {
  id: string;
  title: string;
  price: number;
  city: string;
  surface_sqm: number;
  rooms: number;
  photos: string[];
  type: string;
  property_type?: string;
  has_parking?: boolean;
  has_elevator?: boolean;
  has_garden?: boolean;
  has_terrace?: boolean;
}

interface Props {
  messages: ChatMessage[];
  listings: ListingCard[];
  isStreaming: boolean;
  streamingText: string;
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(price);
}

// Generate a consistent pastel color from listing id
function placeholderColor(id: string): string {
  const colors = [
    "#dbeafe", "#fce7f3", "#d1fae5", "#fef3c7",
    "#e0e7ff", "#fae8ff", "#ccfbf1", "#fee2e2",
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function InlineListingCard({ listing }: { listing: ListingCard }) {
  const features: string[] = [];
  if (listing.has_parking) features.push("Posto auto");
  if (listing.has_elevator) features.push("Ascensore");
  if (listing.has_garden) features.push("Giardino");
  if (listing.has_terrace) features.push("Terrazzo");

  return (
    <div className="overflow-hidden rounded-xl border bg-white shadow-sm transition-shadow hover:shadow-md"
      style={{ borderColor: "#e2e8f0" }}>
      {/* Photo placeholder */}
      <div
        className="flex h-28 items-center justify-center"
        style={{ background: placeholderColor(listing.id) }}
      >
        <svg className="h-8 w-8 opacity-30" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.5V3.545M12.75 21h7.5V10.75M2.25 21h1.5m18 0h-18M2.25 9l4.5-1.636M18.75 3l-1.5.545m0 6.205l3 1m1.5.5l-1.5-.5M6.75 7.364V3h-3v18m3-13.636l10.5-3.819" />
        </svg>
      </div>
      {/* Content */}
      <div className="p-3">
        <p className="truncate text-sm font-semibold" style={{ color: "#1a1a2e" }}>
          {listing.title}
        </p>
        <p className="text-base font-bold" style={{ color: "#1e40af" }}>
          {formatPrice(listing.price)}
        </p>
        <p className="text-xs" style={{ color: "#64748b" }}>
          {listing.city} &middot; {listing.surface_sqm}m&sup2; &middot;{" "}
          {listing.rooms} locali
        </p>
        {features.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {features.map((f) => (
              <span
                key={f}
                className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{ background: "#f1f5f9", color: "#1e293b" }}
              >
                {f}
              </span>
            ))}
          </div>
        )}
        <Link
          href={`/annunci/${listing.id}`}
          className="mt-2 inline-block rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
          style={{ background: "#1e40af" }}
        >
          Vedi dettagli
        </Link>
      </div>
    </div>
  );
}

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
                ? { background: "#1e40af", color: "#ffffff" }
                : { background: "#f8fafc", color: "#1e293b", border: "1px solid #e2e8f0" }
            }
          >
            {msg.content}
          </div>
        </motion.div>
      ))}

      {/* Streaming message */}
      {isStreaming && streamingText && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-start"
        >
          <div
            className="max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed"
            style={{ background: "#f8fafc", color: "#1e293b", border: "1px solid #e2e8f0" }}
          >
            {streamingText}
            <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse" style={{ background: "#94a3b8" }} />
          </div>
        </motion.div>
      )}

      {/* Streaming indicator */}
      {isStreaming && !streamingText && (
        <div className="flex justify-start">
          <div
            className="rounded-2xl px-4 py-3"
            style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}
          >
            <div className="flex gap-1">
              <span className="h-2 w-2 animate-bounce rounded-full [animation-delay:0ms]" style={{ background: "#94a3b8" }} />
              <span className="h-2 w-2 animate-bounce rounded-full [animation-delay:150ms]" style={{ background: "#94a3b8" }} />
              <span className="h-2 w-2 animate-bounce rounded-full [animation-delay:300ms]" style={{ background: "#94a3b8" }} />
            </div>
          </div>
        </div>
      )}

      {/* Listing cards in 2-column grid */}
      {listings.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-start"
        >
          <div className="w-full max-w-[95%] grid grid-cols-1 gap-3 sm:grid-cols-2">
            {listings.map((listing) => (
              <InlineListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
