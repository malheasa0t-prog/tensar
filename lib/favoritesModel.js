/**
 * Favorites storage helpers shared across the public UI and dashboard pages.
 */

export const FAVORITES_STORAGE_KEY = "tz_favorites";
export const FAVORITES_MAX_ITEMS = 200;
export const FAVORITES_LIMIT_MESSAGE =
  "[FAV-104] وصلت إلى الحد الأقصى للمفضلة (200 منتج). احذف عناصر قبل إضافة المزيد.";

/**
 * Normalizes any favorite id list into a unique string array.
 *
 * @param {Array<unknown>} ids
 * @returns {string[]}
 */
export function normalizeFavoriteIds(ids) {
  if (!Array.isArray(ids) || ids.length === 0) {
    return [];
  }

  return [...new Set(ids.map((id) => String(id || "").trim()).filter(Boolean))];
}

/**
 * Parses a raw storage payload into normalized favorite ids.
 *
 * @param {string | null | undefined} rawValue
 * @returns {string[]}
 */
export function parseFavoriteIds(rawValue) {
  if (typeof rawValue !== "string" || rawValue.trim() === "") {
    return [];
  }

  try {
    return normalizeFavoriteIds(JSON.parse(rawValue));
  } catch (error) {
    return [];
  }
}

/**
 * Checks whether a product id exists inside the favorites list.
 *
 * @param {Array<unknown>} ids
 * @param {unknown} productId
 * @returns {boolean}
 */
export function hasFavoriteId(ids, productId) {
  const normalizedProductId = String(productId || "").trim();
  if (!normalizedProductId) {
    return false;
  }

  return normalizeFavoriteIds(ids).includes(normalizedProductId);
}

/**
 * Removes a favorite id from the current list.
 *
 * @param {Array<unknown>} ids
 * @param {unknown} productId
 * @returns {string[]}
 */
export function removeFavoriteId(ids, productId) {
  const normalizedProductId = String(productId || "").trim();
  if (!normalizedProductId) {
    return normalizeFavoriteIds(ids);
  }

  return normalizeFavoriteIds(ids).filter((id) => id !== normalizedProductId);
}

/**
 * Toggles a product id in the current favorites list.
 *
 * @param {Array<unknown>} ids
 * @param {unknown} productId
 * @returns {{ favoriteIds: string[], isFavorite: boolean, isAtLimit: boolean }}
 */
export function toggleFavoriteId(ids, productId) {
  const normalizedIds = normalizeFavoriteIds(ids);
  const normalizedProductId = String(productId || "").trim();

  if (!normalizedProductId) {
    return {
      favoriteIds: normalizedIds,
      isFavorite: false,
      isAtLimit: false,
    };
  }

  if (normalizedIds.includes(normalizedProductId)) {
    return {
      favoriteIds: normalizedIds.filter((id) => id !== normalizedProductId),
      isFavorite: false,
      isAtLimit: false,
    };
  }

  if (normalizedIds.length >= FAVORITES_MAX_ITEMS) {
    return {
      favoriteIds: normalizedIds,
      isFavorite: false,
      isAtLimit: true,
    };
  }

  return {
    favoriteIds: [...normalizedIds, normalizedProductId],
    isFavorite: true,
    isAtLimit: false,
  };
}
