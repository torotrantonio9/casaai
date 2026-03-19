"use client";

import { useState } from "react";

export function ContactForm({
  listingId,
  listingTitle,
}: {
  listingId: string;
  listingTitle: string;
}) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSending(true);
    const fd = new FormData(e.currentTarget);

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listing_id: listingId,
          buyer_name: fd.get("name"),
          buyer_email: fd.get("email"),
          buyer_phone: fd.get("phone"),
          message: fd.get("message"),
          source: "contact_form",
        }),
      });

      if (res.ok) {
        setSent(true);
      }
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center">
        <p className="text-sm font-semibold text-green-700">
          Richiesta inviata!
        </p>
        <p className="mt-1 text-xs text-green-600">
          L&apos;agenzia ti contatter&agrave; al pi&ugrave; presto.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
    >
      <h3 className="text-lg font-semibold text-gray-900">
        Contatta l&apos;agenzia
      </h3>
      <p className="mt-1 text-xs text-gray-500">
        Per: {listingTitle}
      </p>

      <div className="mt-4 space-y-3">
        <input
          name="name"
          required
          placeholder="Il tuo nome"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
        <input
          name="email"
          type="email"
          required
          placeholder="Email"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
        <input
          name="phone"
          type="tel"
          placeholder="Telefono (opzionale)"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
        <textarea
          name="message"
          required
          rows={3}
          placeholder="Scrivi un messaggio..."
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={sending}
          className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {sending ? "Invio..." : "Invia richiesta"}
        </button>
      </div>
    </form>
  );
}
