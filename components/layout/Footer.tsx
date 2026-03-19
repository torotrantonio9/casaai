import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-gray-200 bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          <div>
            <h3 className="text-lg font-bold text-blue-600">CasaAI</h3>
            <p className="mt-2 text-sm text-gray-600">
              Il marketplace immobiliare intelligente. Trova la tua casa ideale
              con l&apos;AI.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-900">Cerca</h4>
            <ul className="mt-3 space-y-2">
              <li>
                <Link
                  href="/cerca"
                  className="text-sm text-gray-600 hover:text-blue-600"
                >
                  Cerca con AI
                </Link>
              </li>
              <li>
                <Link
                  href="/annunci"
                  className="text-sm text-gray-600 hover:text-blue-600"
                >
                  Tutti gli annunci
                </Link>
              </li>
              <li>
                <Link
                  href="/valutazione"
                  className="text-sm text-gray-600 hover:text-blue-600"
                >
                  Valutazione AI
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-900">
              Per agenzie
            </h4>
            <ul className="mt-3 space-y-2">
              <li>
                <Link
                  href="/registrati"
                  className="text-sm text-gray-600 hover:text-blue-600"
                >
                  Registra la tua agenzia
                </Link>
              </li>
              <li>
                <Link
                  href="/dashboard"
                  className="text-sm text-gray-600 hover:text-blue-600"
                >
                  Dashboard
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-900">Legale</h4>
            <ul className="mt-3 space-y-2">
              <li>
                <Link
                  href="/privacy"
                  className="text-sm text-gray-600 hover:text-blue-600"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/termini"
                  className="text-sm text-gray-600 hover:text-blue-600"
                >
                  Termini di servizio
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-gray-200 pt-8 text-center text-sm text-gray-500">
          &copy; {new Date().getFullYear()} CasaAI. Tutti i diritti riservati.
        </div>
      </div>
    </footer>
  );
}
