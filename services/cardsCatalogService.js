import {
  buildCardsRootCategories,
  countServicesBySubcategory,
  findCardsCategoryByRoute,
  getDirectChildCategories,
} from "@/lib/cardsCatalogModel";
import { loadSupabaseClient } from "@/lib/loadSupabaseClient";
import { subscribeToTableChanges } from "@/lib/realtimeTableSubscription";

const CARDS_CACHE_TTL_MS = 60_000;
const cardsCache = new Map();
const pendingCardsSnapshots = new Map();
const ACTIVE_SERVICES_SELECT = "id,name,price,image,description,status,category_id,subcategory_id,min_qty,max_qty,sort_order,metadata,provider_service_id";

/**
 * Loads the root cards catalog snapshot used by /cards.
 *
 * @returns {Promise<{ roots: Array<Record<string, unknown>> }>}
 */
export async function loadCardsCatalogSnapshot() {
  return readCardsSnapshot({
    cacheKey: "root",
    loader: async (client) => {
      const [categoriesResponse, servicesResponse] = await loadCardsSources(client);
      return {
        roots: buildCardsRootCategories({
          categories: categoriesResponse.data || [],
          services: servicesResponse.data || [],
        }),
      };
    },
  });
}

/**
 * Loads the subcategory + service snapshot used by /cards/:categoryId.
 *
 * @param {unknown} routeValue
 * @returns {Promise<{ category: Record<string, unknown> | null, services: Array<Record<string, unknown>>, servicesCountBySubcategory: Record<string, number>, subCategories: Array<Record<string, unknown>> }>}
 */
export async function loadCardsCategorySnapshot(routeValue) {
  const cacheKey = `category:${String(routeValue || "").trim()}`;

  return readCardsSnapshot({
    cacheKey,
    loader: async (client) => {
      const [categoriesResponse, servicesResponse] = await loadCardsSources(client);
      const categories = categoriesResponse.data || [];
      const services = servicesResponse.data || [];
      const matchedCategory = findCardsCategoryByRoute({ categories, routeValue });
      const category = resolveRootCardsCategory(categories, matchedCategory);
      const subCategories = category ? getDirectChildCategories({ categories, parentId: category.id }) : [];

      return {
        category,
        services,
        servicesCountBySubcategory: countServicesBySubcategory({
          rootId: category?.id,
          services,
          subCategories,
        }),
        subCategories,
      };
    },
  });
}

/**
 * Clears cards-related snapshots so the next view re-reads from Supabase.
 *
 * @returns {void}
 */
export function invalidateCardsCatalogCache() {
  cardsCache.clear();
}

/**
 * Subscribes to categories/services changes used by the cards catalog.
 *
 * @param {() => void} onChange
 * @param {Record<string, unknown>} [client]
 * @returns {() => void}
 */
export function subscribeToCardsCatalog(onChange, client) {
  return subscribeToTableChanges({
    channel: "storefront-cards-catalog",
    tables: ["categories", "services"],
    client,
    onChange: () => {
      invalidateCardsCatalogCache();
      if (typeof onChange === "function") onChange();
    },
  });
}

/**
 * Reads one cached cards snapshot or populates it from Supabase.
 *
 * @param {{ cacheKey: string, loader: (client: Record<string, unknown>) => Promise<Record<string, unknown>> }} input
 * @returns {Promise<Record<string, unknown>>}
 */
async function readCardsSnapshot({ cacheKey, loader }) {
  const now = Date.now();
  const cached = cardsCache.get(cacheKey);

  if (cached && now - cached.timestamp < CARDS_CACHE_TTL_MS) {
    return cached.snapshot;
  }

  if (pendingCardsSnapshots.has(cacheKey)) {
    return pendingCardsSnapshots.get(cacheKey);
  }

  const pendingSnapshot = loadFreshCardsSnapshot({ cacheKey, loader, now })
    .finally(() => pendingCardsSnapshots.delete(cacheKey));

  pendingCardsSnapshots.set(cacheKey, pendingSnapshot);
  return pendingSnapshot;
}

/**
 * Loads the shared categories/services sources behind the cards catalog.
 *
 * @param {Record<string, unknown>} client
 * @returns {Promise<[Record<string, unknown>, Record<string, unknown>]>}
 */
async function loadCardsSources(client) {
  const responses = await Promise.all([
    client.from("categories").select("*").eq("status", "active").order("sort_order", { ascending: true }),
    client.from("services").select(ACTIVE_SERVICES_SELECT).eq("status", "active").order("sort_order", { ascending: true }),
  ]);

  responses.forEach((response) => {
    if (response?.error) {
      throw response.error;
    }
  });

  return responses;
}

/**
 * Loads and caches one fresh cards snapshot.
 *
 * @param {{ cacheKey: string, loader: (client: Record<string, unknown>) => Promise<Record<string, unknown>>, now: number }} input
 * @returns {Promise<Record<string, unknown>>}
 */
async function loadFreshCardsSnapshot({ cacheKey, loader, now }) {
  const client = await loadSupabaseClient();
  const snapshot = await loader(client);
  cardsCache.set(cacheKey, { snapshot, timestamp: now });
  return snapshot;
}

/**
 * Resolves the root category behind a matched route category.
 *
 * @param {Array<Record<string, unknown>>} categories
 * @param {Record<string, unknown> | null} category
 * @returns {Record<string, unknown> | null}
 */
function resolveRootCardsCategory(categories, category) {
  if (!category) return null;

  let currentCategory = category;
  const byId = new Map((Array.isArray(categories) ? categories : []).map((entry) => [String(entry.id || ""), entry]));

  while (currentCategory.parent_id && byId.has(String(currentCategory.parent_id || ""))) {
    currentCategory = byId.get(String(currentCategory.parent_id || ""));
  }

  return currentCategory;
}
