/**
 * Cart data access helpers for retrieving live product snapshots from Supabase.
 */

import { loadSupabaseClient } from "../lib/loadSupabaseClient.js";

const CART_PRODUCT_SELECT_FIELDS =
  "id,name,price,discount_price,images,status,quantity,category_id,product_type";
const CART_REFRESH_ERROR_MESSAGE = "\u005bCRT-301\u005d \u062a\u0639\u0630\u0631 \u062a\u062d\u062f\u064a\u062b \u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0644\u0633\u0644\u0629 \u062d\u0627\u0644\u064a\u0627\u064b.";

/**
 * Resolves the client used by cart refresh helpers.
 *
 * @param {Record<string, unknown> | null | undefined} client
 * @returns {Promise<Record<string, unknown>>}
 */
async function resolveCartClient(client) {
  return client || loadSupabaseClient();
}

/**
 * Normalizes product identifiers before querying the catalog.
 *
 * @param {Array<unknown>} productIds
 * @returns {Array<string>}
 */
function normalizeCartProductIds(productIds) {
  if (!Array.isArray(productIds) || productIds.length === 0) {
    return [];
  }

  return [...new Set(productIds.map((id) => String(id || "").trim()).filter(Boolean))];
}

/**
 * Loads live product snapshots for the items currently stored in the cart.
 *
 * @param {{ productIds: Array<unknown>, client?: Record<string, unknown> }} input
 * @returns {Promise<Array<Record<string, unknown>>>}
 * @throws {Error}
 */
export async function fetchCartProductSnapshots({ productIds, client }) {
  const normalizedIds = normalizeCartProductIds(productIds);
  if (normalizedIds.length === 0) {
    return [];
  }

  const resolvedClient = await resolveCartClient(client);

  const serviceIds = normalizedIds.filter(id => id.startsWith('srv-'));
  const physicalIds = normalizedIds.filter(id => !id.startsWith('srv-'));

  const [productsResponse, servicesResponse] = await Promise.all([
    physicalIds.length > 0 
      ? resolvedClient.from("products").select(CART_PRODUCT_SELECT_FIELDS).in("id", physicalIds)
      : { data: [], error: null },
    serviceIds.length > 0
      ? resolvedClient.from("services").select("id,name,price,min_qty,max_qty,image,category_id,status").in("id", serviceIds)
      : { data: [], error: null }
  ]);

  if (productsResponse?.error || servicesResponse?.error) {
    throw new Error(CART_REFRESH_ERROR_MESSAGE);
  }

  const physicalProducts = Array.isArray(productsResponse?.data) ? productsResponse.data : [];
  
  const digitalServices = (Array.isArray(servicesResponse?.data) ? servicesResponse.data : []).map(service => ({
    id: service.id,
    name: service.name,
    price: service.price,
    discount_price: null,
    images: service.image ? [service.image] : [],
    status: service.status,
    quantity: service.max_qty || 9999,
    category_id: service.category_id,
    product_type: 'digital'
  }));

  return [...physicalProducts, ...digitalServices];
}
