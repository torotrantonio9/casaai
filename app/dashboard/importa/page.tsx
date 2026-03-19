"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

interface ImportJob {
  id: string;
  source: string;
  source_url: string | null;
  status: string;
  total_found: number;
  imported: number;
  updated: number;
  skipped: number;
  errors: { url: string; reason: string }[];
  created_at: string;
}

const SOURCE_OPTIONS = [
  { value: "idealista", label: "Idealista", placeholder: "https://www.idealista.it/pro/tua-agenzia/" },
  { value: "immobiliare_it", label: "Immobiliare.it", placeholder: "https://www.immobiliare.it/agenzie-immobiliari/citta/tua-agenzia/" },
  { value: "csv", label: "Carica CSV", placeholder: "" },
  { value: "url_manuale", label: "URL singolo annuncio", placeholder: "https://www.idealista.it/immobile/12345678/" },
];

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: "In attesa", color: "bg-gray-100 text-gray-700" },
  running: { label: "In corso", color: "bg-blue-100 text-blue-700" },
  completed: { label: "Completato", color: "bg-green-100 text-green-700" },
  failed: { label: "Fallito", color: "bg-red-100 text-red-700" },
  partial: { label: "Parziale", color: "bg-yellow-100 text-yellow-700" },
};

export default function ImportaPage() {
  const [source, setSource] = useState("idealista");
  const [sourceUrl, setSourceUrl] = useState("");
  const [schedule, setSchedule] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [expandedErrors, setExpandedErrors] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("import_jobs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    setJobs((data ?? []) as ImportJob[]);
  }, []);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  // Poll running jobs
  useEffect(() => {
    const hasRunning = jobs.some((j) => j.status === "running" || j.status === "pending");
    if (!hasRunning) return;

    const interval = setInterval(loadJobs, 3000);
    return () => clearInterval(interval);
  }, [jobs, loadJobs]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    try {
      const body: Record<string, unknown> = { source, schedule: schedule || null };

      if (source === "csv" && csvFile) {
        const text = await csvFile.text();
        body.csv_data = btoa(unescape(encodeURIComponent(text)));
      } else {
        body.source_url = sourceUrl;
      }

      await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      setSourceUrl("");
      setCsvFile(null);
      loadJobs();
    } catch {
      // Handle error
    } finally {
      setSubmitting(false);
    }
  }

  const selectedSource = SOURCE_OPTIONS.find((s) => s.value === source);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Importa annunci</h1>
      <p className="mt-1 text-sm text-gray-500">
        Importa i tuoi annunci da portali esterni o file CSV
      </p>

      {/* Import form */}
      <form
        onSubmit={handleSubmit}
        className="mt-6 rounded-xl border border-gray-200 bg-white p-5"
      >
        <h2 className="text-sm font-semibold text-gray-900">
          Configura import
        </h2>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Fonte
            </label>
            <div className="flex flex-wrap gap-2">
              {SOURCE_OPTIONS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setSource(s.value)}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-all ${
                    source === s.value
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {source === "csv" ? (
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                File CSV
              </label>
              <input
                type="file"
                accept=".csv,.tsv"
                onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          ) : (
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                URL
              </label>
              <input
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder={selectedSource?.placeholder}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Frequenza sync
            </label>
            <select
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="">Manuale (solo questa volta)</option>
              <option value="0 6 * * *">Ogni giorno alle 6:00</option>
              <option value="0 6 * * 1">Ogni lunedì alle 6:00</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="mt-4 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? "Avvio..." : "Avvia import"}
        </button>
      </form>

      {/* Jobs table */}
      <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="border-b px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">
            Job storici
          </h2>
        </div>
        {jobs.length === 0 ? (
          <p className="p-5 text-center text-sm text-gray-400">
            Nessun import effettuato
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-gray-50 text-left text-xs text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Fonte</th>
                <th className="px-4 py-3 font-medium">Data</th>
                <th className="px-4 py-3 font-medium">Trovati</th>
                <th className="px-4 py-3 font-medium">Importati</th>
                <th className="px-4 py-3 font-medium">Errori</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {jobs.map((job) => (
                <>
                  <tr key={job.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {job.source}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(job.created_at).toLocaleString("it-IT")}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {job.total_found}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {job.imported}
                    </td>
                    <td className="px-4 py-3">
                      {job.errors && job.errors.length > 0 ? (
                        <button
                          onClick={() =>
                            setExpandedErrors(
                              expandedErrors === job.id ? null : job.id
                            )
                          }
                          className="text-red-500 hover:text-red-700"
                        >
                          {job.errors.length} errori
                        </button>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CONFIG[job.status]?.color ?? ""}`}
                      >
                        {STATUS_CONFIG[job.status]?.label ?? job.status}
                      </span>
                      {(job.status === "running" || job.status === "pending") && (
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                          <div
                            className="h-full animate-pulse rounded-full bg-blue-500"
                            style={{
                              width:
                                job.total_found > 0
                                  ? `${((job.imported + job.skipped) / job.total_found) * 100}%`
                                  : "30%",
                            }}
                          />
                        </div>
                      )}
                    </td>
                  </tr>
                  {expandedErrors === job.id && job.errors.length > 0 && (
                    <tr key={`${job.id}-errors`}>
                      <td colSpan={6} className="bg-red-50 px-4 py-3">
                        <ul className="space-y-1 text-xs text-red-700">
                          {job.errors.map((err, i) => (
                            <li key={i}>
                              <span className="font-medium">{err.url}</span>:{" "}
                              {err.reason}
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
