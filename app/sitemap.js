import { buildAbsoluteUrl } from "@/lib/seo";
import { supabase } from "@/lib/supabaseClient";

export const revalidate = 3600;

/**
 * Maps static public pages into sitemap entries.
 *
 * @returns {Array<{ url: string, changeFrequency: string, priority: number }>}
 */
function getStaticEntries() {
  return [
    { url: buildAbsoluteUrl("/"), changeFrequency: "daily", priority: 1 },
    { url: buildAbsoluteUrl("/products"), changeFrequency: "daily", priority: 0.9 },
    { url: buildAbsoluteUrl("/accessories"), changeFrequency: "daily", priority: 0.8 },
    { url: buildAbsoluteUrl("/services"), changeFrequency: "weekly", priority: 0.8 },
    { url: buildAbsoluteUrl("/subscriptions"), changeFrequency: "weekly", priority: 0.7 },
    { url: buildAbsoluteUrl("/contact"), changeFrequency: "monthly", priority: 0.6 },
  ];
}

/**
 * Builds sitemap entries from a Supabase query result.
 *
 * @param {Array<Record<string, unknown>>} records
 * @param {(record: Record<string, unknown>) => string} pathBuilder
 * @returns {Array<{ url: string, lastModified?: string }>}
 */
function mapDynamicEntries(records, pathBuilder) {
  return (records || []).map((record) => ({
    url: buildAbsoluteUrl(pathBuilder(record)),
    lastModified: record.updated_at || undefined,
  }));
}

/**
 * Generates the public sitemap with static and dynamic routes.
 *
 * @returns {Promise<Array<{ url: string, lastModified?: string, changeFrequency?: string, priority?: number }>>}
 */
export default async function sitemap() {
  const [categoriesResult, productsResult, servicesResult] = await Promise.all([
    supabase.from("categories").select("id,slug,updated_at").eq("status", "active"),
    supabase.from("products").select("id,updated_at").eq("status", "active"),
    supabase.from("repair_services").select("id,updated_at").eq("status", "active"),
  ]);

  return [
    ...getStaticEntries(),
    ...mapDynamicEntries(categoriesResult.data, (category) => `/category/${category.slug || category.id}`),
    ...mapDynamicEntries(productsResult.data, (product) => `/products/${product.id}`),
    ...mapDynamicEntries(servicesResult.data, (service) => `/services/${service.id}`),
  ];
}
