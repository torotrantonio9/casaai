"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ValuationResult {
  valuation_min: number;
  valuation_max: number;
  valuation_central: number;
  confidence: "high" | "medium" | "low";
  price_per_sqm: number;
  zone_average_price_sqm: number;
  positive_factors: string[];
  negative_factors: string[];
  market_trend: string;
}

const PROPERTY_TYPES = [
  { value: "apartment", label: "Appartamento" },
  { value: "house", label: "Casa" },
  { value: "villa", label: "Villa" },
];

const ENERGY_CLASSES = ["A4", "A3", "A2", "A1", "B", "C", "D", "E", "F", "G"];

function formatPrice(price: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(price);
}

const confidenceLabels: Record<string, { label: string; color: string }> = {
  high: { label: "Alta", color: "text-green-600 bg-green-50" },
  medium: { label: "Media", color: "text-yellow-600 bg-yellow-50" },
  low: { label: "Bassa", color: "text-red-600 bg-red-50" },
};

export default function ValutazionePage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ValuationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData(e.currentTarget);

    const body = {
      address: formData.get("address") as string,
      city: formData.get("city") as string,
      province: formData.get("province") as string,
      type: formData.get("type") as string,
      surface_sqm: Number(formData.get("surface_sqm")),
      rooms: Number(formData.get("rooms")),
      floor: formData.get("floor") ? Number(formData.get("floor")) : undefined,
      year_built: formData.get("year_built")
        ? Number(formData.get("year_built"))
        : undefined,
      energy_class: (formData.get("energy_class") as string) || undefined,
      has_parking: formData.get("has_parking") === "on",
      has_garden: formData.get("has_garden") === "on",
      has_elevator: formData.get("has_elevator") === "on",
    };

    try {
      const res = await fetch("/api/ai/valuation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error("Errore nella valutazione");

      const data = await res.json();
      setResult(data);
    } catch {
      setError("Si è verificato un errore. Riprova tra poco.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">
          Valutazione AI del tuo immobile
        </h1>
        <p className="mt-2 text-gray-600">
          Ottieni una stima gratuita e istantanea del valore di mercato
        </p>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Indirizzo *
              </label>
              <input
                name="address"
                required
                placeholder="Via Roma 1"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Città *
              </label>
              <input
                name="city"
                required
                placeholder="Napoli"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Provincia *
              </label>
              <input
                name="province"
                required
                placeholder="NA"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Tipo immobile *
              </label>
              <select
                name="type"
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              >
                {PROPERTY_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Superficie m² *
              </label>
              <input
                name="surface_sqm"
                type="number"
                required
                min={10}
                placeholder="80"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Locali *
              </label>
              <input
                name="rooms"
                type="number"
                required
                min={1}
                placeholder="3"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Piano
              </label>
              <input
                name="floor"
                type="number"
                min={0}
                placeholder="3"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Anno costruzione
              </label>
              <input
                name="year_built"
                type="number"
                min={1800}
                max={2026}
                placeholder="2005"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Classe energetica
              </label>
              <select
                name="energy_class"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">Non specificata</option>
                {ENERGY_CLASSES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Boolean features */}
          <div className="flex flex-wrap gap-4 pt-2">
            {[
              { name: "has_parking", label: "Posto auto" },
              { name: "has_garden", label: "Giardino" },
              { name: "has_elevator", label: "Ascensore" },
            ].map((f) => (
              <label key={f.name} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name={f.name}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                {f.label}
              </label>
            ))}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Analisi in corso..." : "Valuta il mio immobile"}
          </button>
        </form>

        {/* Results */}
        <div>
          <AnimatePresence mode="wait">
            {loading && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex h-64 flex-col items-center justify-center rounded-xl border border-gray-200 bg-white p-6"
              >
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
                <p className="mt-4 text-sm text-gray-500">
                  L&apos;AI sta analizzando il tuo immobile...
                </p>
              </motion.div>
            )}

            {error && (
              <motion.div
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-600"
              >
                {error}
              </motion.div>
            )}

            {result && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                {/* Main valuation */}
                <div className="rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
                  <p className="text-sm text-gray-500">Stima di valore</p>
                  <p className="mt-1 text-3xl font-bold text-blue-600">
                    {formatPrice(result.valuation_central)}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    Range: {formatPrice(result.valuation_min)} &mdash;{" "}
                    {formatPrice(result.valuation_max)}
                  </p>
                  <div className="mt-3 inline-flex items-center gap-1.5">
                    <span className="text-xs text-gray-500">Affidabilità:</span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${confidenceLabels[result.confidence]?.color}`}
                    >
                      {confidenceLabels[result.confidence]?.label}
                    </span>
                  </div>
                </div>

                {/* Price per sqm */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-gray-50 p-4 text-center">
                    <p className="text-xs text-gray-500">Prezzo/m²</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {formatPrice(result.price_per_sqm)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-4 text-center">
                    <p className="text-xs text-gray-500">Media zona</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {formatPrice(result.zone_average_price_sqm)}
                    </p>
                  </div>
                </div>

                {/* Factors */}
                <div className="rounded-xl border border-gray-200 bg-white p-5">
                  {result.positive_factors.length > 0 && (
                    <div className="mb-3">
                      <p className="mb-1.5 text-sm font-semibold text-green-700">
                        Fattori positivi
                      </p>
                      <ul className="space-y-1">
                        {result.positive_factors.map((f, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-sm text-gray-700"
                          >
                            <span className="mt-0.5 text-green-500">+</span>
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {result.negative_factors.length > 0 && (
                    <div className="mb-3">
                      <p className="mb-1.5 text-sm font-semibold text-red-700">
                        Fattori negativi
                      </p>
                      <ul className="space-y-1">
                        {result.negative_factors.map((f, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-sm text-gray-700"
                          >
                            <span className="mt-0.5 text-red-500">&minus;</span>
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {result.market_trend && (
                    <p className="border-t border-gray-100 pt-3 text-sm text-gray-600">
                      {result.market_trend}
                    </p>
                  )}
                </div>
              </motion.div>
            )}

            {!loading && !result && !error && (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 p-6 text-center"
              >
                <p className="text-lg font-medium text-gray-400">
                  Compila il form per ricevere la valutazione AI
                </p>
                <p className="mt-1 text-sm text-gray-400">
                  Gratuita e istantanea
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
