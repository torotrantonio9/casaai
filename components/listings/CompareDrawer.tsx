"use client";

import { useCompareStore, type CompareListing } from "@/lib/stores/compare-store";
import { motion, AnimatePresence } from "framer-motion";

function formatPrice(price: number): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(price);
}

interface CompareRow {
  label: string;
  getValue: (l: CompareListing) => string | number | boolean;
  type: "text" | "number" | "boolean";
  higherIsBetter?: boolean;
}

const COMPARE_ROWS: CompareRow[] = [
  {
    label: "Prezzo",
    getValue: (l) => l.price,
    type: "number",
    higherIsBetter: false,
  },
  {
    label: "Superficie",
    getValue: (l) => l.surface_sqm,
    type: "number",
    higherIsBetter: true,
  },
  {
    label: "Locali",
    getValue: (l) => l.rooms,
    type: "number",
    higherIsBetter: true,
  },
  {
    label: "Bagni",
    getValue: (l) => l.bathrooms,
    type: "number",
    higherIsBetter: true,
  },
  {
    label: "Piano",
    getValue: (l) => l.floor ?? "--",
    type: "text",
  },
  {
    label: "Classe energ.",
    getValue: (l) => l.energy_class ?? "--",
    type: "text",
  },
  { label: "Posto auto", getValue: (l) => l.has_parking, type: "boolean" },
  { label: "Giardino", getValue: (l) => l.has_garden, type: "boolean" },
  { label: "Terrazzo", getValue: (l) => l.has_terrace, type: "boolean" },
  { label: "Ascensore", getValue: (l) => l.has_elevator, type: "boolean" },
  { label: "Cantina", getValue: (l) => l.has_cellar, type: "boolean" },
  {
    label: "\u20AC/m\u00B2",
    getValue: (l) =>
      l.surface_sqm > 0 ? Math.round(l.price / l.surface_sqm) : 0,
    type: "number",
    higherIsBetter: false,
  },
];

function CellValue({
  row,
  listing,
  allListings,
}: {
  row: CompareRow;
  listing: CompareListing;
  allListings: CompareListing[];
}) {
  const value = row.getValue(listing);

  if (row.type === "boolean") {
    return (
      <span className={value ? "text-green-600" : "text-red-400"}>
        {value ? "\u2713" : "\u2717"}
      </span>
    );
  }

  if (row.type === "number" && typeof value === "number" && allListings.length > 1) {
    const values = allListings.map((l) => row.getValue(l) as number);
    const best = row.higherIsBetter
      ? Math.max(...values)
      : Math.min(...values);
    const worst = row.higherIsBetter
      ? Math.min(...values)
      : Math.max(...values);

    let color = "text-gray-900";
    if (value === best && best !== worst) color = "text-green-600 font-semibold";
    if (value === worst && best !== worst) color = "text-red-500";

    const display =
      row.label === "Prezzo" || row.label === "\u20AC/m\u00B2"
        ? formatPrice(value)
        : `${value}`;

    return <span className={color}>{display}</span>;
  }

  return <span className="text-gray-900">{String(value)}</span>;
}

export function CompareDrawer() {
  const { listings, isOpen, closeDrawer, removeListing, clearAll } =
    useCompareStore();

  if (listings.length === 0) return null;

  return (
    <>
      {/* Floating bar when drawer is closed */}
      {!isOpen && (
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2"
        >
          <button
            onClick={() => useCompareStore.getState().openDrawer()}
            className="flex items-center gap-2 rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg hover:bg-blue-700"
          >
            Confronta ({listings.length}/4)
          </button>
        </motion.div>
      )}

      {/* Full drawer */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black"
              onClick={closeDrawer}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-x-0 bottom-0 z-50 max-h-[80vh] overflow-auto rounded-t-2xl bg-white shadow-2xl"
            >
              {/* Header */}
              <div className="sticky top-0 flex items-center justify-between border-b bg-white px-6 py-4">
                <h2 className="text-lg font-bold text-gray-900">
                  Confronta annunci ({listings.length}/4)
                </h2>
                <div className="flex gap-3">
                  <button
                    onClick={clearAll}
                    className="text-sm text-red-500 hover:text-red-700"
                  >
                    Svuota
                  </button>
                  <button
                    onClick={closeDrawer}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Chiudi
                  </button>
                </div>
              </div>

              {/* Comparison table */}
              <div className="overflow-x-auto p-6">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="w-32 pb-3 text-left text-xs font-medium text-gray-500" />
                      {listings.map((l) => (
                        <th
                          key={l.id}
                          className="min-w-[160px] pb-3 text-left"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="truncate text-sm font-semibold text-gray-900">
                                {l.title}
                              </p>
                              <p className="text-xs text-gray-500">{l.city}</p>
                            </div>
                            <button
                              onClick={() => removeListing(l.id)}
                              className="text-gray-400 hover:text-red-500"
                            >
                              &times;
                            </button>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARE_ROWS.map((row) => (
                      <tr key={row.label} className="border-t border-gray-100">
                        <td className="py-2.5 pr-4 text-xs font-medium text-gray-500">
                          {row.label}
                        </td>
                        {listings.map((l) => (
                          <td key={l.id} className="py-2.5 text-sm">
                            <CellValue
                              row={row}
                              listing={l}
                              allListings={listings}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
