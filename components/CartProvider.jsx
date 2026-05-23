"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { trackAddToCart } from "@/lib/analyticsModel";
import { validateCartChange } from "@/lib/cartAvailabilityModel";
import { mergeCartItemsWithServerProducts } from "@/lib/cartSyncModel";
import { PUBLIC_ANALYTICS_CONFIG } from "@/lib/publicAnalyticsConfig";

const CartContext = createContext(null);
const CART_STORAGE_KEY = "tz_next_cart";
const DEFAULT_ADD_ERROR_MESSAGE = "تعذر إضافة المنتج حاليًا.";
const MISSING_ITEM_ERROR_MESSAGE = "المنتج غير موجود في السلة.";

/**
 * Returns the valid product ids stored in the cart payload.
 *
 * @param {Array<Record<string, unknown>>} cartItems
 * @returns {string[]}
 */
function getCartProductIds(cartItems) {
  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    return [];
  }

  return cartItems.map((item) => String(item?.id || "").trim()).filter(Boolean);
}

/**
 * Converts mixed number-like values into safe finite numbers.
 *
 * @param {unknown} value
 * @returns {number}
 */
function toNumber(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const normalized = value.replace(/,/g, "").trim();
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

/**
 * Exposes the cart context to descendant components.
 *
 * @returns {ReturnType<typeof useContext>}
 */
export function useCart() {
  return useContext(CartContext);
}

/**
 * Stores the current cart state, persistence, and stock validation helpers.
 *
 * @param {{ children: React.ReactNode }} props
 * @returns {JSX.Element}
 */
export default function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [hasHydratedCart, setHasHydratedCart] = useState(false);
  const itemsRef = useRef([]);

  const refreshCartItems = useCallback(async (cartItems) => {
    const productIds = getCartProductIds(cartItems);
    if (productIds.length === 0) {
      return;
    }

    try {
      const { fetchCartProductSnapshots } = await import("@/services/cartService");
      const serverProducts = await fetchCartProductSnapshots({ productIds });
      setItems((prev) => mergeCartItemsWithServerProducts({ cartItems: prev, serverProducts }));
    } catch (error) {
      if (error instanceof Error) {
        console.error("[CRT-301] Failed to refresh cart items:", error);
      }
    }
  }, []);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CART_STORAGE_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setItems(parsed);
        void refreshCartItems(parsed);
      }
    } catch (error) {
      console.error("[CRT-302] Failed to hydrate cart storage:", error);
    } finally {
      setHasHydratedCart(true);
    }
  }, [refreshCartItems]);

  useEffect(() => {
    if (!hasHydratedCart) {
      return;
    }

    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [hasHydratedCart, items]);

  useEffect(() => {
    if (!sidebarOpen || itemsRef.current.length === 0) {
      return;
    }

    void refreshCartItems(itemsRef.current);
  }, [refreshCartItems, sidebarOpen]);

  const addToCart = useCallback((product) => {
    let result = { ok: false, message: DEFAULT_ADD_ERROR_MESSAGE, availableStock: null };
    let trackedProduct = null;

    setItems((prev) => {
      const existing = prev.find((item) => item.id === product?.id);
      const nextQty = existing ? existing.qty + 1 : 1;
      result = validateCartChange({ product, nextQty });

      if (!result.ok) {
        return prev;
      }

      trackedProduct = { ...product, price: toNumber(product?.price), qty: 1 };
      if (existing) {
        return prev.map((item) =>
          item.id === product.id
            ? {
                ...item,
                originalPrice: toNumber(product.originalPrice) || item.originalPrice || item.price,
                price: toNumber(product.price) || item.price,
                qty: nextQty,
              }
            : item
        );
      }

      return [
        ...prev,
        {
          ...product,
          originalPrice: toNumber(product.originalPrice) || toNumber(product.price),
          qty: 1,
        },
      ];
    });

    if (result.ok && trackedProduct) {
      trackAddToCart({ config: PUBLIC_ANALYTICS_CONFIG, product: trackedProduct });
    }

    return result;
  }, []);

  const removeFromCart = useCallback((productId) => {
    setItems((prev) => prev.filter((item) => item.id !== productId));
  }, []);

  const updateQty = useCallback((productId, qty) => {
    let result = { ok: true, message: "", availableStock: null };

    if (qty <= 0) {
      setItems((prev) => prev.filter((item) => item.id !== productId));
      return result;
    }

    setItems((prev) => {
      const currentItem = prev.find((item) => item.id === productId);
      if (!currentItem) {
        result = { ok: false, message: MISSING_ITEM_ERROR_MESSAGE, availableStock: null };
        return prev;
      }

      result = validateCartChange({ product: currentItem, nextQty: qty });
      if (!result.ok) {
        return prev;
      }

      return prev.map((item) => (item.id === productId ? { ...item, qty } : item));
    });

    return result;
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const cartCount = items.reduce((sum, item) => sum + item.qty, 0);
  const cartTotal = items.reduce((sum, item) => sum + toNumber(item.price) * item.qty, 0);
  const cartSavings = items.reduce((sum, item) => {
    const originalPrice = toNumber(item.originalPrice);
    const livePrice = toNumber(item.price);
    return sum + Math.max(0, originalPrice - livePrice) * item.qty;
  }, 0);

  const openSidebar = useCallback(() => setSidebarOpen(true), []);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  return (
    <CartContext.Provider
      value={{
        items,
        cartCount,
        cartSavings,
        cartTotal,
        addToCart,
        removeFromCart,
        updateQty,
        clearCart,
        sidebarOpen,
        openSidebar,
        closeSidebar,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}
