import { createAdminClient } from "@/lib/supabase/admin";
import { generateEmbedding } from "./embeddings";

export interface SearchFilters {
  type?: "sale" | "rent";
  city?: string;
  price_min?: number;
  price_max?: number;
  rooms_min?: number;
  surface_min?: number;
  features?: string[];
  property_types?: string[];
  // Geographic bounding box
  lat?: number;
  lng?: number;
  max_distance_km?: number;
}

export interface SearchResult {
  id: string;
  title: string;
  description: string;
  type: string;
  property_type: string;
  price: number;
  price_period: string | null;
  surface_sqm: number;
  rooms: number;
  bathrooms: number;
  floor: number;
  city: string;
  province: string;
  address: string;
  neighborhood: string | null;
  photos: string[];
  has_parking: boolean;
  has_garden: boolean;
  has_terrace: boolean;
  has_elevator: boolean;
  has_cellar: boolean;
  energy_class: string | null;
  similarity: number;
}

/**
 * Convert lat/lng + km to a bounding box.
 * 1 degree latitude ~ 111 km
 * 1 degree longitude ~ 111 km * cos(lat)
 */
function boundingBox(lat: number, lng: number, km: number) {
  const latDelta = km / 111;
  const lngDelta = km / (111 * Math.cos((lat * Math.PI) / 180));
  return {
    latMin: lat - latDelta,
    latMax: lat + latDelta,
    lngMin: lng - lngDelta,
    lngMax: lng + lngDelta,
  };
}

/**
 * Feature filter columns mapping
 */
const featureColumns: Record<string, string> = {
  has_parking: "has_parking",
  has_garden: "has_garden",
  has_terrace: "has_terrace",
  has_elevator: "has_elevator",
  has_cellar: "has_cellar",
};

/**
 * Fallback text-based search using Supabase query builder.
 * Used when embeddings are not available (no OpenAI key, or RPC fails).
 */
async function textFallbackSearch(
  query: string,
  filters: SearchFilters,
  limit: number
): Promise<SearchResult[]> {
  const supabase = createAdminClient();

  let qb = supabase
    .from("listings")
    .select(
      "id, title, description, type, property_type, price, price_period, surface_sqm, rooms, bathrooms, floor, city, province, address, neighborhood, photos, has_parking, has_garden, has_terrace, has_elevator, has_cellar, energy_class"
    )
    .eq("status", "active")
    .limit(limit);

  if (filters.type) qb = qb.eq("type", filters.type);
  if (filters.city) qb = qb.ilike("city", `%${filters.city}%`);
  if (filters.price_max) qb = qb.lte("price", filters.price_max);
  if (filters.price_min) qb = qb.gte("price", filters.price_min);
  if (filters.rooms_min) qb = qb.gte("rooms", filters.rooms_min);
  if (filters.surface_min) qb = qb.gte("surface_sqm", filters.surface_min);

  if (filters.property_types && filters.property_types.length > 0) {
    qb = qb.in("property_type", filters.property_types);
  }

  // Feature boolean filters
  if (filters.features) {
    for (const feature of filters.features) {
      const col = featureColumns[feature];
      if (col) qb = qb.eq(col, true);
    }
  }

  // Geographic bounding box
  if (filters.lat && filters.lng && filters.max_distance_km) {
    const box = boundingBox(filters.lat, filters.lng, filters.max_distance_km);
    qb = qb
      .gte("lat", box.latMin)
      .lte("lat", box.latMax)
      .gte("lng", box.lngMin)
      .lte("lng", box.lngMax);
  }

  // Text search on title/description using ILIKE
  if (query) {
    // Extract meaningful keywords (skip short words)
    const keywords = query
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .slice(0, 3);
    if (keywords.length > 0) {
      // Search in title or city
      qb = qb.or(
        keywords.map((k) => `title.ilike.%${k}%,city.ilike.%${k}%`).join(",")
      );
    }
  }

  const { data } = await qb;
  return (data ?? []).map((row) => ({
    ...row,
    similarity: 0,
  })) as SearchResult[];
}

/**
 * Semantic search combining pgvector similarity with SQL filters and geographic bounding box.
 * Falls back to text search if embedding generation fails.
 */
export async function semanticSearch(
  query: string,
  filters: SearchFilters,
  limit = 5
): Promise<SearchResult[]> {
  // Try to generate embedding — fallback to text search if it fails
  let embedding: number[];
  try {
    embedding = await generateEmbedding(query);
  } catch (err) {
    console.error("[search.ts] Embedding generation failed, using text fallback:", err);
    return textFallbackSearch(query, filters, limit);
  }

  const supabase = createAdminClient();

  // Build the base RPC call for vector similarity search
  let sql = `
    SELECT
      id, title, description, type, property_type, price, price_period,
      surface_sqm, rooms, bathrooms, floor, city, province, address,
      neighborhood, photos, has_parking, has_garden, has_terrace,
      has_elevator, has_cellar, energy_class,
      1 - (embedding <=> $1::vector) AS similarity
    FROM listings
    WHERE status = 'active'
      AND embedding IS NOT NULL
  `;

  const params: unknown[] = [JSON.stringify(embedding)];
  let paramIdx = 2;

  if (filters.type) {
    sql += ` AND type = $${paramIdx}`;
    params.push(filters.type);
    paramIdx++;
  }

  if (filters.city) {
    sql += ` AND LOWER(city) LIKE LOWER($${paramIdx})`;
    params.push(`%${filters.city}%`);
    paramIdx++;
  }

  if (filters.price_min) {
    sql += ` AND price >= $${paramIdx}`;
    params.push(filters.price_min);
    paramIdx++;
  }

  if (filters.price_max) {
    sql += ` AND price <= $${paramIdx}`;
    params.push(filters.price_max);
    paramIdx++;
  }

  if (filters.rooms_min) {
    sql += ` AND rooms >= $${paramIdx}`;
    params.push(filters.rooms_min);
    paramIdx++;
  }

  if (filters.surface_min) {
    sql += ` AND surface_sqm >= $${paramIdx}`;
    params.push(filters.surface_min);
    paramIdx++;
  }

  if (filters.property_types && filters.property_types.length > 0) {
    sql += ` AND property_type = ANY($${paramIdx})`;
    params.push(filters.property_types);
    paramIdx++;
  }

  // Feature filters (boolean columns)
  if (filters.features) {
    for (const feature of filters.features) {
      const col = featureColumns[feature];
      if (col) {
        sql += ` AND ${col} = TRUE`;
      }
      if (feature === "energy_class_ab") {
        sql += ` AND energy_class IN ('A4','A3','A2','A1','B')`;
      }
    }
  }

  // Geographic bounding box filter
  if (filters.lat && filters.lng && filters.max_distance_km) {
    const box = boundingBox(filters.lat, filters.lng, filters.max_distance_km);
    sql += ` AND lat BETWEEN $${paramIdx} AND $${paramIdx + 1}`;
    sql += ` AND lng BETWEEN $${paramIdx + 2} AND $${paramIdx + 3}`;
    params.push(box.latMin, box.latMax, box.lngMin, box.lngMax);
    paramIdx += 4;
  }

  sql += ` ORDER BY similarity DESC LIMIT $${paramIdx}`;
  params.push(limit);

  const { data, error } = await supabase.rpc("exec_sql", {
    query: sql,
    params,
  });

  // Fallback if the exec_sql RPC isn't set up or fails
  if (error) {
    console.error("[search.ts] RPC exec_sql failed, using text fallback:", error.message);
    return textFallbackSearch(query, filters, limit);
  }

  return (data ?? []) as SearchResult[];
}

/**
 * Find comparable listings for valuation (no embedding needed, uses SQL filters).
 */
export async function findComparables(params: {
  city: string;
  property_type: string;
  surface_sqm: number;
  rooms?: number;
  lat?: number;
  lng?: number;
  limit?: number;
}): Promise<SearchResult[]> {
  const supabase = createAdminClient();
  const surfaceRange = params.surface_sqm * 0.3; // +-30%

  let query = supabase
    .from("listings")
    .select(
      "id, title, description, type, property_type, price, price_period, surface_sqm, rooms, bathrooms, floor, city, province, address, neighborhood, photos, has_parking, has_garden, has_terrace, has_elevator, has_cellar, energy_class"
    )
    .eq("status", "active")
    .ilike("city", `%${params.city}%`)
    .eq("property_type", params.property_type)
    .gte("surface_sqm", params.surface_sqm - surfaceRange)
    .lte("surface_sqm", params.surface_sqm + surfaceRange)
    .limit(params.limit ?? 10);

  if (params.lat && params.lng) {
    const box = boundingBox(params.lat, params.lng, 5);
    query = query
      .gte("lat", box.latMin)
      .lte("lat", box.latMax)
      .gte("lng", box.lngMin)
      .lte("lng", box.lngMax);
  }

  const { data } = await query;
  return (data ?? []).map((row) => ({
    ...row,
    similarity: 0,
  })) as SearchResult[];
}
