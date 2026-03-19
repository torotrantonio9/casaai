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
  lat: number | null;
  lng: number | null;
}

const ENERGY_CLASSES = ["A4", "A3", "A2", "A1", "B", "C", "D", "E", "F", "G"];

export default function CercaPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  // Filters
  const [type, setType] = useState("");
  const [city, setCity] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [roomsMin, setRoomsMin] = useState("");
  const [surfaceMin, setSurfaceMin] = useState("");
  const [hasGarden, setHasGarden] = useState(false);
  const [hasParking, setHasParking] = useState(false);
  const [hasElevator, setHasElevator] = useState(false);
  const [energyClass, setEnergyClass] = useState("");
  const [sort, setSort] = useState("newest");

  const fetchListings = useCallback(
    async (pageNum: number, append = false) => {
      setLoading(true);
      const params = new URLSearchParams();
      if (type) params.set("type", type);
      if (city) params.set("city", city);
      if (priceMin) params.set("price_min", priceMin);
      if (priceMax) params.set("price_max", priceMax);
      if (roomsMin) params.set("rooms_min", roomsMin);
      if (surfaceMin) params.set("surface_min", surfaceMin);
      if (hasGarden) params.set("has_garden", "true");
      if (hasParking) params.set("has_parking", "true");
      if (hasElevator) params.set("has_elevator", "true");
      if (energyClass) params.set("energy_class", energyClass);
      params.set("sort", sort);
      params.set("page", String(pageNum));
      params.set("limit", "20");

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
    [type, city, priceMin, priceMax, roomsMin, surfaceMin, hasGarden, hasParking, hasElevator, energyClass, sort]
  );

  useEffect(() => {
    fetchListings(1);
  }, [fetchListings]);

  function loadMore() {
    fetchListings(page + 1, true);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-gray-900">Cerca casa</h1>

      <div className="mt-6 flex gap-6">
        {/* Filters sidebar */}
        <aside className="hidden w-64 flex-shrink-0 lg:block">
          <div className="sticky top-20 space-y-4 rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-gray-900">Filtri</h3>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Tipo
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="">Tutti</option>
                <option value="sale">Vendita</option>
                <option value="rent">Affitto</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Città
              </label>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="es. Napoli"
                className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Prezzo min
                </label>
                <input
                  value={priceMin}
                  onChange={(e) => setPriceMin(e.target.value)}
                  type="number"
                  className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Prezzo max
                </label>
                <input
                  value={priceMax}
                  onChange={(e) => setPriceMax(e.target.value)}
                  type="number"
                  className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Locali min
                </label>
                <input
                  value={roomsMin}
                  onChange={(e) => setRoomsMin(e.target.value)}
                  type="number"
                  className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Superficie min
                </label>
                <input
                  value={surfaceMin}
                  onChange={(e) => setSurfaceMin(e.target.value)}
                  type="number"
                  className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Classe energetica
              </label>
              <select
                value={energyClass}
                onChange={(e) => setEnergyClass(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="">Tutte</option>
                {ENERGY_CLASSES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              {[
                { state: hasGarden, set: setHasGarden, label: "Giardino" },
                { state: hasParking, set: setHasParking, label: "Posto auto" },
                { state: hasElevator, set: setHasElevator, label: "Ascensore" },
              ].map((f) => (
                <label key={f.label} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={f.state}
                    onChange={(e) => f.set(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600"
                  />
                  {f.label}
                </label>
              ))}
            </div>
          </div>
        </aside>

        {/* Results + Map */}
        <div className="flex-1">
          {/* Sort bar */}
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {total} risultati trovati
            </p>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="newest">Più recenti</option>
              <option value="price_asc">Prezzo crescente</option>
              <option value="price_desc">Prezzo decrescente</option>
              <option value="views">Più visti</option>
            </select>
          </div>

          {/* Map placeholder (lazy loaded in production) */}
          <div className="mb-6 flex h-64 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-400">
            Mappa Mapbox (caricamento lazy - richiede NEXT_PUBLIC_MAPBOX_TOKEN)
          </div>

          {/* Results grid */}
          {loading && listings.length === 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-72 animate-pulse rounded-xl bg-gray-100" />
              ))}
            </div>
          ) : listings.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-lg font-medium text-gray-400">
                Nessun annuncio trovato
              </p>
              <p className="mt-1 text-sm text-gray-400">
                Prova a modificare i filtri
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {listings.map((listing) => (
                  <ListingCard key={listing.id} listing={listing} />
                ))}
              </div>

              {hasMore && (
                <div className="mt-6 text-center">
                  <button
                    onClick={loadMore}
                    disabled={loading}
                    className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {loading ? "Caricamento..." : "Carica altri"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <CompareDrawer />
    </div>
  );
}
