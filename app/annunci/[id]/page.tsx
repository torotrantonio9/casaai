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

const GALLERY_COLORS: Record<string, string> = {
  apartment: "#dbeafe",
  villa: "#dcfce7",
  house: "#fef3c7",
  commercial: "#f3e8ff",
};

function generateWhyReasons(listing: Listing): string[] {
  const reasons: string[] = [];

  // Price per sqm
  if (listing.surface_sqm > 0) {
    const pricePerSqm = Math.round(listing.price / listing.surface_sqm);
    reasons.push(
      `Prezzo al metro quadro: ${new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(pricePerSqm)}/m\u00B2`
    );
  }

  // Floor and elevator
  if (listing.floor != null && listing.floor > 0) {
    if (listing.has_elevator) {
      reasons.push(`Piano ${listing.floor} con ascensore \u2014 comodo e luminoso`);
    } else if (listing.floor <= 2) {
      reasons.push(`Piano ${listing.floor} \u2014 facilmente accessibile`);
    }
  } else if (listing.floor === 0) {
    reasons.push("Piano terra \u2014 accesso diretto senza scale");
  }

  // Parking / garden / terrace
  if (listing.has_garden) {
    reasons.push("Giardino privato \u2014 ideale per famiglie e animali");
  }
  if (listing.has_terrace) {
    reasons.push("Terrazzo \u2014 spazio esterno per relax e pranzi all\u2019aperto");
  }
  if (listing.has_parking) {
    reasons.push("Posto auto incluso \u2014 nessun problema di parcheggio");
  }

  // Energy class
  if (listing.energy_class) {
    const good = ["A4", "A3", "A2", "A1", "A", "B"];
    if (good.includes(listing.energy_class.toUpperCase())) {
      reasons.push(`Classe energetica ${listing.energy_class.toUpperCase()} \u2014 consumi ridotti e bollette basse`);
    } else {
      reasons.push(`Classe energetica ${listing.energy_class.toUpperCase()} \u2014 margine di miglioramento con bonus fiscali`);
    }
  }

  // Year built
  if (listing.year_built) {
    const age = new Date().getFullYear() - listing.year_built;
    if (age <= 5) {
      reasons.push("Costruzione recente \u2014 impianti moderni e materiali di qualit\u00E0");
    } else if (age <= 15) {
      reasons.push(`Costruito nel ${listing.year_built} \u2014 buono stato e manutenzione recente`);
    }
  }

  // Neighborhood
  if (listing.neighborhood) {
    reasons.push(`Zona ${listing.neighborhood} \u2014 quartiere ben servito`);
  }

  // Cellar
  if (listing.has_cellar) {
    reasons.push("Cantina inclusa \u2014 spazio extra per deposito");
  }

  // Return 3-5 reasons
  return reasons.slice(0, 5);
}

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

  const bgColor = GALLERY_COLORS[listing.property_type] || "#f3f4f6";
  const emoji = listing.property_type === "apartment" ? "\uD83C\uDFE2" : listing.has_garden ? "\uD83C\uDF3F" : "\uD83C\uDFE0";

  const whyReasons = generateWhyReasons(listing);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Breadcrumb */}
      <nav className="mb-4 text-sm text-gray-500">
        <Link href="/" className="hover:text-blue-600">Home</Link>
        {" > "}
        <Link href={`/annunci?city=${listing.city}`} className="hover:text-blue-600">{listing.city}</Link>
        {" > "}
        <span className="text-gray-700">{PROPERTY_LABELS[listing.property_type] || listing.property_type}</span>
      </nav>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {/* Photo gallery - colorful placeholders */}
          <div className="grid grid-cols-3 gap-2">
            {/* Large main photo */}
            <div
              className="col-span-2 row-span-2 flex h-72 items-center justify-center rounded-xl text-6xl sm:h-96"
              style={{ backgroundColor: bgColor }}
            >
              {emoji}
            </div>
            {/* 3 small photos */}
            <div
              className="flex h-[8.5rem] items-center justify-center rounded-xl text-3xl sm:h-[11.75rem]"
              style={{ backgroundColor: bgColor, opacity: 0.85 }}
            >
              {emoji}
            </div>
            <div
              className="flex h-[8.5rem] items-center justify-center rounded-xl text-3xl sm:h-[11.75rem]"
              style={{ backgroundColor: bgColor, opacity: 0.7 }}
            >
              {emoji}
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

          {/* "Perche questa casa" section */}
          {whyReasons.length > 0 && (
            <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50 p-5">
              <h2 className="text-sm font-semibold text-blue-800 flex items-center gap-2">
                ✦ Perch&eacute; questa casa
              </h2>
              <ul className="mt-3 space-y-2">
                {whyReasons.map((reason, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-blue-900">
                    <span className="mt-0.5 text-blue-500">&bull;</span>
                    {reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Map - OpenStreetMap */}
          {listing.lat && listing.lng && (
            <div className="mt-6">
              <h2 className="text-lg font-semibold text-gray-900">Posizione</h2>
              <div className="mt-3 overflow-hidden rounded-xl border border-gray-200">
                <iframe
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${listing.lng - 0.01},${listing.lat - 0.005},${listing.lng + 0.01},${listing.lat + 0.005}&layer=mapnik&marker=${listing.lat},${listing.lng}`}
                  width="100%"
                  height="300"
                  style={{ border: 0 }}
                  loading="lazy"
                />
              </div>
            </div>
          )}

          {/* Fallback when no coordinates */}
          {(!listing.lat || !listing.lng) && (
            <div className="mt-6">
              <h2 className="text-lg font-semibold text-gray-900">Posizione</h2>
              <div className="mt-3 flex h-64 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-400">
                Posizione non disponibile
              </div>
            </div>
          )}

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

            {/* WhatsApp button */}
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Ciao, sono interessato all'annuncio "${listing.title}" su CasaAI: ${process.env.NEXT_PUBLIC_APP_URL || ''}/annunci/${listing.id}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-500 py-2.5 text-sm font-semibold text-white hover:bg-green-600"
            >
              💬 Contatta via WhatsApp
            </a>

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
