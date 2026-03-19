import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="text-2xl font-bold text-blue-600">
            CasaAI
          </Link>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
          {children}
        </div>
      </div>
    </div>
  );
}
