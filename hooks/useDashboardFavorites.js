"use client";

import { useCallback, useEffect, useState } from "react";
import { useCart } from "@/components/CartProvider";
import { useFavorites } from "@/components/FavoritesProvider";
import { useToast } from "@/components/ToastProvider";
import {
  fetchFavoriteCategoryMap,
  fetchFavoriteProductSnapshots,
  mapFavoriteProductsForDisplay,
} from "@/services/favoritesService";

const FAVORITES_LOAD_ERROR_MESSAGE = "[FAV-302] تعذر تحميل تفاصيل المفضلة حالياً.";
const FAVORITES_MOVE_TO_CART_ERROR_MESSAGE = "[FAV-303] تعذر نقل المنتج إلى السلة حالياً.";

/**
 * Manages the current-device favorites dashboard state and actions.
 *
 * @returns {{
 *   clearAllFavorites: () => void,
 *   error: string,
 *   favoriteCount: number,
 *   favoriteIds: string[],
 *   favoriteProducts: Array<Record<string, unknown>>,
 *   hasHydratedFavorites: boolean,
 *   loading: boolean,
 *   moveFavoriteToCart: (product: Record<string, unknown>) => void,
 *   removeFromFavorites: (productId: string) => void,
 * }}
 */
export function useDashboardFavorites() {
  const { addToCart, openSidebar } = useCart();
  const { clearFavorites, favoriteCount, favoriteIds, hasHydratedFavorites, removeFavorite } = useFavorites();
  const { showToast } = useToast();
  const [favoriteProducts, setFavoriteProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadFavorites() {
      if (!hasHydratedFavorites) {
        return;
      }

      if (favoriteIds.length === 0) {
        setFavoriteProducts([]);
        setError("");
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const rawProducts = await fetchFavoriteProductSnapshots({ productIds: favoriteIds });
        const categoryIds = [...new Set(rawProducts.map((product) => product.category_id).filter(Boolean))];
        const categoryMap = await fetchFavoriteCategoryMap({ categoryIds });
        const foundIds = new Set(rawProducts.map((product) => String(product.id)));

        if (!active) {
          return;
        }

        favoriteIds.filter((id) => !foundIds.has(id)).forEach((id) => removeFavorite(id));

        setFavoriteProducts(
          mapFavoriteProductsForDisplay({
            categoryMap,
            favoriteIds,
            products: rawProducts,
          })
        );
        setError("");
      } catch (loadError) {
        if (!active) {
          return;
        }

        setFavoriteProducts([]);
        setError(loadError instanceof Error ? loadError.message : FAVORITES_LOAD_ERROR_MESSAGE);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadFavorites();
    return () => {
      active = false;
    };
  }, [favoriteIds, hasHydratedFavorites, removeFavorite]);

  const removeFromFavorites = useCallback(
    (productId) => {
      removeFavorite(productId);
      showToast("تمت إزالة المنتج من المفضلة", { type: "success" });
    },
    [removeFavorite, showToast]
  );

  const clearAllFavorites = useCallback(() => {
    clearFavorites();
    showToast("تم مسح قائمة المفضلة", { type: "info" });
  }, [clearFavorites, showToast]);

  const moveFavoriteToCart = useCallback(
    (product) => {
      const result = addToCart({
        ...product,
        originalPrice: Number(product.price || 0),
        price: Number(product.discountPrice || product.discount_price || product.price || 0),
      });

      if (!result?.ok) {
        showToast(result?.message || FAVORITES_MOVE_TO_CART_ERROR_MESSAGE, { type: "error" });
        return;
      }

      removeFavorite(product.id);
      openSidebar();
      showToast("تم نقل المنتج إلى السلة", { type: "success" });
    },
    [addToCart, openSidebar, removeFavorite, showToast]
  );

  return {
    clearAllFavorites,
    error,
    favoriteCount,
    favoriteIds,
    favoriteProducts,
    hasHydratedFavorites,
    loading,
    moveFavoriteToCart,
    removeFromFavorites,
  };
}
