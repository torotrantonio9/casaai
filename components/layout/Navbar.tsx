import Link from "next/link";

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/80 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="text-xl font-bold text-blue-600">
          CasaAI
        </Link>

        <div className="hidden items-center gap-6 md:flex">
          <Link
            href="/cerca"
            className="text-sm font-medium text-gray-700 hover:text-blue-600"
          >
            Cerca casa
          </Link>
          <Link
            href="/annunci"
            className="text-sm font-medium text-gray-700 hover:text-blue-600"
          >
            Annunci
          </Link>
          <Link
            href="/valutazione"
            className="text-sm font-medium text-gray-700 hover:text-blue-600"
          >
            Valutazione AI
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-medium text-gray-700 hover:text-blue-600"
          >
            Accedi
          </Link>
          <Link
            href="/registrati"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Registrati
          </Link>
        </div>
      </nav>
    </header>
  );
}
