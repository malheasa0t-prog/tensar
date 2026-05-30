"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  FAVORITES_STORAGE_KEY,
  hasFavoriteId,
  parseFavoriteIds,
  removeFavoriteId,
  toggleFavoriteId,
} from "@/lib/favoritesModel";

const FavoritesContext = createContext(null);

/**
 * Returns the shared favorites state and actions.
 *
 * @returns {{
 *   favoriteCount: number,
 *   favoriteIds: string[],
 *   hasHydratedFavorites: boolean,
 *   isFavorite: (productId: unknown) => boolean,
 *   clearFavorites: () => void,
 *   removeFavorite: (productId: unknown) => void,
 *   toggleFavorite: (productId: unknown) => { isFavorite: boolean, isAtLimit: boolean },
 * }}
 */
export function useFavorites() {
  return useContext(FavoritesContext);
}

/**
 * Provides synchronized browser-local favorites across the site.
 *
 * @param {{ children: import("react").ReactNode }} props
 * @returns {import("react").JSX.Element}
 */
export default function FavoritesProvider({ children }) {
  const [favoriteIds, setFavoriteIds] = useState([]);
  const [hasHydratedFavorites, setHasHydratedFavorites] = useState(false);

  useEffect(() => {
    try {
      setFavoriteIds(parseFavoriteIds(window.localStorage.getItem(FAVORITES_STORAGE_KEY)));
    } finally {
      setHasHydratedFavorites(true);
    }
  }, []);

  useEffect(() => {
    if (!hasHydratedFavorites) {
      return undefined;
    }

    /**
     * Keeps favorites synchronized between browser tabs.
     *
     * @param {StorageEvent} event
     * @returns {void}
     */
    function handleStorage(event) {
      if (event.key === FAVORITES_STORAGE_KEY) {
        setFavoriteIds(parseFavoriteIds(event.newValue));
      }
    }

    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, [hasHydratedFavorites]);

  useEffect(() => {
    if (!hasHydratedFavorites) {
      return;
    }

    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favoriteIds));
  }, [favoriteIds, hasHydratedFavorites]);

  const toggleFavorite = useCallback(
    (productId) => {
      const result = toggleFavoriteId(favoriteIds, productId);
      setFavoriteIds(result.favoriteIds);
      return { isFavorite: result.isFavorite, isAtLimit: result.isAtLimit };
    },
    [favoriteIds]
  );

  const removeFavorite = useCallback((productId) => {
    setFavoriteIds((currentIds) => removeFavoriteId(currentIds, productId));
  }, []);

  const clearFavorites = useCallback(() => {
    setFavoriteIds([]);
  }, []);

  const isFavorite = useCallback((productId) => hasFavoriteId(favoriteIds, productId), [favoriteIds]);

  const contextValue = useMemo(
    () => ({
      favoriteCount: favoriteIds.length,
      favoriteIds,
      hasHydratedFavorites,
      isFavorite,
      clearFavorites,
      removeFavorite,
      toggleFavorite,
    }),
    [clearFavorites, favoriteIds, hasHydratedFavorites, isFavorite, removeFavorite, toggleFavorite]
  );

  return <FavoritesContext.Provider value={contextValue}>{children}</FavoritesContext.Provider>;
}
