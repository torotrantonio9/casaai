import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ContactForm } from "./ContactForm";

interface Listing {
  id: string;
  title: string;
  description: string;
  ai_description: string | null;
  type: string;
  property_type: string;
  price: number;
  price_period: string | null;
  surface_sqm: number;
  rooms: number;
  bathrooms: number;
  floor: number | null;
  total_floors: number | null;
  year_built: number | null;
  energy_class: string | null;
  heating_type: string | null;
  has_parking: boolean;
  has_garden: boolean;
  has_terrace: boolean;
  has_elevator: boolean;
  has_cellar: boolean;
  address: string;
  city: string;
  province: string;
  neighborhood: string | null;
  photos: string[];
  lat: number | null;
  lng: number | null;
  ai_valuation: number | null;
  ai_valuation_confidence: string | null;
  views_count: number;
  agency_id: string | null;
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

async function getListing(id: string): Promise<Listing | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("listings")
    .select("*")
    .eq("id", id)
    .eq("status", "active")
    .single();
  return data as Listing | null;
}

async function getSimilarListings(listing: Listing) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("listings")
    .select("id, title, price, city, surface_sqm, rooms, photos, type, property_type")
    .eq("status", "active")
    .eq("city", listing.city)
    .eq("type", listing.type)
    .neq("id", listing.id)
    .limit(4);
  return data ?? [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const listing = await getListing(id);
  if (!listing) return { title: "Annuncio non trovato" };

  const title = `${listing.title} - ${formatPrice(listing.price)} - CasaAI`;
  const description = (listing.ai_description ?? listing.description ?? "").slice(0, 160);

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      url: `${process.env.NEXT_PUBLIC_APP_URL}/annunci/${id}`,
    },
  };
}

export default async function AnnuncioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const listing = await getListing(id);
  if (!listing) notFound();

  const similar = await getSimilarListings(listing);
  const desc = listing.ai_description ?? listing.description ?? "";
  const hasAiDesc = !!listing.ai_description;

  const specs = [
    { label: "Locali", value: listing.rooms },
    { label: "Bagni", value: listing.bathrooms },
    { label: "Superficie", value: `${listing.surface_sqm} m\u00B2` },
    { label: "Piano", value: listing.floor != null ? `${listing.floor}${listing.total_floors ? `/${listing.total_floors}` : ""}` : "--" },
    { label: "Anno", value: listing.year_built ?? "--" },
    { label: "Energia", value: listing.energy_class ?? "--" },
  ];

  const features = [
    listing.has_parking && "Posto auto",
    listing.has_garden && "Giardino",
    listing.has_terrace && "Terrazzo",
    listing.has_elevator && "Ascensore",
    listing.has_cellar && "Cantina",
    listing.heating_type && `Riscaldamento: ${listing.heating_type}`,
  ].filter(Boolean);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Breadcrumb */}
      <nav className="mb-4 text-sm text-gray-500">
        <Link href="/" className="hover:text-blue-600">Home</Link>
        {" > "}
        <a href="/cerca" className="hover:text-blue-600">{listing.city}</a>
        {" > "}
        <span className="text-gray-700">{PROPERTY_LABELS[listing.property_type]}</span>
      </nav>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {/* Photo gallery */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="flex h-72 items-center justify-center rounded-xl bg-gray-100 text-gray-400 sm:col-span-2 sm:h-96">
              {listing.photos.length > 0
                ? "Galleria foto"
                : "Nessuna foto disponibile"}
            </div>
          </div>

          {/* Title + price */}
          <div className="mt-6">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {listing.title}
                </h1>
                <p className="mt-1 text-sm text-gray-500">
                  {listing.address}, {listing.city} ({listing.province})
                  {listing.neighborhood && ` - ${listing.neighborhood}`}
                </p>
              </div>
              <p className="text-2xl font-bold text-blue-600">
                {formatPrice(listing.price)}
                {listing.price_period && (
                  <span className="text-sm font-normal text-gray-500">
                    /{listing.price_period === "month" ? "mese" : listing.price_period}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Specs grid */}
          <div className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-6">
            {specs.map((s) => (
              <div key={s.label} className="rounded-lg bg-gray-50 p-3 text-center">
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className="text-lg font-semibold text-gray-900">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Features */}
          {features.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {features.map((f) => (
                <span
                  key={f as string}
                  className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700"
                >
                  {f}
                </span>
              ))}
            </div>
          )}

          {/* Description */}
          <div className="mt-6">
            <h2 className="text-lg font-semibold text-gray-900">Descrizione</h2>
            {hasAiDesc && (
              <span className="mt-1 inline-block rounded bg-purple-50 px-2 py-0.5 text-xs text-purple-700">
                Ottimizzata con AI
              </span>
            )}
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-700">
              {desc}
            </p>
          </div>

          {/* Map */}
          <div className="mt-6">
            <h2 className="text-lg font-semibold text-gray-900">Posizione</h2>
            <div className="mt-3 flex h-64 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-400">
              Mappa Mapbox (lat: {listing.lat ?? "N/A"}, lng: {listing.lng ?? "N/A"})
            </div>
          </div>

          {/* AI Valuation */}
          {listing.ai_valuation && (
            <div className="mt-6 rounded-xl border border-purple-200 bg-purple-50 p-5">
              <h2 className="text-sm font-semibold text-purple-800">
                Valutazione AI
              </h2>
              <p className="mt-1 text-2xl font-bold text-purple-700">
                {formatPrice(listing.ai_valuation)}
              </p>
              {listing.ai_valuation_confidence && (
                <p className="mt-1 text-xs text-purple-600">
                  Affidabilit&agrave;: {listing.ai_valuation_confidence}
                </p>
              )}
            </div>
          )}

          {/* Similar listings */}
          {similar.length > 0 && (
            <div className="mt-8">
              <h2 className="text-lg font-semibold text-gray-900">
                Annunci simili
              </h2>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {similar.map((s) => (
                  <a
                    key={s.id}
                    href={`/annunci/${s.id}`}
                    className="rounded-lg border border-gray-200 p-3 transition-shadow hover:shadow-md"
                  >
                    <div className="h-28 rounded-md bg-gray-100" />
                    <p className="mt-2 text-sm font-semibold text-gray-900">
                      {s.title}
                    </p>
                    <p className="text-sm font-bold text-blue-600">
                      {formatPrice(s.price)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {s.city} &middot; {s.surface_sqm}m&sup2; &middot; {s.rooms} locali
                    </p>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="sticky top-20 space-y-4">
            <ContactForm listingId={listing.id} listingTitle={listing.title} />

            {/* QR Code */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
              <p className="text-xs text-gray-500">QR Code annuncio</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/listings/${listing.id}/qr`}
                alt="QR Code"
                width={120}
                height={120}
                className="mx-auto mt-2"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Schema.org structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "RealEstateListing",
            name: listing.title,
            description: desc.slice(0, 300),
            url: `${process.env.NEXT_PUBLIC_APP_URL}/annunci/${listing.id}`,
            datePosted: listing.year_built ? `${listing.year_built}-01-01` : undefined,
            offers: {
              "@type": "Offer",
              price: listing.price,
              priceCurrency: "EUR",
            },
            address: {
              "@type": "PostalAddress",
              streetAddress: listing.address,
              addressLocality: listing.city,
              addressRegion: listing.province,
              addressCountry: "IT",
            },
            floorSize: listing.surface_sqm
              ? { "@type": "QuantitativeValue", value: listing.surface_sqm, unitCode: "MTK" }
              : undefined,
            numberOfRooms: listing.rooms,
          }),
        }}
      />
    </div>
  );
}
