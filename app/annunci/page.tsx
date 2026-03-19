"use client";

import { useState, useEffect, useCallback } from "react";
import { ListingCard } from "@/components/listings/ListingCard";
import { CompareDrawer } from "@/components/listings/CompareDrawer";

interface Listing {
  id: string;
  title: string;
  price: number;
  city: string;
  province: string;
  surface_sqm: number;
  rooms: number;
  bathrooms: number;
  floor: number | null;
  photos: string[];
  type: string;
  property_type: string;
  energy_class: string | null;
  has_parking: boolean;
  has_garden: boolean;
  has_terrace: boolean;
  has_elevator: boolean;
  has_cellar: boolean;
  is_featured: boolean;
}

export default function AnnunciPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  // Filters
  const [type, setType] = useState("");
  const [city, setCity] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [sort, setSort] = useState("newest");

  const fetchListings = useCallback(
    async (pageNum: number, append = false) => {
      setLoading(true);
      const params = new URLSearchParams();
      if (type) params.set("type", type);
      if (city) params.set("city", city);
      if (priceMax) params.set("price_max", priceMax);
      params.set("sort", sort);
      params.set("page", String(pageNum));
      params.set("limit", "24");

      try {
        const res = await fetch(`/api/listings/search?${params}`);
        if (res.ok) {
          const data = await res.json();
          setListings((prev) =>
            append ? [...prev, ...data.listings] : data.listings
          );
          setTotal(data.total);
          setHasMore(data.has_more);
          setPage(pageNum);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    },
    [type, city, priceMax, sort]
  );

  useEffect(() => {
    fetchListings(1);
  }, [fetchListings]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Annunci immobiliari</h1>
        <p className="mt-2 text-gray-600">
          Esplora tutti gli immobili disponibili su CasaAI
        </p>
      </div>

      {/* Filters bar */}
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-4">
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="">Tutti i tipi</option>
          <option value="sale">Vendita</option>
          <option value="rent">Affitto</option>
        </select>

        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="Città..."
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />

        <input
          value={priceMax}
          onChange={(e) => setPriceMax(e.target.value)}
          placeholder="Prezzo max €"
          type="number"
          className="w-36 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="newest">Più recenti</option>
          <option value="price_asc">Prezzo crescente</option>
          <option value="price_desc">Prezzo decrescente</option>
          <option value="views">Più visti</option>
        </select>

        <span className="ml-auto text-sm text-gray-500">
          {total} annunci trovati
        </span>
      </div>

      {/* Results */}
      {loading && listings.length === 0 ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-80 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      ) : listings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24">
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-blue-50">
            <svg className="h-10 w-10 text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.5V3.545M12.75 21h7.5V10.75M2.25 21h1.5m18 0h-18M2.25 9l4.5-1.636M18.75 3l-1.5.545m0 6.205l3 1m1.5.5l-1.5-.5M6.75 7.364V3h-3v18m3-13.636l10.5-3.819" />
            </svg>
          </div>
          <h2 className="mb-2 text-xl font-semibold text-gray-900">
            Nessun annuncio trovato
          </h2>
          <p className="mb-6 max-w-sm text-center text-gray-500">
            Non ci sono annunci che corrispondono ai tuoi criteri. Prova a modificare i filtri o torna più tardi.
          </p>
          <button
            onClick={() => {
              setType("");
              setCity("");
              setPriceMax("");
            }}
            className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Resetta filtri
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>

          {hasMore && (
            <div className="mt-8 text-center">
              <button
                onClick={() => fetchListings(page + 1, true)}
                disabled={loading}
                className="rounded-lg border border-gray-300 px-8 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {loading ? "Caricamento..." : "Carica altri annunci"}
              </button>
            </div>
          )}
        </>
      )}

      <CompareDrawer />
    </div>
  );
}
