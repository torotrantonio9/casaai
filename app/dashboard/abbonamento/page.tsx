"use client";

import { useState } from "react";

interface Plan {
  tier: string;
  name: string;
  price: number;
  features: string[];
  limits: string;
  highlighted?: boolean;
}

const PLANS: Plan[] = [
  {
    tier: "free",
    name: "Free",
    price: 0,
    limits: "3 annunci, 10 lead/mese",
    features: [
      "3 annunci attivi",
      "10 lead al mese",
      "3 descrizioni AI/mese",
      "Import CSV (max 10)",
      "Supporto email",
    ],
  },
  {
    tier: "starter",
    name: "Starter",
    price: 99,
    limits: "25 annunci, 100 lead/mese",
    features: [
      "25 annunci attivi",
      "100 lead al mese",
      "50 descrizioni AI/mese",
      "Lead scoring AI",
      "Import da URL",
      "Supporto email",
    ],
  },
  {
    tier: "pro",
    name: "Pro",
    price: 249,
    limits: "100 annunci, lead illimitati",
    highlighted: true,
    features: [
      "100 annunci attivi",
      "Lead illimitati",
      "Descrizioni AI illimitate",
      "Lead scoring AI",
      "Analytics avanzate",
      "Sync automatica giornaliera",
      "Supporto prioritario",
    ],
  },
  {
    tier: "enterprise",
    name: "Enterprise",
    price: 499,
    limits: "Tutto illimitato",
    features: [
      "Annunci illimitati",
      "Lead illimitati",
      "Tutto illimitato",
      "API access",
      "Multi-portale sync",
      "Sync in tempo reale",
      "Supporto dedicato",
    ],
  },
];

export default function AbbonamentoPage() {
  const [currentTier] = useState("free");
  const [loading, setLoading] = useState<string | null>(null);

  async function handleSubscribe(tier: string) {
    setLoading(tier);
    try {
      // In production: call API to create Stripe checkout session
      // const res = await fetch('/api/stripe/checkout', { method: 'POST', body: JSON.stringify({ tier }) });
      // const { url } = await res.json();
      // window.location.href = url;

      // Placeholder redirect
      await new Promise((r) => setTimeout(r, 1000));
      alert(`Checkout Stripe per piano ${tier} (non ancora configurato)`);
    } catch {
      // Handle error
    } finally {
      setLoading(null);
    }
  }

  async function handleManage() {
    // In production: create Stripe Customer Portal session
    // const res = await fetch('/api/stripe/portal', { method: 'POST' });
    // const { url } = await res.json();
    // window.location.href = url;
    alert("Customer Portal Stripe (non ancora configurato)");
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Abbonamento</h1>
      <p className="mt-1 text-sm text-gray-500">
        Piano attuale:{" "}
        <span className="font-semibold capitalize">{currentTier}</span>
      </p>

      {currentTier !== "free" && (
        <button
          onClick={handleManage}
          className="mt-3 text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          Gestisci abbonamento (Stripe Portal)
        </button>
      )}

      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((plan) => (
          <div
            key={plan.tier}
            className={`relative rounded-xl border p-5 ${
              plan.highlighted
                ? "border-blue-500 ring-2 ring-blue-100"
                : "border-gray-200"
            } ${currentTier === plan.tier ? "bg-blue-50" : "bg-white"}`}
          >
            {plan.highlighted && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-3 py-0.5 text-xs font-semibold text-white">
                Più popolare
              </span>
            )}
            <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
            <p className="mt-1">
              <span className="text-3xl font-bold text-gray-900">
                &euro;{plan.price}
              </span>
              {plan.price > 0 && (
                <span className="text-sm text-gray-500">/mese</span>
              )}
            </p>
            <p className="mt-1 text-xs text-gray-500">{plan.limits}</p>

            <ul className="mt-4 space-y-2">
              {plan.features.map((f) => (
                <li
                  key={f}
                  className="flex items-start gap-2 text-sm text-gray-600"
                >
                  <span className="mt-0.5 text-green-500">&check;</span>
                  {f}
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleSubscribe(plan.tier)}
              disabled={
                currentTier === plan.tier || loading === plan.tier
              }
              className={`mt-5 w-full rounded-lg py-2.5 text-sm font-semibold disabled:opacity-50 ${
                plan.highlighted
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "border border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
            >
              {currentTier === plan.tier
                ? "Piano attuale"
                : loading === plan.tier
                  ? "Caricamento..."
                  : plan.price === 0
                    ? "Gratuito"
                    : "Abbonati"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
