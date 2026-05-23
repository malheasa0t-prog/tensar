/**
 * Client-side data loading for the full-screen global search overlay.
 */

import {
  buildGlobalSearchItems,
  buildGlobalSearchPopularSuggestions,
  buildGlobalSearchQuickFilters,
} from "../lib/globalSearchModel.js";
import { loadSupabaseClient } from "../lib/loadSupabaseClient.js";

const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;
const GLOBAL_SEARCH_ERROR_MESSAGE = "[GSR-301] تعذر تحميل بيانات البحث حالياً.";

let cachedSnapshot = null;
let cacheExpiryTimestamp = 0;
let pendingSnapshotPromise = null;

/**
 * Resolves the Supabase client used by the global search loader.
 *
 * @param {Record<string, unknown> | null | undefined} client - Optional injected client.
 * @returns {Promise<Record<string, unknown>>} Supabase client.
 */
async function resolveSearchClient(client) {
  return client || loadSupabaseClient();
}

/**
 * Converts a Supabase response into a safe rows array.
 *
 * @param {{ data?: unknown, error?: unknown } | null | undefined} response - Query response.
 * @returns {Array<Record<string, unknown>>} Safe row list.
 */
function readSearchRows(response) {
  return Array.isArray(response?.data) ? response.data : [];
}

/**
 * Extracts a readable error message from a Supabase response.
 *
 * @param {{ error?: { message?: string } | null } | null | undefined} response - Query response.
 * @returns {string} Error message.
 */
function readSearchError(response) {
  return String(response?.error?.message || "").trim();
}

/**
 * Checks whether the in-memory search cache is still fresh.
 *
 * @returns {boolean} True when cache can be reused.
 */
function hasFreshSearchCache() {
  return Boolean(cachedSnapshot) && Date.now() < cacheExpiryTimestamp;
}

/**
 * Writes one freshly loaded search snapshot to the in-memory cache.
 *
 * @param {Record<string, unknown>} snapshot - Search snapshot.
 * @returns {Record<string, unknown>} Cached snapshot.
 */
function cacheSearchSnapshot(snapshot) {
  cachedSnapshot = snapshot;
  cacheExpiryTimestamp = Date.now() + SEARCH_CACHE_TTL_MS;
  return snapshot;
}

/**
 * Loads the raw service search sources from Supabase.
 *
 * @param {Record<string, unknown>} client - Supabase client.
 * @returns {Promise<[Record<string, unknown>, Record<string, unknown>]>} Query responses.
 */
async function loadSearchSources(client) {
  return Promise.all([
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
 * @param {Record<string, unknown>} [client] - Optional injected Supabase client.
 * @returns {Promise<{ items: Array<Record<string, unknown>>, popularSuggestions: string[], quickFilters: Array<Record<string, unknown>>, sourceErrors: string[] }>} Search snapshot.
 * @throws {Error} When all search sources fail to produce usable data.
 */
export async function loadGlobalSearchSnapshot(client) {
  const resolvedClient = await resolveSearchClient(client);
  const [repairServicesResponse, categoriesResponse] = await loadSearchSources(resolvedClient);
  const sourceErrors = [
    readSearchError(repairServicesResponse),
    readSearchError(categoriesResponse),
  ].filter(Boolean);
  const items = buildGlobalSearchItems({
    products: [],
    services: readSearchRows(repairServicesResponse),
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
 * @param {Record<string, unknown>} [client] - Optional injected Supabase client.
 * @returns {Promise<{ items: Array<Record<string, unknown>>, popularSuggestions: string[], quickFilters: Array<Record<string, unknown>>, sourceErrors: string[] }>} Search snapshot.
 */
export async function fetchGlobalSearchSnapshot(client) {
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
