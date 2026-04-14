/**
 * Favorites data access helpers for retrieving saved product snapshots from Supabase.
 */

import { supabase } from "../lib/supabaseClient.js";
import { normalizeFavoriteIds } from "../lib/favoritesModel.js";

const FAVORITE_PRODUCTS_SELECT_FIELDS =
  "id,name,price,discount_price,images,status,quantity,category_id,icon,brand,description,rating,review_count,reviews_count,sold,product_type,created_at";
const FAVORITES_REFRESH_ERROR_MESSAGE = "تعذر تحميل المفضلة حالياً.";

/**
 * Loads live product snapshots for the saved favorite ids.
 *
 * @param {{ client?: typeof supabase, productIds: Array<unknown> }} input
 * @returns {Promise<Array<Record<string, unknown>>>}
 * @throws {Error}
 */
export async function fetchFavoriteProductSnapshots({ client = supabase, productIds }) {
  const normalizedIds = normalizeFavoriteIds(productIds);
  if (normalizedIds.length === 0) {
    return [];
  }

  const response = await client
    .from("products")
    .select(FAVORITE_PRODUCTS_SELECT_FIELDS)
    .in("id", normalizedIds)
    .in("status", ["active", "out_of_stock"]);

  if (response?.error) {
    throw new Error(FAVORITES_REFRESH_ERROR_MESSAGE);
  }

  return Array.isArray(response?.data) ? response.data : [];
}
