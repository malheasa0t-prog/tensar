import { loadSupabaseClient } from "@/lib/loadSupabaseClient";
import { mapProductsExplorerProduct } from "@/lib/productsExplorerModel";

// Short TTL so price/stock/status changes made in the admin dashboard surface
// on the storefront within ~20s instead of up to a minute.
const PRODUCTS_PAGE_CACHE_TTL_MS = 20_000;
const PRODUCTS_QUERY_COLUMNS = [
  "id",
  "name",
  "category_id",
  "product_type",
  "price",
  "discount_price",
  "quantity",
  "description",
  "brand",
  "rating",
  "review_count",
  "icon",
  "sold",
  "images",
  "status",
  "created_at",
].join(",");

let cachedProductsPageSnapshot = null;
let cachedProductsPageSnapshotTime = 0;
let pendingProductsPageSnapshotPromise = null;

/**
 * Checks whether the products page cache is still usable.
 *
 * @param {number} now
 * @returns {boolean}
 */
function hasFreshProductsPageCache(now) {
  return Boolean(
    cachedProductsPageSnapshot &&
      now - cachedProductsPageSnapshotTime < PRODUCTS_PAGE_CACHE_TTL_MS
  );
}

/**
 * Resolves the Supabase client used by the products page.
 *
 * @param {Record<string, unknown> | null | undefined} client
 * @returns {Promise<Record<string, unknown>>}
 */
async function resolveProductsPageClient(client) {
  return client || loadSupabaseClient();
}

/**
 * Builds a fast category-name lookup for product cards.
 *
 * @param {Array<Record<string, unknown>>} categories
 * @returns {Record<string, string>}
 */
function buildCategoryNameMap(categories) {
  return Object.fromEntries(
    categories.map((category) => [category.id, category.name])
  );
}

/**
 * Converts Supabase rows into the public products page snapshot.
 *
 * @param {{ products: Array<Record<string, unknown>>, categories: Array<Record<string, unknown>> }} input
 * @returns {{ products: Array<Record<string, unknown>>, categories: Array<Record<string, unknown>> }}
 */
function buildProductsPageSnapshot(input) {
  const categoryById = buildCategoryNameMap(input.categories);
  const products = input.products.map((product) =>
      mapProductsExplorerProduct(product, categoryById[product.category_id] || "منتجات عامة")
    );

  return { categories: input.categories, products };
}

/**
 * Fetches the raw products page rows from Supabase.
 *
 * @param {Record<string, unknown>} client
 * @returns {Promise<{ products: Array<Record<string, unknown>>, categories: Array<Record<string, unknown>> }>}
 */
async function fetchProductsPageRows(client) {
  const [productsResult, categoriesResult] = await Promise.all([
    client
      .from("products")
      .select(PRODUCTS_QUERY_COLUMNS)
      .in("status", ["active", "out_of_stock"])
      .order("created_at", { ascending: false }),
    client.from("categories").select("id,name").eq("status", "active"),
  ]);

  if (productsResult.error || categoriesResult.error) {
    throw productsResult.error || categoriesResult.error;
  }

  return {
    categories: categoriesResult.data || [],
    products: productsResult.data || [],
  };
}

/**
 * Loads the products page snapshot with a short in-memory cache.
 *
 * @param {{ client?: Record<string, unknown>, now?: number }} [options]
 * @returns {Promise<{ products: Array<Record<string, unknown>>, categories: Array<Record<string, unknown>> }>}
 */
export async function loadProductsPageSnapshot(options = {}) {
  const now = Number(options.now || Date.now());

  if (hasFreshProductsPageCache(now)) return cachedProductsPageSnapshot;
  if (pendingProductsPageSnapshotPromise) return pendingProductsPageSnapshotPromise;

  pendingProductsPageSnapshotPromise = refreshProductsPageSnapshot(options.client, now);
  return pendingProductsPageSnapshotPromise;
}

/**
 * Warms the products page cache without surfacing background errors.
 *
 * @returns {Promise<unknown>}
 */
export function prefetchProductsPageSnapshot() {
  return loadProductsPageSnapshot().catch(() => null);
}

/**
 * Drops the cached snapshot so the next load fetches fresh rows.
 *
 * @returns {void}
 */
export function invalidateProductsPageCache() {
  cachedProductsPageSnapshot = null;
  cachedProductsPageSnapshotTime = 0;
}

/**
 * Subscribes to product/category realtime changes so the storefront updates
 * within moments of an admin edit instead of waiting for the cache TTL.
 *
 * @param {() => void} onChange
 * @returns {() => void} Unsubscribe callback.
 */
export function subscribeToProductsPage(onChange) {
  if (typeof onChange !== "function") {
    return () => {};
  }

  let active = true;
  let cleanup = () => {};

  async function attachChannels() {
    const supabase = await loadSupabaseClient();
    if (!active) return;

    const handleChange = () => {
      invalidateProductsPageCache();
      onChange();
    };

    const channel = supabase
      .channel("storefront-products")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, handleChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "categories" }, handleChange)
      .subscribe();

    cleanup = () => supabase.removeChannel(channel);
  }

  void attachChannels();

  return () => {
    active = false;
    cleanup();
  };
}

/**
 * Refreshes and stores the products page snapshot.
 *
 * @param {Record<string, unknown> | null | undefined} client
 * @param {number} now
 * @returns {Promise<{ products: Array<Record<string, unknown>>, categories: Array<Record<string, unknown>> }>}
 */
async function refreshProductsPageSnapshot(client, now) {
  try {
    const resolvedClient = await resolveProductsPageClient(client);
    const rows = await fetchProductsPageRows(resolvedClient);
    cachedProductsPageSnapshot = buildProductsPageSnapshot(rows);
    cachedProductsPageSnapshotTime = now;
    return cachedProductsPageSnapshot;
  } catch (error) {
    if (cachedProductsPageSnapshot) return cachedProductsPageSnapshot;
    throw error;
  } finally {
    pendingProductsPageSnapshotPromise = null;
  }
}
