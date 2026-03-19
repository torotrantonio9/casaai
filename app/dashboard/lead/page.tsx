"use client";

import { useState, useEffect } from "react";
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

const COLUMNS = [
  { id: "new", label: "Nuovi", color: "border-blue-400" },
  { id: "contacted", label: "Contattati", color: "border-yellow-400" },
  { id: "visit_scheduled", label: "Visita", color: "border-purple-400" },
  { id: "negotiating", label: "Trattativa", color: "border-orange-400" },
  { id: "closed_won", label: "Chiusi", color: "border-green-400" },
];

function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) return null;
  let color = "bg-red-100 text-red-700";
  if (score >= 70) color = "bg-green-100 text-green-700";
  else if (score >= 40) color = "bg-yellow-100 text-yellow-700";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${color}`}>
      {score}
    </span>
  );
}

function LeadCard({
  lead,
  onStatusChange,
}: {
  lead: Lead;
  onStatusChange: (id: string, status: string) => void;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between">
        <p className="text-sm font-semibold text-gray-900">
          {lead.buyer_name || "Anonimo"}
        </p>
        <ScoreBadge score={lead.ai_score} />
      </div>
      {lead.message && (
        <p className="mt-1 line-clamp-2 text-xs text-gray-600">
          {lead.message}
        </p>
      )}
      {lead.ai_score_reason && (
        <p className="mt-1 text-xs text-blue-600">{lead.ai_score_reason}</p>
      )}
      <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
        <span>{lead.source}</span>
        <span>&middot;</span>
        <span>{new Date(lead.created_at).toLocaleDateString("it-IT")}</span>
      </div>
      <div className="mt-2">
        <select
          value={lead.status}
          onChange={(e) => onStatusChange(lead.id, e.target.value)}
          className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
        >
          {COLUMNS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
          <option value="closed_lost">Perso</option>
        </select>
      </div>
    </div>
  );
}

export default function LeadPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Get leads for user's agency
      const { data } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });

      setLeads(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  async function handleStatusChange(leadId: string, newStatus: string) {
    const supabase = createClient();
    await supabase.from("leads").update({ status: newStatus }).eq("id", leadId);
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, status: newStatus } : l))
    );
  }

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Lead CRM</h1>
        <div className="mt-6 grid grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Lead CRM</h1>
      <p className="mt-1 text-sm text-gray-500">{leads.length} lead totali</p>

      {/* Kanban board */}
      <div className="mt-6 grid grid-cols-1 gap-4 overflow-x-auto sm:grid-cols-2 lg:grid-cols-5">
        {COLUMNS.map((col) => {
          const colLeads = leads.filter((l) => l.status === col.id);
          return (
            <div key={col.id} className="min-w-[200px]">
              <div
                className={`mb-3 flex items-center gap-2 border-t-2 pt-2 ${col.color}`}
              >
                <h3 className="text-sm font-semibold text-gray-700">
                  {col.label}
                </h3>
                <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                  {colLeads.length}
                </span>
              </div>
              <div className="space-y-2">
                {colLeads.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    onStatusChange={handleStatusChange}
                  />
                ))}
                {colLeads.length === 0 && (
                  <p className="py-4 text-center text-xs text-gray-400">
                    Nessun lead
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
