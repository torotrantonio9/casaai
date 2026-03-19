"use client";

import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface MetricCardProps {
  label: string;
  value: string | number;
  trend?: string;
  trendUp?: boolean;
}

function MetricCard({ label, value, trend, trendUp }: MetricCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
      {trend && (
        <p
          className={`mt-1 text-xs font-medium ${trendUp ? "text-green-600" : "text-red-500"}`}
        >
          {trendUp ? "\u2191" : "\u2193"} {trend}
        </p>
      )}
    </div>
  );
}

// Mock data for chart
const MOCK_VIEWS = Array.from({ length: 30 }, (_, i) => ({
  day: `${i + 1}`,
  views: Math.floor(Math.random() * 150) + 30,
}));

interface Lead {
  id: string;
  buyer_name: string;
  listing_title: string;
  ai_score: number;
  status: string;
  created_at: string;
}

const MOCK_LEADS: Lead[] = [
  {
    id: "1",
    buyer_name: "Marco Rossi",
    listing_title: "Trilocale Vomero con vista",
    ai_score: 87,
    status: "new",
    created_at: "2026-03-19T10:30:00",
  },
  {
    id: "2",
    buyer_name: "Anna Bianchi",
    listing_title: "Bilocale Chiaia ristrutturato",
    ai_score: 72,
    status: "contacted",
    created_at: "2026-03-18T15:20:00",
  },
  {
    id: "3",
    buyer_name: "Luigi Verdi",
    listing_title: "Villa Posillipo con giardino",
    ai_score: 45,
    status: "new",
    created_at: "2026-03-18T09:10:00",
  },
];

function ScoreBadge({ score }: { score: number }) {
  let color = "bg-red-100 text-red-700";
  if (score >= 70) color = "bg-green-100 text-green-700";
  else if (score >= 40) color = "bg-yellow-100 text-yellow-700";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${color}`}>
      {score}
    </span>
  );
}

const STATUS_LABELS: Record<string, string> = {
  new: "Nuovo",
  contacted: "Contattato",
  visit_scheduled: "Visita",
  negotiating: "Trattativa",
  closed_won: "Chiuso",
  closed_lost: "Perso",
};

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      <p className="mt-1 text-sm text-gray-500">
        Panoramica della tua agenzia
      </p>

      {/* Metric cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Annunci attivi"
          value={12}
          trend="2 questa settimana"
          trendUp
        />
        <MetricCard
          label="Lead totali"
          value={47}
          trend="+12% vs mese scorso"
          trendUp
        />
        <MetricCard
          label="Lead questa settimana"
          value={8}
          trend="+3 vs settimana scorsa"
          trendUp
        />
        <MetricCard label="Tasso conversione" value="18%" trend="-2%" />
      </div>

      {/* Views chart */}
      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-900">
          Visualizzazioni ultimi 30 giorni
        </h2>
        {mounted && (
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={MOCK_VIEWS}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="views"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Recent leads */}
      <div className="mt-6 rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Lead recenti</h2>
          <a
            href="/dashboard/lead"
            className="text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            Vedi tutti
          </a>
        </div>
        <div className="divide-y">
          {MOCK_LEADS.map((lead) => (
            <div
              key={lead.id}
              className="flex items-center justify-between px-5 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">
                  {lead.buyer_name}
                </p>
                <p className="truncate text-xs text-gray-500">
                  {lead.listing_title}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <ScoreBadge score={lead.ai_score} />
                <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                  {STATUS_LABELS[lead.status] ?? lead.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <a
          href="/dashboard/annunci/nuovo"
          className="rounded-lg border border-gray-200 bg-white p-4 text-center text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          + Pubblica annuncio
        </a>
        <a
          href="/dashboard/lead"
          className="rounded-lg border border-gray-200 bg-white p-4 text-center text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Gestisci lead
        </a>
        <a
          href="/dashboard/analytics"
          className="rounded-lg border border-gray-200 bg-white p-4 text-center text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Vai ad analytics
        </a>
      </div>
    </div>
  );
}
