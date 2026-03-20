import type { MetadataRoute } from "next";

export const dynamic = "force-dynamic";

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://casaai.it").replace(/\/+$/, "");

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let listings: { id: string; updated_at: string }[] = [];

  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    try {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const supabase = createAdminClient();
      const { data } = await supabase
        .from("listings")
        .select("id, updated_at")
        .eq("status", "active")
        .order("updated_at", { ascending: false })
        .limit(5000);
      listings = (data ?? []) as { id: string; updated_at: string }[];
    } catch {
      // Supabase not available at build time
    }
  }

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${BASE_URL}/cerca`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/valutazione`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
  ];

  const listingPages: MetadataRoute.Sitemap = listings.map((l) => ({
    url: `${BASE_URL}/annunci/${l.id}`,
    lastModified: l.updated_at ? new Date(l.updated_at) : new Date(),
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  return [...staticPages, ...listingPages];
}
