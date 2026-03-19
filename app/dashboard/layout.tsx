"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview", icon: "\u{1F4CA}" },
  { href: "/dashboard/annunci", label: "Annunci", icon: "\u{1F3E0}" },
  { href: "/dashboard/lead", label: "Lead", icon: "\u{1F465}" },
  { href: "/dashboard/messaggi", label: "Messaggi", icon: "\u{1F4AC}" },
  { href: "/dashboard/importa", label: "Importa", icon: "\u{1F4E5}" },
  { href: "/dashboard/analytics", label: "Analytics", icon: "\u{1F4C8}" },
  { href: "/dashboard/team", label: "Team", icon: "\u{1F46B}" },
  { href: "/dashboard/abbonamento", label: "Abbonamento", icon: "\u{1F4B3}" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      {/* Sidebar */}
      <aside className="hidden w-56 flex-shrink-0 border-r border-gray-200 bg-gray-50 lg:block">
        <nav className="sticky top-16 space-y-1 p-4">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Mobile nav */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white lg:hidden">
        <nav className="flex overflow-x-auto">
          {NAV_ITEMS.slice(0, 5).map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${
                  isActive ? "text-blue-600" : "text-gray-500"
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-6 pb-20 lg:pb-6">{children}</main>
    </div>
  );
}
