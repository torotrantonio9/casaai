import { NextRequest, NextResponse } from "next/server";

const FROM_EMAIL = process.env.FROM_EMAIL ?? "noreply@casaai.it";
const RESEND_API_KEY = process.env.RESEND_API_KEY;

interface EmailRequest {
  template: "listing_alert" | "visit_confirm" | "draft_reply";
  to: string;
  data: Record<string, unknown>;
}

function buildSubject(template: string, data: Record<string, unknown>): string {
  switch (template) {
    case "listing_alert":
      return `Nuovo annuncio: ${data.listing_title ?? "Immobile disponibile"}`;
    case "visit_confirm":
      return `Visita confermata: ${data.listing_title ?? ""}`;
    case "draft_reply":
      return `Risposta da ${data.agency_name ?? "CasaAI"} - ${data.listing_title ?? ""}`;
    default:
      return "CasaAI - Notifica";
  }
}

function buildHTML(template: string, data: Record<string, unknown>): string {
  const wrapper = (content: string) => `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333;">
  <div style="text-align:center;margin-bottom:24px;">
    <h2 style="color:#2563eb;margin:0;">CasaAI</h2>
  </div>
  ${content}
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
  <p style="font-size:12px;color:#999;text-align:center;">
    CasaAI - Il marketplace immobiliare intelligente<br>
    <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "https://casaai.it"}" style="color:#2563eb;">casaai.it</a>
  </p>
</body></html>`;

  switch (template) {
    case "listing_alert":
      return wrapper(`
        <h3>Nuovo annuncio compatibile con la tua ricerca!</h3>
        <div style="border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0;">
          <h4 style="margin:0 0 8px;">${data.listing_title ?? ""}</h4>
          <p style="margin:0;color:#2563eb;font-weight:bold;">${data.price ?? ""}</p>
          <p style="margin:4px 0 0;color:#666;font-size:14px;">${data.city ?? ""} - ${data.surface ?? ""}m² - ${data.rooms ?? ""} locali</p>
        </div>
        <a href="${data.listing_url ?? "#"}" style="display:inline-block;background:#2563eb;color:white;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Vedi annuncio</a>
      `);

    case "visit_confirm":
      return wrapper(`
        <h3>Visita confermata!</h3>
        <p>La visita per <strong>${data.listing_title ?? ""}</strong> è stata confermata.</p>
        <p><strong>Data:</strong> ${data.visit_date ?? ""}<br><strong>Ora:</strong> ${data.visit_time ?? ""}<br><strong>Indirizzo:</strong> ${data.address ?? ""}</p>
      `);

    case "draft_reply":
      return wrapper(`
        <p>${String(data.reply ?? "").replace(/\n/g, "<br>")}</p>
      `);

    default:
      return wrapper(`<p>${JSON.stringify(data)}</p>`);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: EmailRequest = await request.json();

    if (!body.to || !body.template) {
      return NextResponse.json(
        { error: "to e template sono obbligatori" },
        { status: 400 }
      );
    }

    const subject = buildSubject(body.template, body.data);
    const html = buildHTML(body.template, body.data);

    if (!RESEND_API_KEY) {
      // Development: log instead of sending
      console.log("Email (dev mode):", { to: body.to, subject });
      return NextResponse.json({
        success: true,
        dev_mode: true,
        message: "Email logged (no RESEND_API_KEY)",
      });
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: body.to,
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const error = await res.text();
      console.error("Resend error:", error);
      return NextResponse.json(
        { error: "Errore nell'invio email" },
        { status: 500 }
      );
    }

    const result = await res.json();
    return NextResponse.json({ success: true, id: result.id });
  } catch {
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
