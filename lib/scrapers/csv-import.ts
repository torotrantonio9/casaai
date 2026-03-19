/**
 * CSV import module with AI-assisted column mapping.
 * Handles non-standard column names by using Claude to map them
 * to the CasaAI schema.
 */

import { chatJSON } from "@/lib/ai/claude";

export interface ParsedListing {
  title: string;
  price: number;
  type: "sale" | "rent";
  property_type: string;
  surface_sqm?: number;
  rooms?: number;
  bathrooms?: number;
  address: string;
  city: string;
  province?: string;
  description?: string;
  floor?: number;
  energy_class?: string;
  has_parking?: boolean;
  has_garden?: boolean;
  has_terrace?: boolean;
  has_elevator?: boolean;
  has_cellar?: boolean;
}

interface ColumnMapping {
  [csvColumn: string]: string; // maps CSV header → CasaAI field
}

const KNOWN_FIELD_ALIASES: Record<string, string[]> = {
  title: ["titolo", "nome", "oggetto", "annuncio"],
  price: ["prezzo", "prezzo richiesto", "costo", "importo"],
  surface_sqm: ["superficie", "mq", "metri quadri", "dimensione"],
  rooms: ["locali", "stanze", "vani", "camere"],
  bathrooms: ["bagni", "servizi"],
  address: ["indirizzo", "via"],
  city: ["citta", "città", "comune", "localita", "località"],
  province: ["provincia", "prov"],
  type: ["tipo", "contratto", "tipologia contratto"],
  property_type: ["tipo immobile", "tipologia", "categoria"],
  description: ["descrizione", "testo", "dettagli"],
  floor: ["piano"],
  energy_class: ["classe energetica", "classe", "energy class", "ape"],
};

/**
 * Try to match CSV column names to CasaAI fields using known aliases.
 */
function autoMapColumns(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const normalizedHeaders = headers.map((h) => h.toLowerCase().trim());

  for (const [field, aliases] of Object.entries(KNOWN_FIELD_ALIASES)) {
    for (let i = 0; i < normalizedHeaders.length; i++) {
      if (
        aliases.includes(normalizedHeaders[i]) ||
        normalizedHeaders[i] === field
      ) {
        mapping[headers[i]] = field;
        break;
      }
    }
  }

  return mapping;
}

/**
 * Use AI to map unrecognized CSV columns to CasaAI fields.
 */
async function aiMapColumns(
  headers: string[],
  sampleRow: string[]
): Promise<ColumnMapping> {
  const headerSample = headers
    .map((h, i) => `"${h}": "${sampleRow[i] ?? ""}"`)
    .join(", ");

  const result = await chatJSON<ColumnMapping>({
    systemPrompt: `Sei un assistente che mappa colonne CSV allo schema immobiliare CasaAI.
Campi disponibili: title, price, type (sale/rent), property_type (apartment/house/villa/commercial/land/garage/other), surface_sqm, rooms, bathrooms, address, city, province, description, floor, energy_class, has_parking (bool), has_garden (bool), has_terrace (bool), has_elevator (bool), has_cellar (bool).
Rispondi SOLO con un JSON che mappa nome_colonna_csv → nome_campo_casaai. Ignora colonne non mappabili.`,
    userMessage: `Mappa queste colonne CSV:\n{${headerSample}}`,
    maxTokens: 500,
  });

  return result;
}

/**
 * Parse a CSV string into structured listing data.
 */
export async function parseCSV(
  csvText: string,
  useAI = true
): Promise<{
  listings: ParsedListing[];
  mapping: ColumnMapping;
  errors: string[];
}> {
  const errors: string[] = [];
  const lines = csvText.split("\n").filter((l) => l.trim());

  if (lines.length < 2) {
    return { listings: [], mapping: {}, errors: ["CSV vuoto o senza dati"] };
  }

  // Parse header — support both comma and semicolon delimiters
  const delimiter = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(delimiter).map((h) => h.trim().replace(/^"|"$/g, ""));

  // Try auto-mapping first
  let mapping = autoMapColumns(headers);
  const unmappedHeaders = headers.filter((h) => !mapping[h]);

  // If many columns unmapped, use AI
  if (useAI && unmappedHeaders.length > headers.length * 0.4) {
    try {
      const sampleRow = lines[1].split(delimiter).map((c) => c.trim().replace(/^"|"$/g, ""));
      const aiMapping = await aiMapColumns(headers, sampleRow);
      mapping = { ...mapping, ...aiMapping };
    } catch {
      errors.push("Mapping AI fallito, usando solo mapping automatico");
    }
  }

  // Parse data rows
  const listings: ParsedListing[] = [];

  for (let i = 1; i < lines.length; i++) {
    try {
      const values = lines[i].split(delimiter).map((c) => c.trim().replace(/^"|"$/g, ""));
      const row: Record<string, string> = {};

      headers.forEach((h, idx) => {
        const field = mapping[h];
        if (field) {
          row[field] = values[idx] ?? "";
        }
      });

      if (!row.title && !row.address) {
        errors.push(`Riga ${i + 1}: manca titolo e indirizzo, saltata`);
        continue;
      }

      const listing: ParsedListing = {
        title: row.title || `Annuncio da CSV - ${row.city ?? ""}`,
        price: parseFloat(row.price?.replace(/[^\d.,]/g, "").replace(",", ".")) || 0,
        type: row.type?.toLowerCase().includes("affitto") ? "rent" : "sale",
        property_type: normalizeType(row.property_type ?? ""),
        surface_sqm: row.surface_sqm ? parseFloat(row.surface_sqm) : undefined,
        rooms: row.rooms ? parseInt(row.rooms) : undefined,
        bathrooms: row.bathrooms ? parseInt(row.bathrooms) : undefined,
        address: row.address ?? "",
        city: row.city ?? "",
        province: row.province,
        description: row.description,
        floor: row.floor ? parseInt(row.floor) : undefined,
        energy_class: row.energy_class?.toUpperCase(),
        has_parking: toBool(row.has_parking),
        has_garden: toBool(row.has_garden),
        has_terrace: toBool(row.has_terrace),
        has_elevator: toBool(row.has_elevator),
        has_cellar: toBool(row.has_cellar),
      };

      listings.push(listing);
    } catch {
      errors.push(`Riga ${i + 1}: errore di parsing`);
    }
  }

  return { listings, mapping, errors };
}

function normalizeType(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes("appart")) return "apartment";
  if (lower.includes("casa")) return "house";
  if (lower.includes("villa")) return "villa";
  if (lower.includes("commerc") || lower.includes("ufficio")) return "commercial";
  if (lower.includes("terren")) return "land";
  if (lower.includes("garag") || lower.includes("box")) return "garage";
  return "other";
}

function toBool(value?: string): boolean | undefined {
  if (!value) return undefined;
  const lower = value.toLowerCase();
  return lower === "si" || lower === "sì" || lower === "yes" || lower === "true" || lower === "1";
}
