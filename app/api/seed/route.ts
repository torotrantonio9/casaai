import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const SEED_SECRET = process.env.SEED_SECRET ?? "dev-seed-secret";

const LISTINGS_DATA = [
  { title: "Trilocale luminoso in Via Toledo", type: "sale" as const, property_type: "apartment" as const, price: 285000, surface_sqm: 95, rooms: 3, bathrooms: 1, floor: 4, total_floors: 6, year_built: 1960, energy_class: "D", heating_type: "autonomo", has_parking: false, has_garden: false, has_terrace: true, has_elevator: true, has_cellar: true, address: "Via Toledo 234", city: "Napoli", province: "NA", zip_code: "80134", lat: 40.8438, lng: 14.2488, neighborhood: "Centro Storico", photos: [], status: "active" },
  { title: "Bilocale ristrutturato Vomero", type: "sale" as const, property_type: "apartment" as const, price: 220000, surface_sqm: 65, rooms: 2, bathrooms: 1, floor: 3, total_floors: 5, year_built: 1975, energy_class: "C", heating_type: "autonomo", has_parking: false, has_garden: false, has_terrace: false, has_elevator: true, has_cellar: false, address: "Via Luca Giordano 78", city: "Napoli", province: "NA", zip_code: "80127", lat: 40.8542, lng: 14.2350, neighborhood: "Vomero", photos: [], status: "active" },
  { title: "Appartamento vista mare Posillipo", type: "sale" as const, property_type: "apartment" as const, price: 520000, surface_sqm: 130, rooms: 4, bathrooms: 2, floor: 6, total_floors: 7, year_built: 1985, energy_class: "C", heating_type: "autonomo", has_parking: true, has_garden: false, has_terrace: true, has_elevator: true, has_cellar: true, address: "Via Posillipo 120", city: "Napoli", province: "NA", zip_code: "80123", lat: 40.8150, lng: 14.2000, neighborhood: "Posillipo", photos: [], status: "active" },
  { title: "Monolocale Chiaia per investimento", type: "sale" as const, property_type: "apartment" as const, price: 135000, surface_sqm: 38, rooms: 1, bathrooms: 1, floor: 2, total_floors: 4, year_built: 1950, energy_class: "F", heating_type: "autonomo", has_parking: false, has_garden: false, has_terrace: false, has_elevator: false, has_cellar: false, address: "Via Chiaia 192", city: "Napoli", province: "NA", zip_code: "80121", lat: 40.8370, lng: 14.2460, neighborhood: "Chiaia", photos: [], status: "active" },
  { title: "Quadrilocale con box Fuorigrotta", type: "sale" as const, property_type: "apartment" as const, price: 310000, surface_sqm: 120, rooms: 4, bathrooms: 2, floor: 5, total_floors: 8, year_built: 2005, energy_class: "B", heating_type: "centralizzato", has_parking: true, has_garden: false, has_terrace: true, has_elevator: true, has_cellar: true, address: "Via Giulio Cesare 45", city: "Napoli", province: "NA", zip_code: "80125", lat: 40.8270, lng: 14.1930, neighborhood: "Fuorigrotta", photos: [], status: "active" },
  { title: "Bilocale in affitto Centro Direzionale", type: "rent" as const, property_type: "apartment" as const, price: 750, surface_sqm: 55, rooms: 2, bathrooms: 1, floor: 10, total_floors: 15, year_built: 1995, energy_class: "C", heating_type: "centralizzato", has_parking: true, has_garden: false, has_terrace: false, has_elevator: true, has_cellar: false, address: "Isola F3", city: "Napoli", province: "NA", zip_code: "80143", lat: 40.8580, lng: 14.2830, neighborhood: "Centro Direzionale", photos: [], status: "active" },
  { title: "Villa con giardino Caserta Vecchia", type: "sale" as const, property_type: "villa" as const, price: 380000, surface_sqm: 200, rooms: 5, bathrooms: 3, floor: 0, total_floors: 2, year_built: 1990, energy_class: "D", heating_type: "autonomo", has_parking: true, has_garden: true, has_terrace: true, has_elevator: false, has_cellar: true, address: "Via Caserta Vecchia 15", city: "Caserta", province: "CE", zip_code: "81100", lat: 41.0882, lng: 14.3260, neighborhood: "Caserta Vecchia", photos: [], status: "active" },
  { title: "Trilocale nuovo Caserta centro", type: "sale" as const, property_type: "apartment" as const, price: 195000, surface_sqm: 85, rooms: 3, bathrooms: 1, floor: 2, total_floors: 4, year_built: 2022, energy_class: "A2", heating_type: "autonomo", has_parking: true, has_garden: false, has_terrace: true, has_elevator: true, has_cellar: true, address: "Corso Trieste 88", city: "Caserta", province: "CE", zip_code: "81100", lat: 41.0725, lng: 14.3331, neighborhood: "Centro", photos: [], status: "active" },
  { title: "Appartamento Aversa zona università", type: "rent" as const, property_type: "apartment" as const, price: 550, surface_sqm: 70, rooms: 3, bathrooms: 1, floor: 1, total_floors: 3, year_built: 1980, energy_class: "E", heating_type: "autonomo", has_parking: false, has_garden: false, has_terrace: false, has_elevator: false, has_cellar: false, address: "Via Roma 56", city: "Aversa", province: "CE", zip_code: "81031", lat: 40.9730, lng: 14.2080, neighborhood: "Centro", photos: [], status: "active" },
  { title: "Loft moderno Salerno centro", type: "sale" as const, property_type: "apartment" as const, price: 245000, surface_sqm: 80, rooms: 2, bathrooms: 1, floor: 3, total_floors: 4, year_built: 2018, energy_class: "A3", heating_type: "autonomo", has_parking: false, has_garden: false, has_terrace: true, has_elevator: true, has_cellar: false, address: "Via dei Mercanti 22", city: "Salerno", province: "SA", zip_code: "84121", lat: 40.6824, lng: 14.7681, neighborhood: "Centro Storico", photos: [], status: "active" },
  { title: "Villa bifamiliare Cava de' Tirreni", type: "sale" as const, property_type: "house" as const, price: 340000, surface_sqm: 180, rooms: 5, bathrooms: 2, floor: 0, total_floors: 2, year_built: 2000, energy_class: "C", heating_type: "autonomo", has_parking: true, has_garden: true, has_terrace: true, has_elevator: false, has_cellar: true, address: "Via XXV Luglio 33", city: "Cava de' Tirreni", province: "SA", zip_code: "84013", lat: 40.7000, lng: 14.7060, neighborhood: "Centro", photos: [], status: "active" },
  { title: "Bilocale vista mare Amalfi", type: "sale" as const, property_type: "apartment" as const, price: 420000, surface_sqm: 55, rooms: 2, bathrooms: 1, floor: 2, total_floors: 3, year_built: 1970, energy_class: "E", heating_type: "autonomo", has_parking: false, has_garden: false, has_terrace: true, has_elevator: false, has_cellar: false, address: "Via Lorenzo d'Amalfi 8", city: "Amalfi", province: "SA", zip_code: "84011", lat: 40.6340, lng: 14.6027, neighborhood: "Centro", photos: [], status: "active" },
  { title: "Trilocale panoramico Avellino", type: "sale" as const, property_type: "apartment" as const, price: 145000, surface_sqm: 90, rooms: 3, bathrooms: 1, floor: 5, total_floors: 6, year_built: 1985, energy_class: "E", heating_type: "autonomo", has_parking: true, has_garden: false, has_terrace: false, has_elevator: true, has_cellar: true, address: "Corso Vittorio Emanuele 112", city: "Avellino", province: "AV", zip_code: "83100", lat: 40.9140, lng: 14.7906, neighborhood: "Centro", photos: [], status: "active" },
  { title: "Casa indipendente Ariano Irpino", type: "sale" as const, property_type: "house" as const, price: 120000, surface_sqm: 150, rooms: 4, bathrooms: 2, floor: 0, total_floors: 2, year_built: 1975, energy_class: "F", heating_type: "autonomo", has_parking: true, has_garden: true, has_terrace: false, has_elevator: false, has_cellar: true, address: "Via Cardito 25", city: "Ariano Irpino", province: "AV", zip_code: "83031", lat: 41.1530, lng: 15.0880, neighborhood: "Cardito", photos: [], status: "active" },
  { title: "Pentahouse Lungomare Napoli", type: "sale" as const, property_type: "apartment" as const, price: 890000, surface_sqm: 180, rooms: 5, bathrooms: 3, floor: 8, total_floors: 8, year_built: 2010, energy_class: "A1", heating_type: "autonomo", has_parking: true, has_garden: false, has_terrace: true, has_elevator: true, has_cellar: true, address: "Via Partenope 36", city: "Napoli", province: "NA", zip_code: "80121", lat: 40.8310, lng: 14.2480, neighborhood: "Lungomare", photos: [], status: "active" },
  { title: "Locale commerciale Via Tribunali", type: "rent" as const, property_type: "commercial" as const, price: 1200, surface_sqm: 60, rooms: 2, bathrooms: 1, floor: 0, total_floors: 3, year_built: 1900, energy_class: "G", heating_type: "assente", has_parking: false, has_garden: false, has_terrace: false, has_elevator: false, has_cellar: true, address: "Via dei Tribunali 155", city: "Napoli", province: "NA", zip_code: "80138", lat: 40.8520, lng: 14.2580, neighborhood: "Decumani", photos: [], status: "active" },
  { title: "Trilocale ristrutturato Pozzuoli", type: "sale" as const, property_type: "apartment" as const, price: 195000, surface_sqm: 85, rooms: 3, bathrooms: 1, floor: 2, total_floors: 4, year_built: 1988, energy_class: "D", heating_type: "autonomo", has_parking: true, has_garden: false, has_terrace: true, has_elevator: false, has_cellar: false, address: "Via Napoli 102", city: "Pozzuoli", province: "NA", zip_code: "80078", lat: 40.8233, lng: 14.1230, neighborhood: "Centro", photos: [], status: "active" },
  { title: "Attico con terrazzo Salerno mare", type: "sale" as const, property_type: "apartment" as const, price: 375000, surface_sqm: 110, rooms: 3, bathrooms: 2, floor: 5, total_floors: 5, year_built: 2015, energy_class: "A2", heating_type: "autonomo", has_parking: true, has_garden: false, has_terrace: true, has_elevator: true, has_cellar: true, address: "Lungomare Trieste 45", city: "Salerno", province: "SA", zip_code: "84121", lat: 40.6750, lng: 14.7710, neighborhood: "Lungomare", photos: [], status: "active" },
  { title: "Bilocale studenti Fisciano", type: "rent" as const, property_type: "apartment" as const, price: 450, surface_sqm: 50, rooms: 2, bathrooms: 1, floor: 1, total_floors: 3, year_built: 2000, energy_class: "D", heating_type: "autonomo", has_parking: true, has_garden: false, has_terrace: false, has_elevator: false, has_cellar: false, address: "Via Università 18", city: "Fisciano", province: "SA", zip_code: "84084", lat: 40.7740, lng: 14.7890, neighborhood: "Università", photos: [], status: "active" },
  { title: "Rustico da ristrutturare Irpinia", type: "sale" as const, property_type: "house" as const, price: 65000, surface_sqm: 120, rooms: 4, bathrooms: 1, floor: 0, total_floors: 2, year_built: 1940, energy_class: "G", heating_type: "assente", has_parking: true, has_garden: true, has_terrace: false, has_elevator: false, has_cellar: true, address: "Contrada San Marco 5", city: "Montella", province: "AV", zip_code: "83048", lat: 40.8450, lng: 15.0170, neighborhood: "Contrada San Marco", photos: [], status: "active" },
];

// TEMPORANEO: GET senza auth per seed su Vercel preview
export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  if (!appUrl.includes("vercel.app")) {
    return NextResponse.json({ error: "GET seed consentito solo su vercel.app" }, { status: 403 });
  }
  return runSeed();
}

export async function POST(request: NextRequest) {
  // Check authorization
  const isDev = process.env.NODE_ENV === "development";
  const authHeader = request.headers.get("authorization");
  const secretMatch = authHeader === `Bearer ${SEED_SECRET}`;

  if (!isDev && !secretMatch) {
    return NextResponse.json(
      { error: "Non autorizzato. Usa header Authorization: Bearer <secret> oppure esegui in development." },
      { status: 401 }
    );
  }

  return runSeed();
}

async function runSeed() {
  const supabase = createAdminClient();

  // Create a placeholder embedding (1536 zeros)
  const zeroEmbedding = `[${new Array(1536).fill(0).join(",")}]`;

  const listingsWithEmbeddings = LISTINGS_DATA.map((listing) => ({
    ...listing,
    price_period: listing.type === "rent" ? "month" : null,
    embedding: zeroEmbedding,
    views_count: Math.floor(Math.random() * 500),
    is_featured: Math.random() > 0.8,
  }));

  const { data, error } = await supabase
    .from("listings")
    .insert(listingsWithEmbeddings)
    .select("id, title, city");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    message: `Seed completato: ${data.length} annunci inseriti.`,
    listings: data,
  });
}
