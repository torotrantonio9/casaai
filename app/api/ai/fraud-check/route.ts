import { NextRequest, NextResponse } from "next/server";
import { chatJSON } from "@/lib/ai/claude";

interface FraudCheckResult {
  risk_level: "low" | "medium" | "high";
  flags: string[];
  recommendation: string;
}

export async function POST(request: NextRequest) {
  try {
    const { listing } = await request.json();

    if (!listing) {
      return NextResponse.json(
        { error: "listing è obbligatorio" },
        { status: 400 }
      );
    }

    const result = await chatJSON<FraudCheckResult>({
      systemPrompt: `Sei un analista antifrode per annunci immobiliari italiani.
Analizza l'annuncio e identifica potenziali problemi:
- Prezzo anomalo rispetto a zona/superficie (troppo basso o troppo alto)
- Descrizione generica, copiata o sospetta
- Dati incoerenti (es. 200mq per 1 locale)
- Segnali tipici di truffa immobiliare

Rispondi in JSON:
{
  "risk_level": "low" | "medium" | "high",
  "flags": ["lista problemi trovati"],
  "recommendation": "cosa fare"
}

Se non trovi problemi, risk_level = "low" e flags = [].`,
      userMessage: `ANNUNCIO DA VERIFICARE:\n${JSON.stringify(listing, null, 2)}`,
      maxTokens: 500,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("Fraud check error:", err);
    return NextResponse.json(
      { error: "Errore nel controllo antifrode" },
      { status: 500 }
    );
  }
}
