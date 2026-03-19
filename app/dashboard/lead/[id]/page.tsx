"use client";

import { useState, useEffect, use } from "react";
import { createClient } from "@/lib/supabase/client";

interface Lead {
  id: string;
  buyer_name: string;
  buyer_email: string;
  buyer_phone: string;
  message: string;
  ai_score: number | null;
  ai_score_reason: string | null;
  status: string;
  source: string;
  listing_id: string;
  created_at: string;
}

interface Listing {
  id: string;
  title: string;
  price: number;
  city: string;
}

type Tone = "professional" | "friendly" | "concise";

function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) return null;
  let color = "bg-red-100 text-red-700";
  if (score >= 70) color = "bg-green-100 text-green-700";
  else if (score >= 40) color = "bg-yellow-100 text-yellow-700";
  return (
    <span className={`rounded-full px-2.5 py-1 text-sm font-semibold ${color}`}>
      {score}/100
    </span>
  );
}

export default function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [lead, setLead] = useState<Lead | null>(null);
  const [listing, setListing] = useState<Listing | null>(null);
  const [draftReply, setDraftReply] = useState("");
  const [draftLoading, setDraftLoading] = useState(false);
  const [selectedTone, setSelectedTone] = useState<Tone>("professional");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: leadData } = await supabase
        .from("leads")
        .select("*")
        .eq("id", id)
        .single();

      if (leadData) {
        setLead(leadData as Lead);
        if (leadData.listing_id) {
          const { data: listingData } = await supabase
            .from("listings")
            .select("id, title, price, city")
            .eq("id", leadData.listing_id)
            .single();
          setListing(listingData as Listing | null);
        }
      }
    }
    load();
  }, [id]);

  async function generateDraft() {
    if (!lead || !listing) return;
    setDraftLoading(true);
    try {
      const res = await fetch("/api/ai/draft-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_message: lead.message,
          listing_title: listing.title,
          tone: selectedTone,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setDraftReply(data.reply);
      }
    } catch {
      // ignore
    } finally {
      setDraftLoading(false);
    }
  }

  async function sendReply() {
    if (!draftReply || !lead) return;
    setSending(true);
    try {
      await fetch("/api/notifications/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template: "draft_reply",
          to: lead.buyer_email,
          data: { reply: draftReply, listing_title: listing?.title },
        }),
      });
      // Update lead status
      const supabase = createClient();
      await supabase
        .from("leads")
        .update({ status: "contacted", ai_reply_used: true })
        .eq("id", lead.id);
      setLead((prev) => (prev ? { ...prev, status: "contacted" } : prev));
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  }

  if (!lead) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900">Dettaglio lead</h1>

      {/* Lead info */}
      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {lead.buyer_name || "Anonimo"}
            </h2>
            <p className="text-sm text-gray-500">{lead.buyer_email}</p>
            {lead.buyer_phone && (
              <p className="text-sm text-gray-500">{lead.buyer_phone}</p>
            )}
          </div>
          <ScoreBadge score={lead.ai_score} />
        </div>

        {lead.ai_score_reason && (
          <p className="mt-2 text-sm text-blue-600">{lead.ai_score_reason}</p>
        )}

        {listing && (
          <div className="mt-3 rounded-lg bg-gray-50 p-3">
            <p className="text-xs text-gray-500">Annuncio</p>
            <p className="text-sm font-medium text-gray-900">
              {listing.title} &mdash; {listing.city}
            </p>
          </div>
        )}

        {/* Buyer message */}
        <div className="mt-4">
          <p className="text-xs font-medium text-gray-500">Messaggio</p>
          <div className="mt-1 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800">
            {lead.message}
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3 text-xs text-gray-400">
          <span>
            {new Date(lead.created_at).toLocaleString("it-IT")}
          </span>
          <span>&middot;</span>
          <span>Fonte: {lead.source}</span>
          <span>&middot;</span>
          <span className="capitalize">Status: {lead.status}</span>
        </div>
      </div>

      {/* AI Draft Reply */}
      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="text-sm font-semibold text-gray-900">
          Bozza risposta AI
        </h3>

        <div className="mt-3 flex items-center gap-2">
          {(["professional", "friendly", "concise"] as Tone[]).map((t) => (
            <button
              key={t}
              onClick={() => setSelectedTone(t)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                selectedTone === t
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {t === "professional"
                ? "Professionale"
                : t === "friendly"
                  ? "Cordiale"
                  : "Conciso"}
            </button>
          ))}
          <button
            onClick={generateDraft}
            disabled={draftLoading}
            className="ml-auto rounded-lg bg-purple-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
          >
            {draftLoading ? "Generazione..." : "Genera bozza"}
          </button>
        </div>

        {draftReply && (
          <div className="mt-4">
            <textarea
              value={draftReply}
              onChange={(e) => setDraftReply(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
            <div className="mt-3 flex gap-2">
              <button
                onClick={sendReply}
                disabled={sending}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {sending ? "Invio..." : "Invia email"}
              </button>
              <button
                onClick={() => setDraftReply("")}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Ignora
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
