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
  | "has_pool"
  | "high_floor"
  | "quiet_area"
  | "near_metro"
  | "near_schools"
  | "near_hospital"
  | "green_area";

export type WhoIsSearching = "solo" | "coppia" | "famiglia" | "investimento";

export interface ChatContext {
  intent: "sale" | "rent";
  who_is_searching: WhoIsSearching;
  rooms_needed: 1 | 2 | 3 | 4;
  smart_working: boolean;
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

const WHO_OPTIONS: { key: WhoIsSearching; label: string; emoji: string }[] = [
  { key: "solo", label: "Solo/a", emoji: "\u{1F464}" },
  { key: "coppia", label: "Coppia", emoji: "\u{1F46B}" },
  { key: "famiglia", label: "Famiglia", emoji: "\u{1F468}\u200D\u{1F469}\u200D\u{1F467}" },
  { key: "investimento", label: "Investimento", emoji: "\u{1F3E2}" },
];

const ROOMS_OPTIONS: { value: 1 | 2 | 3 | 4; label: string }[] = [
  { value: 1, label: "Monolocale" },
  { value: 2, label: "2 locali" },
  { value: 3, label: "3 locali" },
  { value: 4, label: "4+ locali" },
];

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
  { key: "high_floor", label: "Piano alto", emoji: "\u{1F31E}" },
  { key: "quiet_area", label: "Zona silenziosa", emoji: "\u{1F507}" },
  { key: "near_metro", label: "Vicino metro", emoji: "\u{1F687}" },
  { key: "near_schools", label: "Vicino scuole", emoji: "\u{1F3EB}" },
  { key: "near_hospital", label: "Vicino ospedale", emoji: "\u{1F3E5}" },
  { key: "green_area", label: "Zona verde", emoji: "\u{1F333}" },
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
    who_is_searching: "solo",
    rooms_needed: 2,
    smart_working: false,
    budget_max: 300000,
    location: null,
    max_distance_km: 10,
    must_have: [],
    nice_to_have: [],
  });

  const totalSteps = 6;

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

  const selectedStyle = {
    borderColor: "#1e40af",
    background: "#1e40af",
    color: "#ffffff",
  };
  const unselectedStyle = {
    borderColor: "#cbd5e1",
    background: "#ffffff",
    color: "#1e293b",
  };

  return (
    <div className="mx-auto w-full max-w-lg">
      {/* Progress bar */}
      <div className="mb-6 flex items-center gap-2">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className="h-1.5 flex-1 rounded-full transition-colors"
            style={{ background: i <= step ? "#1e40af" : "#e2e8f0" }}
          />
        ))}
        <span className="ml-2 text-xs" style={{ color: "#64748b" }}>
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
              <h3 className="text-xl font-bold" style={{ color: "#111827" }}>
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
                    className="rounded-xl border-2 p-4 text-center transition-all"
                    style={
                      context.intent === intent
                        ? selectedStyle
                        : unselectedStyle
                    }
                  >
                    <span className="text-2xl">
                      {intent === "sale" ? "\u{1F3E0}" : "\u{1F511}"}
                    </span>
                    <p className="mt-1 font-semibold">
                      {intent === "sale" ? "Acquisto" : "Affitto"}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 1: Who is searching */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold" style={{ color: "#111827" }}>
                Per chi stai cercando?
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {WHO_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() =>
                      setContext((p) => ({ ...p, who_is_searching: opt.key }))
                    }
                    className="rounded-xl border-2 p-4 text-center transition-all"
                    style={
                      context.who_is_searching === opt.key
                        ? selectedStyle
                        : unselectedStyle
                    }
                  >
                    <span className="text-2xl">{opt.emoji}</span>
                    <p className="mt-1 font-semibold">{opt.label}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Rooms */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold" style={{ color: "#111827" }}>
                Di quante stanze hai bisogno?
              </h3>
              <div className="flex gap-2">
                {ROOMS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() =>
                      setContext((p) => ({ ...p, rooms_needed: opt.value }))
                    }
                    className="flex-1 rounded-lg border-2 px-3 py-3 text-sm font-semibold transition-all"
                    style={
                      context.rooms_needed === opt.value
                        ? selectedStyle
                        : unselectedStyle
                    }
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <label
                className="mt-3 flex items-center gap-3 cursor-pointer"
                style={{ color: "#111827" }}
              >
                <input
                  type="checkbox"
                  checked={context.smart_working}
                  onChange={(e) =>
                    setContext((p) => ({ ...p, smart_working: e.target.checked }))
                  }
                  className="h-5 w-5 rounded border-gray-300"
                  style={{ accentColor: "#1e40af" }}
                />
                <span className="text-sm font-medium">
                  Stanza dedicata allo smart working
                </span>
              </label>
            </div>
          )}

          {/* Step 3: Budget */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold" style={{ color: "#111827" }}>
                Qual è il tuo budget massimo?
              </h3>
              <div className="text-center">
                <span className="text-3xl font-bold" style={{ color: "#1e40af" }}>
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
                className="w-full"
                style={{ accentColor: "#1e40af" }}
              />
              <div className="flex justify-between text-xs" style={{ color: "#64748b" }}>
                <span>{formatPrice(budgetConfig.min)}</span>
                <span>{formatPrice(budgetConfig.max)}</span>
              </div>
            </div>
          )}

          {/* Step 4: Location + Distance */}
          {step === 4 && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold" style={{ color: "#111827" }}>
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
                style={{ color: "#111827", background: "#ffffff", borderColor: "#cbd5e1" }}
                className="w-full rounded-lg border px-4 py-3 text-sm focus:outline-none"
              />
              <p className="text-xs" style={{ color: "#94a3b8" }}>
                L&apos;autocomplete Google Places sarà integrato in fase
                successiva
              </p>

              <div>
                <p className="mb-2 text-sm font-medium" style={{ color: "#1e293b" }}>
                  Distanza massima:
                </p>
                <div className="flex gap-2">
                  {DISTANCES.map((km) => (
                    <button
                      key={km}
                      onClick={() =>
                        setContext((p) => ({ ...p, max_distance_km: km }))
                      }
                      className="flex-1 rounded-lg border-2 px-3 py-2 text-sm font-semibold transition-all"
                      style={
                        context.max_distance_km === km
                          ? selectedStyle
                          : unselectedStyle
                      }
                    >
                      {km}km
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Features */}
          {step === 5 && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold" style={{ color: "#111827" }}>
                Cosa non può mancare?
              </h3>
              <p className="text-sm" style={{ color: "#64748b" }}>
                Seleziona tutto ciò che vuoi
              </p>
              <div className="grid grid-cols-2 gap-2">
                {FEATURES.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => toggleFeature(f.key)}
                    className="rounded-lg border-2 px-3 py-2.5 text-left text-sm transition-all"
                    style={
                      context.must_have.includes(f.key)
                        ? selectedStyle
                        : unselectedStyle
                    }
                  >
                    <span className="mr-1.5">{f.emoji}</span>
                    {f.label}
                  </button>
                ))}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium" style={{ color: "#1e293b" }}>
                  Esigenze speciali (opzionale)
                </label>
                <textarea
                  value={context.custom_note ?? ""}
                  onChange={(e) =>
                    setContext((p) => ({ ...p, custom_note: e.target.value }))
                  }
                  placeholder='es. "vicino a buone scuole elementari"'
                  rows={2}
                  style={{ color: "#111827", background: "#ffffff", borderColor: "#cbd5e1" }}
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none"
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
          className="text-sm font-medium disabled:invisible"
          style={{ color: "#64748b" }}
        >
          Indietro
        </button>

        <button
          onClick={next}
          className="rounded-lg px-6 py-2.5 text-sm font-semibold text-white"
          style={{ background: "#1e40af" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#1d3461")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#1e40af")}
        >
          {step === totalSteps - 1 ? "Avvia la ricerca" : "Avanti"}
        </button>
      </div>

      <button
        onClick={onSkip}
        className="mt-4 block w-full text-center text-xs"
        style={{ color: "#94a3b8" }}
      >
        Salta e parla direttamente con l&apos;AI
      </button>
    </div>
  );
}
