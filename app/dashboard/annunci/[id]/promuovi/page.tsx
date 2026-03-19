"use client";

import { useState, use } from "react";

const PROMO_PLANS = [
  {
    id: "boost",
    label: "Boost",
    price: 29,
    duration: "14 giorni",
    description: "Badge 'In evidenza' e posizione prioritaria nei risultati",
  },
  {
    id: "featured",
    label: "In evidenza",
    price: 49,
    duration: "30 giorni",
    description: "Badge premium, posizione top e maggiore visibilità",
    popular: true,
  },
  {
    id: "top",
    label: "Posizione #1",
    price: 79,
    duration: "30 giorni",
    description: "Posizione garantita #1 nella tua città + tutte le feature premium",
  },
];

export default function PromuoviPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [selectedPlan, setSelectedPlan] = useState("featured");
  const [loading, setLoading] = useState(false);

  async function handlePurchase() {
    setLoading(true);
    try {
      // In production: POST /api/stripe/promote with listing_id and plan
      await new Promise((r) => setTimeout(r, 1000));
      alert(
        `Stripe Payment Intent per annuncio ${id}, piano ${selectedPlan} (non ancora configurato)`
      );
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900">Promuovi annuncio</h1>
      <p className="mt-1 text-sm text-gray-500">
        Aumenta la visibilit&agrave; del tuo annuncio con una promozione a
        pagamento.
      </p>

      <div className="mt-6 space-y-3">
        {PROMO_PLANS.map((plan) => (
          <button
            key={plan.id}
            onClick={() => setSelectedPlan(plan.id)}
            className={`relative w-full rounded-xl border p-5 text-left transition-all ${
              selectedPlan === plan.id
                ? "border-blue-500 ring-2 ring-blue-100"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            {plan.popular && (
              <span className="absolute -top-2.5 right-4 rounded-full bg-blue-600 px-2.5 py-0.5 text-xs font-semibold text-white">
                Consigliato
              </span>
            )}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">{plan.label}</h3>
                <p className="mt-0.5 text-sm text-gray-600">
                  {plan.description}
                </p>
                <p className="mt-1 text-xs text-gray-400">{plan.duration}</p>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                &euro;{plan.price}
              </p>
            </div>
          </button>
        ))}
      </div>

      <button
        onClick={handlePurchase}
        disabled={loading}
        className="mt-6 w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Elaborazione..." : `Paga \u20AC${PROMO_PLANS.find((p) => p.id === selectedPlan)?.price ?? 0}`}
      </button>
    </div>
  );
}
