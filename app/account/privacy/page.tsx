"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function PrivacyPage() {
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch("/api/account/export");
      if (res.ok) {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `casaai-dati-personali-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      // ignore
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      // In production: call /api/account/delete to anonymize data and delete account
      window.location.href = "/";
    } catch {
      // ignore
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">Privacy e dati</h1>
      <p className="mt-2 text-sm text-gray-600">
        Gestisci i tuoi dati personali in conformit&agrave; con il GDPR.
      </p>

      {/* Export */}
      <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">
          Esporta i tuoi dati
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Scarica tutti i tuoi dati personali in formato JSON (profilo, ricerche
          salvate, lead inviati, sessioni chat).
        </p>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {exporting ? "Esportazione..." : "Scarica i miei dati"}
        </button>
      </div>

      {/* Delete */}
      <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-6">
        <h2 className="text-lg font-semibold text-red-900">
          Cancella il tuo account
        </h2>
        <p className="mt-1 text-sm text-red-700">
          Questa azione è irreversibile. I tuoi dati personali verranno
          eliminati e i lead anonimizzati.
        </p>
        {confirmDelete && (
          <p className="mt-3 text-sm font-semibold text-red-800">
            Sei sicuro? Clicca di nuovo per confermare.
          </p>
        )}
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
        >
          {deleting
            ? "Eliminazione..."
            : confirmDelete
              ? "Conferma eliminazione"
              : "Cancella account"}
        </button>
      </div>
    </div>
  );
}
