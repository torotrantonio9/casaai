"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface Listing {
  id: string;
  title: string;
  city: string;
  price: number;
  status: string;
  views_count: number;
  leads_count: number;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft: { label: "Bozza", color: "bg-gray-100 text-gray-700" },
  active: { label: "Attivo", color: "bg-green-100 text-green-700" },
  sold: { label: "Venduto", color: "bg-blue-100 text-blue-700" },
  rented: { label: "Affittato", color: "bg-blue-100 text-blue-700" },
  archived: { label: "Archiviato", color: "bg-red-100 text-red-700" },
};

function formatPrice(price: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(price);
}

export default function AnnunciPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("listings")
        .select("id, title, city, price, status, views_count, leads_count, created_at")
        .eq("agent_id", user.id)
        .order("created_at", { ascending: false });

      setListings(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">I tuoi annunci</h1>
          <p className="mt-1 text-sm text-gray-500">
            {listings.length} annunci totali
          </p>
        </div>
        <Link
          href="/dashboard/annunci/nuovo"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          + Nuovo annuncio
        </Link>
      </div>

      {loading ? (
        <div className="mt-8 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
      ) : listings.length === 0 ? (
        <div className="mt-12 text-center">
          <p className="text-lg font-medium text-gray-400">
            Nessun annuncio ancora
          </p>
          <Link
            href="/dashboard/annunci/nuovo"
            className="mt-4 inline-block rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Crea il tuo primo annuncio
          </Link>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b bg-gray-50 text-left text-xs text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Annuncio</th>
                <th className="px-4 py-3 font-medium">Prezzo</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Views</th>
                <th className="px-4 py-3 font-medium">Lead</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {listings.map((l) => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{l.title}</p>
                    <p className="text-xs text-gray-500">{l.city}</p>
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {formatPrice(l.price)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CONFIG[l.status]?.color ?? ""}`}
                    >
                      {STATUS_CONFIG[l.status]?.label ?? l.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{l.views_count}</td>
                  <td className="px-4 py-3 text-gray-600">{l.leads_count}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/dashboard/annunci/${l.id}/modifica`}
                      className="text-xs font-medium text-blue-600 hover:text-blue-700"
                    >
                      Modifica
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
