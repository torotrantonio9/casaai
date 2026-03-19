import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-24">
      <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-blue-50">
        <svg
          className="h-12 w-12 text-blue-400"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.5V3.545M12.75 21h7.5V10.75M2.25 21h1.5m18 0h-18M2.25 9l4.5-1.636M18.75 3l-1.5.545m0 6.205l3 1m1.5.5l-1.5-.5M6.75 7.364V3h-3v18m3-13.636l10.5-3.819"
          />
        </svg>
      </div>

      <h1 className="mb-2 text-4xl font-bold text-gray-900">404</h1>
      <h2 className="mb-4 text-xl font-semibold text-gray-700">
        Pagina non trovata
      </h2>
      <p className="mb-8 max-w-md text-center text-gray-500">
        La pagina che stai cercando non esiste o è stata spostata. Prova a
        cercare la tua casa ideale con il nostro assistente AI.
      </p>

      <div className="flex gap-3">
        <Link
          href="/"
          className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          Torna alla homepage
        </Link>
        <Link
          href="/cerca"
          className="rounded-lg border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cerca con AI
        </Link>
      </div>
    </div>
  );
}
