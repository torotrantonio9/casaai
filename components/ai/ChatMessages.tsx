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

function InlineListingCard({ listing }: { listing: ListingCard }) {
  return (
    <Link
      href={`/annunci/${listing.id}`}
      className="block rounded-lg border border-gray-200 bg-white p-3 transition-shadow hover:shadow-md"
    >
      <div className="flex gap-3">
        <div className="h-16 w-16 flex-shrink-0 rounded-md bg-gray-100" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-900">
            {listing.title}
          </p>
          <p className="text-sm font-bold text-blue-600">
            {formatPrice(listing.price)}
          </p>
          <p className="text-xs text-gray-500">
            {listing.city} &middot; {listing.surface_sqm}m&sup2; &middot;{" "}
            {listing.rooms} locali
          </p>
        </div>
      </div>
    </Link>
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
            className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
              msg.role === "user"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-800"
            }`}
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
          <div className="max-w-[85%] rounded-2xl bg-gray-100 px-4 py-2.5 text-sm leading-relaxed text-gray-800">
            {streamingText}
            <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-gray-400" />
          </div>
        </motion.div>
      )}

      {/* Streaming indicator */}
      {isStreaming && !streamingText && (
        <div className="flex justify-start">
          <div className="rounded-2xl bg-gray-100 px-4 py-3">
            <div className="flex gap-1">
              <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:0ms]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:150ms]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:300ms]" />
            </div>
          </div>
        </div>
      )}

      {/* Inline listing cards */}
      {listings.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-start"
        >
          <div className="w-full max-w-[90%] space-y-2">
            {listings.map((listing) => (
              <InlineListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
