"use client";

import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

// Mock data
const VIEWS_DATA = Array.from({ length: 30 }, (_, i) => ({
  date: `${i + 1}/03`,
  views: Math.floor(Math.random() * 200) + 20,
  leads: Math.floor(Math.random() * 10),
}));

const LEAD_SOURCE_DATA = [
  { name: "Chat AI", value: 35, color: "#2563eb" },
  { name: "Form contatto", value: 28, color: "#7c3aed" },
  { name: "Telefono", value: 20, color: "#059669" },
  { name: "Visita", value: 17, color: "#d97706" },
];

const LEAD_BY_DAY = [
  { day: "Lun", leads: 8 },
  { day: "Mar", leads: 12 },
  { day: "Mer", leads: 15 },
  { day: "Gio", leads: 10 },
  { day: "Ven", leads: 18 },
  { day: "Sab", leads: 6 },
  { day: "Dom", leads: 3 },
];

const FUNNEL_DATA = [
  { stage: "Visualizzazioni", value: 2450 },
  { stage: "Lead", value: 147 },
  { stage: "Contattati", value: 89 },
  { stage: "Visite", value: 34 },
  { stage: "Venduti", value: 8 },
];

export default function AnalyticsPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-72 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
      <p className="mt-1 text-sm text-gray-500">
        Statistiche e report della tua agenzia
      </p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Views over time */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-900">
            Visualizzazioni e lead per giorno
          </h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={VIEWS_DATA}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="views"
                  name="Visualizzazioni"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="leads"
                  name="Lead"
                  stroke="#7c3aed"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Lead sources */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-900">
            Lead per fonte
          </h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={LEAD_SOURCE_DATA}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  dataKey="value"
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  label={((props: any) =>
                    `${props.name ?? ""} ${((props.percent ?? 0) * 100).toFixed(0)}%`
                  ) as any}
                >
                  {LEAD_SOURCE_DATA.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Leads by day of week */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-900">
            Lead per giorno della settimana
          </h2>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={LEAD_BY_DAY}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="leads" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Conversion funnel */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-900">
            Conversion funnel
          </h2>
          <div className="mt-4 space-y-3">
            {FUNNEL_DATA.map((item, i) => {
              const width =
                (item.value / FUNNEL_DATA[0].value) * 100;
              const prev = i > 0 ? FUNNEL_DATA[i - 1].value : null;
              const rate = prev
                ? ((item.value / prev) * 100).toFixed(1)
                : null;
              return (
                <div key={item.stage}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-700">
                      {item.stage}
                    </span>
                    <span className="text-gray-500">
                      {item.value.toLocaleString()}
                      {rate && (
                        <span className="ml-1 text-xs text-gray-400">
                          ({rate}%)
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="mt-1 h-6 rounded-full bg-gray-100">
                    <div
                      className="h-6 rounded-full bg-blue-500 transition-all"
                      style={{ width: `${Math.max(width, 4)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
