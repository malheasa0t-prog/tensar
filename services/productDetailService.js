import { loadSupabaseClient } from "@/lib/loadSupabaseClient";

const PRODUCT_DETAIL_CACHE_TTL_MS = 60_000;
const PRODUCT_DETAIL_COLUMNS = [
  "id",
  "name",
  "price",
  "discount_price",
  "description",
  "images",
  "category_id",
  "status",
  "product_type",
  "brand",
  "quantity",
  "specs",
].join(",");
const SERVICE_DETAIL_COLUMNS = [
  "id",
  "name",
  "price",
  "description",
  "image",
  "category_id",
  "status",
  "max_qty",
  "min_qty",
  "provider_service_id",
].join(",");

const productDetailCache = new Map();
const pendingProductDetailSnapshots = new Map();

/**
 * Normalizes a route product id before cache lookup or querying.
 *
 * @param {unknown} id
 * @returns {string}
 */
function normalizeProductDetailId(id) {
  return String(id || "").trim();
}

/**
 * Resolves the Supabase client used by product details.
 *
 * @param {Record<string, unknown> | null | undefined} client
 * @returns {Promise<Record<string, unknown>>}
 */
async function resolveProductDetailClient(client) {
  return client || loadSupabaseClient();
}

/**
 * Checks whether a cached product detail snapshot is still fresh.
 *
 * @param {{ cached?: { timestamp: number }, now: number }} input
 * @returns {boolean}
 */
function isFreshProductDetailSnapshot(input) {
  return Boolean(
    input.cached && input.now - input.cached.timestamp < PRODUCT_DETAIL_CACHE_TTL_MS
  );
}

/**
 * Maps a repair service row into the product detail contract.
 *
 * @param {Record<string, unknown>} service
 * @returns {Record<string, unknown>}
 */
function mapServiceDetailToProduct(service) {
  return {
    id: service.id,
    name: service.name,
    price: service.price,
    discount_price: null,
    description: service.description,
    images: service.image ? [service.image] : [],
    category_id: service.category_id,
    status: service.status,
    product_type: "digital",
    brand: null,
    quantity: service.max_qty || 999,
    min_qty: service.min_qty,
    max_qty: service.max_qty,
    provider_service_id: service.provider_service_id,
  };
}

/**
 * Finds either a physical product or mapped service detail row.
 *
 * @param {{ id: string, client: Record<string, unknown> }} input
 * @returns {Promise<Record<string, unknown> | null>}
 */
async function findProductDetailItem(input) {
  if (input.id.startsWith("srv-")) {
    const { data } = await input.client
      .from("services")
      .select(SERVICE_DETAIL_COLUMNS)
      .eq("id", input.id)
      .eq("status", "active")
      .maybeSingle();

    return data ? mapServiceDetailToProduct(data) : null;
  }

  const { data } = await input.client
    .from("products")
    .select(PRODUCT_DETAIL_COLUMNS)
    .eq("id", input.id)
    .in("status", ["active", "out_of_stock"])
    .maybeSingle();

  return data || null;
}

/**
 * Loads the category shell for a product detail page.
 *
 * @param {{ client: Record<string, unknown>, product: Record<string, unknown> }} input
 * @returns {Promise<Record<string, unknown> | null>}
 */
async function fetchProductDetailCategory(input) {
  if (!input.product?.category_id) return null;

  const { data } = await input.client
    .from("categories")
    .select("name,slug")
    .eq("id", input.product.category_id)
    .maybeSingle();

  return data || null;
}

/**
 * Loads and caches the product detail snapshot.
 *
 * @param {{ id?: string, client?: Record<string, unknown>, now?: number }} [options]
 * @returns {Promise<{ product: Record<string, unknown> | null, category: Record<string, unknown> | null }>}
 */
export async function loadProductDetailSnapshot(options = {}) {
  const id = normalizeProductDetailId(options.id);
  const now = Number(options.now || Date.now());
  const cached = productDetailCache.get(id);

  if (!id) return { category: null, product: null };
  if (isFreshProductDetailSnapshot({ cached, now })) return cached.snapshot;
  if (pendingProductDetailSnapshots.has(id)) return pendingProductDetailSnapshots.get(id);

  const pendingSnapshot = refreshProductDetailSnapshot({ id, client: options.client, now });
  pendingProductDetailSnapshots.set(id, pendingSnapshot);
  return pendingSnapshot;
}

/**
 * Warms a product detail snapshot without surfacing background errors.
 *
 * @param {string} id
 * @returns {Promise<unknown>}
 */
export function prefetchProductDetailSnapshot(id) {
  return loadProductDetailSnapshot({ id }).catch(() => null);
}

/**
 * Refreshes one product detail snapshot and updates the cache.
 *
 * @param {{ id: string, client?: Record<string, unknown>, now: number }} input
 * @returns {Promise<{ product: Record<string, unknown> | null, category: Record<string, unknown> | null }>}
 */
async function refreshProductDetailSnapshot(input) {
  try {
    const client = await resolveProductDetailClient(input.client);
    const product = await findProductDetailItem({ id: input.id, client });
    const category = product ? await fetchProductDetailCategory({ client, product }) : null;
    const snapshot = { category, product };

    productDetailCache.set(input.id, { snapshot, timestamp: input.now });
    return snapshot;
  } catch (error) {
    const cached = productDetailCache.get(input.id);
    if (cached?.snapshot) return cached.snapshot;
    throw error;
  } finally {
    pendingProductDetailSnapshots.delete(input.id);
  }
}
