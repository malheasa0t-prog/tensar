/**
 * Pure helpers for building and parsing shareable favorites links.
 */

import { normalizeFavoriteIds } from "./favoritesModel.js";

export const FAVORITES_SHARE_QUERY_PARAM = "items";
const FAVORITES_SHARE_PATH = "/favorites/shared";

/**
 * Encodes favorite ids into a compact query-string friendly value.
 *
 * @param {Array<unknown>} favoriteIds
 * @returns {string}
 */
export function encodeFavoritesShareIds(favoriteIds) {
  return normalizeFavoriteIds(favoriteIds).join(",");
}

/**
 * Decodes a favorites share token into normalized product ids.
 *
 * @param {unknown} value
 * @returns {string[]}
 */
export function decodeFavoritesShareIds(value) {
  if (typeof value !== "string" || !value.trim()) {
    return [];
  }

  return normalizeFavoriteIds(value.split(","));
}

/**
 * Builds the internal route used for shared favorites pages.
 *
 * @param {Array<unknown>} favoriteIds
 * @returns {string}
 */
export function buildFavoritesSharePath(favoriteIds) {
  const encodedIds = encodeFavoritesShareIds(favoriteIds);
  if (!encodedIds) {
    return "";
  }

  const params = new URLSearchParams();
  params.set(FAVORITES_SHARE_QUERY_PARAM, encodedIds);
  return `${FAVORITES_SHARE_PATH}?${params.toString()}`;
}

/**
 * Builds an absolute share URL when an origin is available.
 *
 * @param {{ favoriteIds: Array<unknown>, origin?: string }} input
 * @returns {string}
 */
export function buildFavoritesShareUrl({ favoriteIds, origin = "" }) {
  const sharePath = buildFavoritesSharePath(favoriteIds);
  if (!sharePath) {
    return "";
  }

  if (typeof origin !== "string" || !origin.trim()) {
    return sharePath;
  }

  try {
    return new URL(sharePath, origin).toString();
  } catch {
    return sharePath;
  }
}
