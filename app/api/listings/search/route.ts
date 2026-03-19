import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const type = searchParams.get("type");
  const city = searchParams.get("city");
  const priceMin = searchParams.get("price_min");
  const priceMax = searchParams.get("price_max");
  const roomsMin = searchParams.get("rooms_min");
  const surfaceMin = searchParams.get("surface_min");
  const hasGarden = searchParams.get("has_garden");
  const hasParking = searchParams.get("has_parking");
  const hasElevator = searchParams.get("has_elevator");
  const hasTerrace = searchParams.get("has_terrace");
  const energyClass = searchParams.get("energy_class");
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 50);
  const sort = searchParams.get("sort") ?? "newest";

  const supabase = createAdminClient();
  const offset = (page - 1) * limit;

  let query = supabase
    .from("listings")
    .select(
      "id, title, description, type, property_type, price, price_period, surface_sqm, rooms, bathrooms, floor, city, province, address, neighborhood, photos, has_parking, has_garden, has_terrace, has_elevator, has_cellar, energy_class, is_featured, lat, lng, views_count, created_at",
      { count: "exact" }
    )
    .eq("status", "active");

  if (type) query = query.eq("type", type);
  if (city) query = query.ilike("city", `%${city}%`);
  if (priceMin) query = query.gte("price", Number(priceMin));
  if (priceMax) query = query.lte("price", Number(priceMax));
  if (roomsMin) query = query.gte("rooms", Number(roomsMin));
  if (surfaceMin) query = query.gte("surface_sqm", Number(surfaceMin));
  if (hasGarden === "true") query = query.eq("has_garden", true);
  if (hasParking === "true") query = query.eq("has_parking", true);
  if (hasElevator === "true") query = query.eq("has_elevator", true);
  if (hasTerrace === "true") query = query.eq("has_terrace", true);
  if (energyClass) query = query.eq("energy_class", energyClass);

  // Sorting — featured listings always first
  switch (sort) {
    case "price_asc":
      query = query.order("is_featured", { ascending: false }).order("price", { ascending: true });
      break;
    case "price_desc":
      query = query.order("is_featured", { ascending: false }).order("price", { ascending: false });
      break;
    case "views":
      query = query.order("is_featured", { ascending: false }).order("views_count", { ascending: false });
      break;
    case "newest":
    default:
      query = query.order("is_featured", { ascending: false }).order("created_at", { ascending: false });
      break;
  }

  query = query.range(offset, offset + limit - 1);

  const { data, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    listings: data ?? [],
    total: count ?? 0,
    page,
    has_more: (count ?? 0) > offset + limit,
  });
}
