/**
 * Favorites data access helpers for retrieving saved product snapshots from Supabase.
 */

import { normalizeFavoriteIds } from "../lib/favoritesModel.js";
import { loadSupabaseClient } from "../lib/loadSupabaseClient.js";
import { mapProductsExplorerProduct } from "../lib/productsExplorerModel.js";

const FAVORITE_PRODUCTS_SELECT_FIELDS =
  "id,name,price,discount_price,images,status,quantity,category_id,icon,brand,description,rating,review_count,sold,product_type,created_at";
const FAVORITES_REFRESH_ERROR_MESSAGE = "[FAV-301] تعذر تحميل المفضلة حالياً.";
const FAVORITES_CATEGORY_FALLBACK = "منتجات عامة";

/**
 * Loads live product snapshots for the saved favorite ids.
 *
 * @param {{ client?: Record<string, unknown>, productIds: Array<unknown> }} input
 * @returns {Promise<Array<Record<string, unknown>>>}
 * @throws {Error}
 */
export async function fetchFavoriteProductSnapshots({ client, productIds }) {
  const normalizedIds = normalizeFavoriteIds(productIds);
  if (normalizedIds.length === 0) {
    return [];
  }

  const resolvedClient = client || await loadSupabaseClient();
  const response = await resolvedClient
    .from("products")
    .select(FAVORITE_PRODUCTS_SELECT_FIELDS)
    .in("id", normalizedIds)
    .in("status", ["active", "out_of_stock"]);

  if (response?.error) {
    throw new Error(FAVORITES_REFRESH_ERROR_MESSAGE);
  }

  return Array.isArray(response?.data) ? response.data : [];
}

/**
 * Loads the visible category names for the provided favorite products.
 *
 * @param {{ categoryIds: Array<unknown>, client?: Record<string, unknown> }} input
 * @returns {Promise<Record<string, string>>}
 * @throws {Error}
 */
export async function fetchFavoriteCategoryMap({ categoryIds, client }) {
  const normalizedIds = normalizeFavoriteIds(categoryIds);
  if (normalizedIds.length === 0) {
    return {};
  }

  const resolvedClient = client || await loadSupabaseClient();
  const response = await resolvedClient
    .from("categories")
    .select("id,name")
    .in("id", normalizedIds)
    .eq("status", "active");

  if (response?.error) {
    throw new Error(FAVORITES_REFRESH_ERROR_MESSAGE);
  }

  return Object.fromEntries((response.data || []).map((category) => [category.id, category.name]));
}

/**
 * Sorts favorite products according to the saved favorites order.
 *
 * @param {{ favoriteIds: Array<unknown>, products: Array<Record<string, unknown>> }} input
 * @returns {Array<Record<string, unknown>>}
 */
export function sortFavoriteProducts({ favoriteIds, products }) {
  const positions = Object.fromEntries(normalizeFavoriteIds(favoriteIds).map((id, index) => [id, index]));
  return [...(Array.isArray(products) ? products : [])].sort(
    (first, second) =>
      (positions[first.id] ?? Number.MAX_SAFE_INTEGER) - (positions[second.id] ?? Number.MAX_SAFE_INTEGER)
  );
}

/**
 * Maps favorite product rows into the shared product-card contract.
 *
 * @param {{
 *   categoryMap?: Record<string, string>,
 *   favoriteIds: Array<unknown>,
 *   products: Array<Record<string, unknown>>,
 * }} input
 * @returns {Array<Record<string, unknown>>}
 */
export function mapFavoriteProductsForDisplay({ categoryMap = {}, favoriteIds, products }) {
  return sortFavoriteProducts({
    favoriteIds,
    products: (Array.isArray(products) ? products : []).map((product) =>
      mapProductsExplorerProduct(product, categoryMap[product.category_id] || FAVORITES_CATEGORY_FALLBACK)
    ),
  });
}
