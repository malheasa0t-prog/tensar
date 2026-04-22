import { createSupabaseClient } from "./_lib/supabase.js";
import { withSecurityHeaders } from "./_lib/securityHeaders.js";
import { buildSitemapEntry, renderSitemapXml } from "../lib/sitemapModel.js";

const CACHE_CONTROL_HEADER = "public, max-age=3600";
const STATIC_PATHS = [
  { pathname: "/", changeFrequency: "daily", priority: 1 },
  { pathname: "/products", changeFrequency: "daily", priority: 0.9 },
  { pathname: "/services", changeFrequency: "weekly", priority: 0.9 },
  { pathname: "/accessories", changeFrequency: "weekly", priority: 0.8 },
  { pathname: "/contact", changeFrequency: "monthly", priority: 0.6 },
];

/**
 * Converts a Supabase query result into a safe row array.
 *
 * @param {{ data?: Array<Record<string, unknown>>, error?: { message?: string } | null }} result
 * @returns {Array<Record<string, unknown>>}
 */
function extractRows(result) {
  if (result?.error) {
    console.error("[SMP-301] sitemap.xml query failed:", result.error.message || result.error);
    return [];
  }

  return Array.isArray(result?.data) ? result.data : [];
}

/**
 * Builds the full sitemap entry list from static and database-backed routes.
 *
 * @param {string} origin
 * @param {{ categories?: Array<Record<string, unknown>>, products?: Array<Record<string, unknown>>, repairServices?: Array<Record<string, unknown>> }} snapshot
 * @returns {Array<Record<string, string>>}
 */
function buildSitemapEntries(origin, snapshot) {
  const categories = (snapshot?.categories || []).map((category) =>
    buildSitemapEntry({
      origin,
      pathname: `/category/${category.slug || category.id}`,
      lastModified: category.updated_at,
      changeFrequency: "weekly",
      priority: 0.7,
    })
  );
  const products = (snapshot?.products || []).map((product) =>
    buildSitemapEntry({
      origin,
      pathname: `/products/${product.id}`,
      lastModified: product.updated_at,
      changeFrequency: "weekly",
      priority: 0.7,
    })
  );
  const repairServices = (snapshot?.repairServices || []).map((service) =>
    buildSitemapEntry({
      origin,
      pathname: `/services/${service.id}`,
      lastModified: service.updated_at,
      changeFrequency: "weekly",
      priority: 0.7,
    })
  );

  return [
    ...STATIC_PATHS.map((route) => buildSitemapEntry({ origin, ...route })),
    ...categories,
    ...products,
    ...repairServices,
  ];
}

/**
 * Loads the public route snapshot from Supabase.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @returns {Promise<{ categories: Array<Record<string, unknown>>, products: Array<Record<string, unknown>>, repairServices: Array<Record<string, unknown>> }>}
 */
async function loadSitemapSnapshot(supabase) {
  const [categoriesResult, productsResult, repairServicesResult] = await Promise.all([
    supabase.from("categories").select("id, slug, updated_at").eq("status", "active"),
    supabase.from("products").select("id, updated_at").in("status", ["active", "out_of_stock"]),
    supabase.from("repair_services").select("id, updated_at").eq("status", "active"),
  ]);

  return {
    categories: extractRows(categoriesResult),
    products: extractRows(productsResult),
    repairServices: extractRows(repairServicesResult),
  };
}

/**
 * Serves a sitemap.xml payload for Cloudflare Pages.
 *
 * @param {EventContext} context
 * @returns {Promise<Response>}
 */
export async function onRequestGet(context) {
  const origin = new URL(context.request.url).origin;
  let snapshot = {
    categories: [],
    products: [],
    repairServices: [],
  };

  try {
    const supabase = createSupabaseClient(context.env);
    snapshot = await loadSitemapSnapshot(supabase);
  } catch (error) {
    console.error("[SMP-500] sitemap.xml failed to load dynamic routes:", error);
  }

  const xml = renderSitemapXml(buildSitemapEntries(origin, snapshot));

  return withSecurityHeaders(
    new Response(xml, {
      headers: {
        "Cache-Control": CACHE_CONTROL_HEADER,
        "Content-Type": "application/xml; charset=UTF-8",
      },
    })
  );
}
