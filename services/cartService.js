/**
 * Cart data access helpers for retrieving live product snapshots from Supabase.
 */

import { supabase } from "../lib/supabaseClient.js";

const CART_PRODUCT_SELECT_FIELDS =
  "id,name,price,discount_price,images,status,quantity,stock,inventory_quantity,available_quantity,category,icon";
const CART_REFRESH_ERROR_MESSAGE = "تعذر تحديث بيانات السلة حالياً.";

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
 * @param {{ productIds: Array<unknown>, client?: typeof supabase }} input
 * @returns {Promise<Array<Record<string, unknown>>>}
 * @throws {Error}
 */
export async function fetchCartProductSnapshots({ productIds, client = supabase }) {
  const normalizedIds = normalizeCartProductIds(productIds);
  if (normalizedIds.length === 0) {
    return [];
  }

  const response = await client.from("products").select(CART_PRODUCT_SELECT_FIELDS).in("id", normalizedIds);
  if (response?.error) {
    throw new Error(CART_REFRESH_ERROR_MESSAGE);
  }

  return Array.isArray(response?.data) ? response.data : [];
}
