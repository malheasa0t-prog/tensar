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

  /* Load from products table */
  const response = await resolvedClient
    .from("products")
    .select(CART_PRODUCT_SELECT_FIELDS)
    .in("id", normalizedIds);

  if (response?.error) {
    throw new Error(CART_REFRESH_ERROR_MESSAGE);
  }

  return Array.isArray(response?.data) ? response.data : [];
}
