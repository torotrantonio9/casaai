"use client";

import Link from "next/link";
import { useCompareStore, type CompareListing } from "@/lib/stores/compare-store";

interface ListingCardProps {
  listing: {
    id: string;
    title: string;
    price: number;
    city: string;
    province: string;
    surface_sqm: number;
    rooms: number;
    bathrooms: number;
    floor: number | null;
    photos: string[];
    type: string;
    property_type: string;
    energy_class: string | null;
    has_parking: boolean;
    has_garden: boolean;
    has_terrace: boolean;
    has_elevator: boolean;
    has_cellar: boolean;
    is_featured?: boolean;
    ai_valuation_confidence?: string;
  };
  showCompare?: boolean;
}

function formatPrice(price: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(price);
}

const PROPERTY_LABELS: Record<string, string> = {
  apartment: "Appartamento",
  house: "Casa",
  villa: "Villa",
  commercial: "Commerciale",
  land: "Terreno",
  garage: "Garage",
  other: "Altro",
};

export function ListingCard({ listing, showCompare = true }: ListingCardProps) {
  const { listings: compareList, addListing, removeListing } = useCompareStore();
  const isInCompare = compareList.some((l) => l.id === listing.id);

  function toggleCompare() {
    if (isInCompare) {
      removeListing(listing.id);
    } else {
      addListing(listing as CompareListing);
    }
  }

  return (
    <div
      className={`group relative overflow-hidden rounded-xl border bg-white shadow-sm transition-shadow hover:shadow-md ${
        listing.is_featured ? "border-blue-300 ring-1 ring-blue-100" : "border-gray-200"
      }`}
    >
      {/* Photo */}
      <Link href={`/annunci/${listing.id}`} className="block">
        <div className="relative h-48 bg-gray-100">
          {listing.photos.length > 0 ? (
            <div className="h-full w-full bg-gray-200" />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-gray-400">
              Nessuna foto
            </div>
          )}

          {/* Badges */}
          <div className="absolute left-2 top-2 flex gap-1">
            {listing.is_featured && (
              <span className="rounded bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white">
                In evidenza
              </span>
            )}
            <span className="rounded bg-white/90 px-2 py-0.5 text-xs font-medium text-gray-700">
              {PROPERTY_LABELS[listing.property_type] ?? listing.property_type}
            </span>
          </div>

          {listing.ai_valuation_confidence && (
            <div className="absolute right-2 top-2">
              <span className="rounded bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                AI {listing.ai_valuation_confidence}
              </span>
            </div>
          )}
        </div>
      </Link>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold text-blue-600">
              {formatPrice(listing.price)}
            </p>
            <Link
              href={`/annunci/${listing.id}`}
              className="mt-0.5 block truncate text-sm font-semibold text-gray-900 hover:text-blue-600"
            >
              {listing.title}
            </Link>
            <p className="mt-0.5 text-xs text-gray-500">
              {listing.city}, {listing.province}
            </p>
          </div>
        </div>

        {/* Features */}
        <div className="mt-3 flex items-center gap-3 text-xs text-gray-600">
          <span>{listing.surface_sqm} m²</span>
          <span>&middot;</span>
          <span>{listing.rooms} locali</span>
          <span>&middot;</span>
          <span>{listing.bathrooms} bagni</span>
          {listing.floor != null && (
            <>
              <span>&middot;</span>
              <span>Piano {listing.floor}</span>
            </>
          )}
        </div>

        {/* Feature icons */}
        <div className="mt-2 flex gap-1">
          {listing.has_parking && (
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
              Posto auto
            </span>
          )}
          {listing.has_garden && (
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
              Giardino
            </span>
          )}
          {listing.has_terrace && (
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
              Terrazzo
            </span>
          )}
          {listing.energy_class && (
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
              {listing.energy_class}
            </span>
          )}
        </div>

        {/* Compare checkbox */}
        {showCompare && (
          <div className="mt-3 border-t border-gray-100 pt-2">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-gray-500">
              <input
                type="checkbox"
                checked={isInCompare}
                onChange={toggleCompare}
                className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600"
              />
              Confronta
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
