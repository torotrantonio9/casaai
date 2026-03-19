"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type FeatureKey =
  | "has_elevator"
  | "has_parking"
  | "has_garden"
  | "has_terrace"
  | "pet_friendly"
  | "accessible"
  | "ground_floor"
  | "has_cellar"
  | "energy_class_ab"
  | "has_pool";

export interface ChatContext {
  intent: "sale" | "rent";
  budget_max: number;
  budget_min?: number;
  location: {
    lat: number;
    lng: number;
    label: string;
  } | null;
  max_distance_km: 5 | 10 | 20 | 30 | null;
  must_have: FeatureKey[];
  nice_to_have: FeatureKey[];
  custom_note?: string;
}

const FEATURES: { key: FeatureKey; label: string; emoji: string }[] = [
  { key: "has_elevator", label: "Ascensore", emoji: "\u{1F6D7}" },
  { key: "has_parking", label: "Posto auto", emoji: "\u{1F697}" },
  { key: "has_garden", label: "Giardino", emoji: "\u{1F33F}" },
  { key: "has_terrace", label: "Terrazzo", emoji: "\u{1F3D6}" },
  { key: "pet_friendly", label: "Pet-friendly", emoji: "\u{1F415}" },
  { key: "accessible", label: "Accessibile", emoji: "\u{267F}" },
  { key: "ground_floor", label: "Piano terra", emoji: "\u{1F508}" },
  { key: "has_cellar", label: "Cantina", emoji: "\u{1F4E6}" },
  { key: "energy_class_ab", label: "Classe A/B", emoji: "\u{26A1}" },
  { key: "has_pool", label: "Piscina", emoji: "\u{1F3CA}" },
];

const DISTANCES = [5, 10, 20, 30] as const;

interface Props {
  onComplete: (context: ChatContext) => void;
  onSkip: () => void;
}

export function ChatOnboarding({ onComplete, onSkip }: Props) {
  const [step, setStep] = useState(0);
  const [context, setContext] = useState<ChatContext>({
    intent: "sale",
    budget_max: 300000,
    location: null,
    max_distance_km: 10,
    must_have: [],
    nice_to_have: [],
  });

  const totalSteps = 4;

  function next() {
    if (step < totalSteps - 1) {
      setStep(step + 1);
    } else {
      onComplete(context);
    }
  }

  function prev() {
    if (step > 0) setStep(step - 1);
  }

  const budgetConfig =
    context.intent === "rent"
      ? { min: 300, max: 5000, step: 100, label: "/mese" }
      : { min: 50000, max: 2000000, step: 10000, label: "" };

  function formatPrice(value: number) {
    if (value >= 1000000) return `\u20AC${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `\u20AC${(value / 1000).toFixed(0)}k`;
    return `\u20AC${value}`;
  }

  function toggleFeature(key: FeatureKey) {
    setContext((prev) => {
      const inMustHave = prev.must_have.includes(key);
      if (inMustHave) {
        return { ...prev, must_have: prev.must_have.filter((k) => k !== key) };
      }
      return { ...prev, must_have: [...prev.must_have, key] };
    });
  }

  return (
    <div className="mx-auto w-full max-w-lg">
      {/* Progress bar */}
      <div className="mb-6 flex items-center gap-2">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i <= step ? "bg-blue-600" : "bg-gray-200"
            }`}
          />
        ))}
        <span className="ml-2 text-xs text-gray-500">
          {step + 1}/{totalSteps}
        </span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
        >
          {/* Step 0: Intent */}
          {step === 0 && (
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-gray-900">
                Stai cercando per...
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {(["sale", "rent"] as const).map((intent) => (
                  <button
                    key={intent}
                    onClick={() => {
                      setContext((p) => ({
                        ...p,
                        intent,
                        budget_max: intent === "rent" ? 1500 : 300000,
                      }));
                    }}
                    className={`rounded-xl border-2 p-4 text-center transition-all ${
                      context.intent === intent
                        ? "border-blue-600 bg-blue-50 text-blue-700"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <span className="text-2xl">
                      {intent === "sale" ? "\u{1F3E0}" : "\u{1F511}"}
                    </span>
                    <p className="mt-1 font-medium">
                      {intent === "sale" ? "Acquisto" : "Affitto"}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 1: Budget */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-gray-900">
                Qual è il tuo budget massimo?
              </h3>
              <div className="text-center">
                <span className="text-3xl font-bold text-blue-600">
                  {formatPrice(context.budget_max)}
                  {budgetConfig.label}
                </span>
              </div>
              <input
                type="range"
                min={budgetConfig.min}
                max={budgetConfig.max}
                step={budgetConfig.step}
                value={context.budget_max}
                onChange={(e) =>
                  setContext((p) => ({
                    ...p,
                    budget_max: Number(e.target.value),
                  }))
                }
                className="w-full accent-blue-600"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>{formatPrice(budgetConfig.min)}</span>
                <span>{formatPrice(budgetConfig.max)}</span>
              </div>
            </div>
          )}

          {/* Step 2: Location + Distance */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-gray-900">
                Da dove vuoi partire?
              </h3>
              <input
                type="text"
                placeholder="Inserisci indirizzo o zona..."
                value={context.location?.label ?? ""}
                onChange={(e) =>
                  setContext((p) => ({
                    ...p,
                    location: {
                      lat: 41.9028,
                      lng: 12.4964,
                      label: e.target.value,
                    },
                  }))
                }
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
              />
              <p className="text-xs text-gray-400">
                L&apos;autocomplete Google Places sarà integrato in fase
                successiva
              </p>

              <div>
                <p className="mb-2 text-sm font-medium text-gray-700">
                  Distanza massima:
                </p>
                <div className="flex gap-2">
                  {DISTANCES.map((km) => (
                    <button
                      key={km}
                      onClick={() =>
                        setContext((p) => ({ ...p, max_distance_km: km }))
                      }
                      className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                        context.max_distance_km === km
                          ? "border-blue-600 bg-blue-50 text-blue-700"
                          : "border-gray-200 text-gray-600 hover:border-gray-300"
                      }`}
                    >
                      {km}km
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Features */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-gray-900">
                Cosa non può mancare?
              </h3>
              <p className="text-sm text-gray-500">
                Seleziona tutto ciò che vuoi
              </p>
              <div className="grid grid-cols-2 gap-2">
                {FEATURES.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => toggleFeature(f.key)}
                    className={`rounded-lg border px-3 py-2.5 text-left text-sm transition-all ${
                      context.must_have.includes(f.key)
                        ? "border-blue-600 bg-blue-50 text-blue-700"
                        : "border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    <span className="mr-1.5">{f.emoji}</span>
                    {f.label}
                  </button>
                ))}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Esigenze speciali (opzionale)
                </label>
                <textarea
                  value={context.custom_note ?? ""}
                  onChange={(e) =>
                    setContext((p) => ({ ...p, custom_note: e.target.value }))
                  }
                  placeholder='es. "vicino a buone scuole elementari"'
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation buttons */}
      <div className="mt-6 flex items-center justify-between">
        <button
          onClick={prev}
          disabled={step === 0}
          className="text-sm text-gray-500 hover:text-gray-700 disabled:invisible"
        >
          Indietro
        </button>

        <button
          onClick={next}
          className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          {step === totalSteps - 1 ? "Avvia la ricerca" : "Avanti"}
        </button>
      </div>

      <button
        onClick={onSkip}
        className="mt-4 block w-full text-center text-xs text-gray-400 hover:text-gray-600"
      >
        Salta e parla direttamente con l&apos;AI
      </button>
    </div>
  );
}
