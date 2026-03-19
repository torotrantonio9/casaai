"use client";

import { useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChatOnboarding, type ChatContext } from "./ChatOnboarding";
import { ChatWidget } from "./ChatWidget";

export function HomeChatSection() {
  const [phase, setPhase] = useState<"onboarding" | "chat">("onboarding");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [contextId, setContextId] = useState<string | null>(null);
  const [welcomeMessage, setWelcomeMessage] = useState<string | undefined>();

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
        const featuresLabel =
          context.must_have.length > 0
            ? `, con ${context.must_have.map((f) => f.replace("has_", "").replace("_", " ")).join(", ")}`
            : "";

        setWelcomeMessage(
          `Ciao! Ho già impostato la tua ricerca: ${intentLabel} fino a ${budgetLabel}${locationLabel}${featuresLabel}. Vuoi dirmi altro o vuoi che ti mostri subito le prime proposte?`
        );
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
    <section className="bg-gradient-to-b from-white to-blue-50 py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="mb-8 text-center text-3xl font-bold text-gray-900">
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
              className="mx-auto max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-lg"
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
              className="mx-auto h-[500px] max-w-2xl"
            >
              <ChatWidget
                sessionId={sessionId}
                contextId={contextId}
                welcomeMessage={welcomeMessage}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
