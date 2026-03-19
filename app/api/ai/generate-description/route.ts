import { NextRequest, NextResponse } from "next/server";
import { chatJSON } from "@/lib/ai/claude";
import { DESCRIPTION_SYSTEM_PROMPT } from "@/lib/ai/prompts";

const TONE_LABELS: Record<string, string> = {
  professional: "Professionale: formale, tecnico, affidabile",
  elegant: "Elegante: raffinato, evocativo, sofisticato",
  modern: "Giovane: fresco, dinamico, contemporaneo",
};

export async function POST(request: NextRequest) {
  try {
    const { listing_data, tone, type } = await request.json();

    if (!listing_data) {
      return NextResponse.json(
        { error: "listing_data è obbligatorio" },
        { status: 400 }
      );
    }

    const toneInstruction = TONE_LABELS[tone] ?? TONE_LABELS.professional;
    const typeLabel = type === "rent" ? "affitto" : "vendita";

    const details = Object.entries(listing_data)
      .filter(([, v]) => v != null && v !== "" && v !== false)
      .map(([k, v]) => {
        if (v === true) return k.replace("has_", "").replace("_", " ");
        return `${k}: ${v}`;
      })
      .join("\n");

    const userMessage = `Genera una descrizione per ${typeLabel}.\n\nTono richiesto: ${toneInstruction}\n\nCARATTERISTICHE:\n${details}`;

    const result = await chatJSON<{ description: string; word_count: number }>({
      systemPrompt: `${DESCRIPTION_SYSTEM_PROMPT}\n\nRispondi in JSON: {"description": "...", "word_count": N}`,
      userMessage,
      maxTokens: 1000,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("Generate description error:", err);
    return NextResponse.json(
      { error: "Errore nella generazione" },
      { status: 500 }
    );
  }
}
