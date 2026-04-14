/**
 * Client-side data loading for the full-screen global search overlay.
 */

import {
  buildGlobalSearchItems,
  buildGlobalSearchPopularSuggestions,
  buildGlobalSearchQuickFilters,
} from "../lib/globalSearchModel.js";
import { supabase } from "../lib/supabaseClient.js";

const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;
const GLOBAL_SEARCH_ERROR_MESSAGE = "تعذر تحميل بيانات البحث حالياً.";

let cachedSnapshot = null;
let cacheExpiryTimestamp = 0;
let pendingSnapshotPromise = null;

/**
 * Converts a Supabase response into a safe rows array.
 *
 * @param {{ data?: unknown, error?: unknown } | null | undefined} response
 * @returns {Array<Record<string, unknown>>}
 */
function readSearchRows(response) {
  return Array.isArray(response?.data) ? response.data : [];
}

/**
 * Extracts a readable error message from a Supabase response.
 *
 * @param {{ error?: { message?: string } | null } | null | undefined} response
 * @returns {string}
 */
function readSearchError(response) {
  return String(response?.error?.message || "").trim();
}

/**
 * Checks whether the in-memory search cache is still fresh.
 *
 * @returns {boolean}
 */
function hasFreshSearchCache() {
  return Boolean(cachedSnapshot) && Date.now() < cacheExpiryTimestamp;
}

/**
 * Writes one freshly loaded search snapshot to the in-memory cache.
 *
 * @param {Record<string, unknown>} snapshot
 * @returns {Record<string, unknown>}
 */
function cacheSearchSnapshot(snapshot) {
  cachedSnapshot = snapshot;
  cacheExpiryTimestamp = Date.now() + SEARCH_CACHE_TTL_MS;
  return snapshot;
}

/**
 * Loads the raw search sources from Supabase.
 *
 * @param {typeof supabase} client
 * @returns {Promise<[Record<string, unknown>, Record<string, unknown>, Record<string, unknown>]>}
 */
async function loadSearchSources(client) {
  return Promise.all([
    client
      .from("products")
      .select("id,name,description,brand,icon,price,discount_price,sold,review_count,reviews_count,category_id,product_type")
      .in("status", ["active", "out_of_stock"]),
    client
      .from("repair_services")
      .select("id,name,description,category,icon,price,duration")
      .eq("status", "active")
      .order("created_at", { ascending: false }),
    client
      .from("categories")
      .select("id,name,slug,parent_id")
      .eq("status", "active")
      .order("sort_order", { ascending: true }),
  ]);
}

/**
 * Builds a normalized global search snapshot from the raw Supabase sources.
 *
 * @param {typeof supabase} [client=supabase]
 * @returns {Promise<{ items: Array<Record<string, unknown>>, popularSuggestions: string[], quickFilters: Array<Record<string, unknown>>, sourceErrors: string[] }>}
 * @throws {Error}
 */
export async function loadGlobalSearchSnapshot(client = supabase) {
  const [productsResponse, servicesResponse, categoriesResponse] = await loadSearchSources(client);
  const sourceErrors = [
    readSearchError(productsResponse),
    readSearchError(servicesResponse),
    readSearchError(categoriesResponse),
  ].filter(Boolean);

  const items = buildGlobalSearchItems({
    products: readSearchRows(productsResponse),
    services: readSearchRows(servicesResponse),
    categories: readSearchRows(categoriesResponse),
  });

  if (items.length === 0 && sourceErrors.length > 0) {
    throw new Error(GLOBAL_SEARCH_ERROR_MESSAGE);
  }

  return {
    items,
    popularSuggestions: buildGlobalSearchPopularSuggestions({ items }),
    quickFilters: buildGlobalSearchQuickFilters(items),
    sourceErrors,
  };
}

/**
 * Returns a cached global search snapshot or loads it on demand.
 *
 * @param {typeof supabase} [client=supabase]
 * @returns {Promise<{ items: Array<Record<string, unknown>>, popularSuggestions: string[], quickFilters: Array<Record<string, unknown>>, sourceErrors: string[] }>}
 */
export async function fetchGlobalSearchSnapshot(client = supabase) {
  if (hasFreshSearchCache()) {
    return cachedSnapshot;
  }

  if (pendingSnapshotPromise) {
    return pendingSnapshotPromise;
  }

  pendingSnapshotPromise = loadGlobalSearchSnapshot(client)
    .then((snapshot) => cacheSearchSnapshot(snapshot))
    .finally(() => {
      pendingSnapshotPromise = null;
    });

  return pendingSnapshotPromise;
}

/**
 * Clears the in-memory global search cache for tests and retries.
 *
 * @returns {void}
 */
export function resetGlobalSearchSnapshotCache() {
  cachedSnapshot = null;
  cacheExpiryTimestamp = 0;
  pendingSnapshotPromise = null;
}
