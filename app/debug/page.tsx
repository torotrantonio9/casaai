"use client";

import { useState, useEffect } from "react";

const DEBUG_SECRET = "casaai-debug";

interface EnvCheck {
  name: string;
  present: boolean;
}

interface TestResult {
  name: string;
  status: "pending" | "ok" | "error";
  message: string;
}

interface LogEntry {
  timestamp: string;
  message: string;
}

export default function DebugPage() {
  const [authorized, setAuthorized] = useState(false);
  const [envChecks, setEnvChecks] = useState<EnvCheck[]>([]);
  const [tests, setTests] = useState<TestResult[]>([]);
  const [dbStats, setDbStats] = useState<{ listings: number; users: number } | null>(null);
  const [seedResult, setSeedResult] = useState<string | null>(null);
  const [seedLoading, setSeedLoading] = useState(false);
  const [errorLogs, setErrorLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    // Check authorization
    const isDev = process.env.NODE_ENV === "development";
    const params = new URLSearchParams(window.location.search);
    if (isDev || params.get("secret") === DEBUG_SECRET) {
      setAuthorized(true);
    }

    // Load error logs from localStorage
    try {
      const logs = JSON.parse(localStorage.getItem("casaai_errors") ?? "[]");
      setErrorLogs(logs.slice(-5));
    } catch {
      // ignore
    }
  }, []);

  async function runDiagnostics() {
    // Check env vars via API
    setTests([]);
    setEnvChecks([]);
    setDbStats(null);

    try {
      const res = await fetch("/api/debug/check");
      if (res.ok) {
        const data = await res.json();
        setEnvChecks(data.env ?? []);
        setTests(data.tests ?? []);
        setDbStats(data.stats ?? null);
      } else {
        setTests([{ name: "API Debug", status: "error", message: `HTTP ${res.status}` }]);
      }
    } catch (err) {
      setTests([
        {
          name: "Connessione",
          status: "error",
          message: err instanceof Error ? err.message : "Errore di rete",
        },
      ]);
    }
  }

  async function runSeed() {
    setSeedLoading(true);
    setSeedResult(null);
    try {
      const res = await fetch("/api/seed");
      const data = await res.json();
      setSeedResult(res.ok ? data.message : `Errore: ${data.error}`);
    } catch (err) {
      setSeedResult(err instanceof Error ? err.message : "Errore di rete");
    } finally {
      setSeedLoading(false);
    }
  }

  if (!authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-400">Accesso non autorizzato. Usa ?secret=casaai-debug</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">Debug CasaAI</h1>
      <p className="mt-1 text-sm text-gray-500">Diagnostica di sistema</p>

      <button
        onClick={runDiagnostics}
        className="mt-4 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
      >
        Esegui diagnostica
      </button>

      {/* Env vars */}
      {envChecks.length > 0 && (
        <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-900">Variabili d&apos;ambiente</h2>
          <div className="mt-3 space-y-2">
            {envChecks.map((e) => (
              <div key={e.name} className="flex items-center justify-between text-sm">
                <code className="text-gray-700">{e.name}</code>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    e.present ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                  }`}
                >
                  {e.present ? "Configurata" : "Mancante"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tests */}
      {tests.length > 0 && (
        <div className="mt-4 rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-900">Test connessioni</h2>
          <div className="mt-3 space-y-2">
            {tests.map((t) => (
              <div key={t.name} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{t.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{t.message}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      t.status === "ok"
                        ? "bg-green-100 text-green-700"
                        : t.status === "error"
                          ? "bg-red-100 text-red-700"
                          : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {t.status === "ok" ? "OK" : t.status === "error" ? "ERRORE" : "..."}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DB stats */}
      {dbStats && (
        <div className="mt-4 rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-900">Database</h2>
          <div className="mt-3 grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-gray-50 p-3 text-center">
              <p className="text-2xl font-bold text-blue-600">{dbStats.listings}</p>
              <p className="text-xs text-gray-500">Annunci</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3 text-center">
              <p className="text-2xl font-bold text-blue-600">{dbStats.users}</p>
              <p className="text-xs text-gray-500">Utenti</p>
            </div>
          </div>
        </div>
      )}

      {/* Seed button */}
      <div className="mt-4 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-900">Seed Database</h2>
        <button
          onClick={runSeed}
          disabled={seedLoading}
          className="mt-3 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          {seedLoading ? "Inserimento..." : "Esegui Seed (20 annunci)"}
        </button>
        {seedResult && (
          <p className="mt-2 text-sm text-gray-600">{seedResult}</p>
        )}
      </div>

      {/* Error logs */}
      <div className="mt-4 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-900">
          Ultimi errori (localStorage)
        </h2>
        {errorLogs.length === 0 ? (
          <p className="mt-2 text-sm text-gray-400">Nessun errore registrato</p>
        ) : (
          <div className="mt-3 space-y-2">
            {errorLogs.map((log, i) => (
              <div key={i} className="rounded bg-red-50 p-2 text-xs">
                <span className="text-red-400">{log.timestamp}</span>
                <p className="text-red-700">{log.message}</p>
              </div>
            ))}
          </div>
        )}
        <button
          onClick={() => {
            localStorage.removeItem("casaai_errors");
            setErrorLogs([]);
          }}
          className="mt-2 text-xs text-gray-400 hover:text-gray-600"
        >
          Pulisci log
        </button>
      </div>
    </div>
  );
}
