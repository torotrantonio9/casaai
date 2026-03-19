import { NextRequest, NextResponse } from "next/server";
import { chatJSON } from "@/lib/ai/claude";

interface DraftReplyRequest {
  lead_message: string;
  listing_title: string;
  agent_name?: string;
  tone: "professional" | "friendly" | "concise";
}

interface DraftReplyResponse {
  reply: string;
  tone_used: string;
}

const TONE_INSTRUCTIONS: Record<string, string> = {
  professional:
    "Tono professionale e formale. Usa il Lei. Breve e diretto.",
  friendly:
    "Tono cordiale e caloroso. Usa il tu. Mostra entusiasmo per l'immobile.",
  concise:
    "Tono ultra-conciso. Massimo 2 frasi. Solo informazioni essenziali.",
};

export async function POST(request: NextRequest) {
  try {
    const body: DraftReplyRequest = await request.json();

    if (!body.lead_message || !body.listing_title) {
      return NextResponse.json(
        { error: "lead_message e listing_title sono obbligatori" },
        { status: 400 }
      );
    }

    const toneInstruction =
      TONE_INSTRUCTIONS[body.tone] ?? TONE_INSTRUCTIONS.professional;
    const agentName = body.agent_name ?? "l'agenzia";

    const result = await chatJSON<DraftReplyResponse>({
      systemPrompt: `Sei un assistente AI che scrive bozze di risposta email per agenti immobiliari italiani.

REGOLE:
- Massimo 3 frasi
- ${toneInstruction}
- Rispondi al messaggio del buyer in modo pertinente
- Menziona l'immobile specifico
- Proponi un'azione concreta (visita, telefonata, info aggiuntive)
- NON inventare dettagli sull'immobile
- Firma come "${agentName}"

Rispondi in JSON: {"reply": "...", "tone_used": "..."}`,
      userMessage: `MESSAGGIO DEL BUYER:\n"${body.lead_message}"\n\nIMMOBILE: ${body.listing_title}`,
      maxTokens: 400,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("Draft reply error:", err);
    return NextResponse.json(
      { error: "Errore nella generazione della bozza" },
      { status: 500 }
    );
  }
}
