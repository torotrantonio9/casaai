/**
 * Scraper per Idealista — estrae annunci dal profilo agenzia.
 *
 * NOTA: questo modulo è un'implementazione strutturale.
 * In produzione utilizzerà Playwright per il rendering headless
 * e Cheerio per il parsing HTML.
 *
 * Rispetta robots.txt e rate limiting (1 req ogni 3-5 secondi).
 */

export interface ScrapedListing {
  source_id: string;
  source_url: string;
  title: string;
  price: number;
  price_period?: "month";
  type: "sale" | "rent";
  property_type: string;
  surface_sqm?: number;
  rooms?: number;
  bathrooms?: number;
  address: string;
  city: string;
  province: string;
  lat?: number;
  lng?: number;
  photos: string[];
  description: string;
  features: string[];
  energy_class?: string;
  floor?: number;
}

// Mapping caratteristiche Idealista → schema CasaAI
export const IDEALISTA_FEATURE_MAP: Record<string, string> = {
  "Con ascensore": "has_elevator",
  "Box / Posto auto": "has_parking",
  "Con giardino": "has_garden",
  "Con terrazzo": "has_terrace",
  "Con cantina": "has_cellar",
};

const PROPERTY_TYPE_MAP: Record<string, string> = {
  Appartamento: "apartment",
  Casa: "house",
  "Casa indipendente": "house",
  Villa: "villa",
  Villetta: "villa",
  Attico: "apartment",
  Loft: "apartment",
  "Locale commerciale": "commercial",
  Ufficio: "commercial",
  Terreno: "land",
  Garage: "garage",
  "Box auto": "garage",
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Scrape listings from an agency profile page on Idealista.
 * Returns structured listing data.
 */
export async function scrapeAgencyProfile(
  profileUrl: string,
  onProgress?: (status: {
    total_found: number;
    processed: number;
    current_url: string;
  }) => void
): Promise<{
  listings: ScrapedListing[];
  errors: { url: string; reason: string }[];
}> {
  const listings: ScrapedListing[] = [];
  const errors: { url: string; reason: string }[] = [];

  try {
    // In production: use Playwright to navigate to profileUrl
    // const browser = await chromium.launch({ headless: true });
    // const page = await browser.newPage();
    // await page.setExtraHTTPHeaders({ 'User-Agent': 'CasaAI-Bot/1.0 (+https://casaai.it/bot)' });

    // Step 1: Load agency profile page and extract listing URLs
    // const listingUrls = await extractListingUrls(page, profileUrl);

    // Placeholder: in production, Playwright extracts listing URLs
    const listingUrls: string[] = [];

    onProgress?.({
      total_found: listingUrls.length,
      processed: 0,
      current_url: profileUrl,
    });

    // Step 2: For each listing URL, scrape details
    for (let i = 0; i < listingUrls.length; i++) {
      const url = listingUrls[i];

      try {
        // Rate limiting: wait 3-5 seconds between requests
        await sleep(3000 + Math.random() * 2000);

        // In production: navigate to listing page and extract data
        // const data = await scrapeListingPage(page, url);
        // listings.push(data);

        onProgress?.({
          total_found: listingUrls.length,
          processed: i + 1,
          current_url: url,
        });
      } catch (err) {
        errors.push({
          url,
          reason: err instanceof Error ? err.message : "Errore sconosciuto",
        });
      }
    }

    // await browser.close();
  } catch (err) {
    errors.push({
      url: profileUrl,
      reason: err instanceof Error ? err.message : "Errore nel caricamento profilo",
    });
  }

  return { listings, errors };
}

/**
 * Map scraped features to CasaAI boolean fields.
 */
export function mapFeatures(
  features: string[]
): Record<string, boolean> {
  const mapped: Record<string, boolean> = {};
  for (const feature of features) {
    const key = IDEALISTA_FEATURE_MAP[feature];
    if (key) {
      mapped[key] = true;
    }
  }
  return mapped;
}

/**
 * Normalize property type from Idealista to CasaAI schema.
 */
export function normalizePropertyType(idealistaType: string): string {
  return PROPERTY_TYPE_MAP[idealistaType] ?? "other";
}
