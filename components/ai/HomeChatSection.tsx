"use client";

import { useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChatOnboarding, type ChatContext } from "./ChatOnboarding";
import { ChatWidget } from "./ChatWidget";

const FEATURE_LABELS: Record<string, string> = {
  has_elevator: "ascensore",
  has_parking: "posto auto",
  has_garden: "giardino",
  has_terrace: "terrazzo",
  has_cellar: "cantina",
  has_pool: "piscina",
  pet_friendly: "animali ammessi",
  accessible: "accessibile",
  ground_floor: "piano terra",
  energy_class_ab: "classe energetica A/B",
  high_floor: "piano alto",
  quiet_area: "zona silenziosa",
  near_metro: "vicino metro",
  near_schools: "vicino scuole",
  near_hospital: "vicino ospedale",
  green_area: "zona verde",
};

const WHO_LABELS: Record<string, string> = {
  solo: "persona sola",
  coppia: "coppia",
  famiglia: "famiglia",
  investimento: "investimento",
};

export function HomeChatSection() {
  const [phase, setPhase] = useState<"onboarding" | "chat">("onboarding");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [contextId, setContextId] = useState<string | null>(null);
  const [welcomeMessage, setWelcomeMessage] = useState<string | undefined>();
  const [autoMessage, setAutoMessage] = useState<string | undefined>();

  const handleComplete = useCallback(async (context: ChatContext) => {
    try {
      const res = await fetch("/api/chat/context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(context),
      });

      if (res.ok) {
        const data = await res.json();
        setSessionId(data.session_id);
        setContextId(data.context_id);

        // Build personalized welcome message
        const intentLabel =
          context.intent === "sale" ? "acquisto" : "affitto";
        const budgetLabel =
          context.intent === "rent"
            ? `\u20AC${context.budget_max.toLocaleString("it-IT")}/mese`
            : `\u20AC${context.budget_max.toLocaleString("it-IT")}`;
        const locationLabel = context.location?.label
          ? ` nel raggio di ${context.max_distance_km ?? 10}km da ${context.location.label}`
          : "";
        const whoLabel = context.who_is_searching
          ? ` per ${WHO_LABELS[context.who_is_searching] ?? context.who_is_searching}`
          : "";
        const roomsLabel = context.rooms_needed
          ? `, ${context.rooms_needed === 1 ? "monolocale" : `${context.rooms_needed} locali`}`
          : "";
        const smartLabel = context.smart_working
          ? ", con studio per smart working"
          : "";
        const featuresLabel =
          context.must_have.length > 0
            ? `, con ${context.must_have.map((f) => FEATURE_LABELS[f] ?? f).join(", ")}`
            : "";

        setWelcomeMessage(
          `Perfetto! Ho impostato la tua ricerca: ${intentLabel}${whoLabel} fino a ${budgetLabel}${roomsLabel}${locationLabel}${smartLabel}${featuresLabel}. Sto cercando le migliori proposte per te...`
        );

        // Auto-trigger first search with 500ms delay
        setTimeout(() => {
          setAutoMessage(
            "Mostrami subito i migliori annunci disponibili in base alle mie preferenze"
          );
        }, 500);
      }
    } catch {
      // If context save fails, still proceed to chat
    }
    setPhase("chat");
  }, []);

  const handleSkip = useCallback(() => {
    setPhase("chat");
  }, []);

  return (
    <section className="py-16" style={{ background: "linear-gradient(to bottom, #ffffff, #eff6ff)" }}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="mb-8 text-center text-3xl font-bold" style={{ color: "#111827" }}>
          {phase === "onboarding"
            ? "Iniziamo la ricerca"
            : "Parla con l'AI"}
        </h2>

        <AnimatePresence mode="wait">
          {phase === "onboarding" ? (
            <motion.div
              key="onboarding"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, x: -50 }}
              className="mx-auto max-w-lg rounded-2xl border bg-white p-6 shadow-lg"
              style={{ borderColor: "#e2e8f0" }}
            >
              <ChatOnboarding
                onComplete={handleComplete}
                onSkip={handleSkip}
              />
            </motion.div>
          ) : (
            <motion.div
              key="chat"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              className="mx-auto h-[550px] max-w-2xl"
            >
              <ChatWidget
                sessionId={sessionId}
                contextId={contextId}
                welcomeMessage={welcomeMessage}
                autoMessage={autoMessage}
                initialDisabled={!!autoMessage}
                inputPlaceholder="Vuoi affinare la ricerca? Chiedi all'AI..."
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
