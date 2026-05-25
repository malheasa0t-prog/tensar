"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useToast } from "./ToastProvider";
import { trackAddToCart } from "@/lib/analyticsModel";
import { validateCartChange } from "@/lib/cartAvailabilityModel";
import { getCartProductIds, toCartNumber } from "@/lib/cartProviderModel";
import { buildCartStorageKey, parseStoredCartItems, resolveCartOwnerKey } from "@/lib/cartStorageModel";
import {
  buildCartRevalidationNotice,
  mergeCartItemsWithServerProducts,
  revalidateCartAgainstServer,
} from "@/lib/cartSyncModel";
import { PUBLIC_ANALYTICS_CONFIG } from "@/lib/publicAnalyticsConfig";

const CartContext = createContext(null);
const LEGACY_CART_STORAGE_KEY = "tz_next_cart";
const DEFAULT_ADD_ERROR_MESSAGE = "تعذر إضافة المنتج حاليًا.";
const MISSING_ITEM_ERROR_MESSAGE = "المنتج غير موجود في السلة.";
const GUEST_CART_STORAGE_KEY = buildCartStorageKey("guest");

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
  const activeCartStorageKeyRef = useRef(GUEST_CART_STORAGE_KEY);
  const { showToast } = useToast() || {};

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

  /**
   * Reconciles the cart against the live catalog. Deletes items whose product
   * disappeared / was disabled / went out of stock, and clamps quantities to
   * the new server stock. Returns the diff so the caller can surface a toast.
   */
  const revalidateCartItems = useCallback(async (cartItems) => {
    const productIds = getCartProductIds(cartItems);
    if (productIds.length === 0) {
      return { removedIds: [], clampedItems: [] };
    }

    try {
      const { fetchCartProductSnapshots } = await import("@/services/cartService");
      const serverProducts = await fetchCartProductSnapshots({ productIds });
      const reconciliation = revalidateCartAgainstServer({
        cartItems,
        serverProducts,
      });
      if (reconciliation.removedIds.length > 0 || reconciliation.clampedItems.length > 0) {
        setItems(reconciliation.items);
        const notice = buildCartRevalidationNotice(reconciliation);
        if (notice && typeof showToast === "function") {
          showToast(notice, { type: "info", title: "تحديث السلة" });
        }
      }
      return {
        removedIds: reconciliation.removedIds,
        clampedItems: reconciliation.clampedItems,
      };
    } catch (error) {
      console.error("[CRT-303] Failed to revalidate cart:", error);
      return { removedIds: [], clampedItems: [] };
    }
  }, [showToast]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};

    /**
     * Loads only the cart owned by the current auth session.
     *
     * @param {{ user?: { id?: string | null } | null } | null | undefined} session
     * @returns {void}
     */
    function hydrateCartForSession(session) {
      const ownerKey = resolveCartOwnerKey(session);
      const storageKey = buildCartStorageKey(ownerKey);
      const isGuestCart = storageKey === GUEST_CART_STORAGE_KEY;
      const raw = localStorage.getItem(storageKey)
        || (isGuestCart ? localStorage.getItem(LEGACY_CART_STORAGE_KEY) : null);
      const parsed = parseStoredCartItems(raw);

      activeCartStorageKeyRef.current = storageKey;
      itemsRef.current = parsed;
      setItems(parsed);
      setHasHydratedCart(true);
      if (isGuestCart) {
        localStorage.removeItem(LEGACY_CART_STORAGE_KEY);
      }
      if (parsed.length > 0) {
        void revalidateCartItems(parsed);
      }
    }

    /**
     * Watches Supabase auth changes so shared devices do not leak carts.
     *
     * @returns {Promise<void>}
     */
    async function attachCartAuthBoundary() {
      const { loadSupabaseClient } = await import("@/lib/loadSupabaseClient");
      const supabase = await loadSupabaseClient();
      const sessionResult = await supabase.auth.getSession();

      if (!active) {
        return;
      }

      hydrateCartForSession(sessionResult?.data?.session);
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, session) => {
        void event;
        hydrateCartForSession(session);
      });

      unsubscribe = () => subscription.unsubscribe();
    }

    void attachCartAuthBoundary().catch(() => null);

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!hasHydratedCart) {
      return;
    }

    localStorage.setItem(activeCartStorageKeyRef.current, JSON.stringify(items));
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

      trackedProduct = { ...product, price: toCartNumber(product?.price), qty: 1 };
      if (existing) {
        return prev.map((item) =>
          item.id === product.id
            ? {
                ...item,
                originalPrice: toCartNumber(product.originalPrice) || item.originalPrice || item.price,
                price: toCartNumber(product.price) || item.price,
                qty: nextQty,
              }
            : item
        );
      }

      return [
        ...prev,
        {
          ...product,
          originalPrice: toCartNumber(product.originalPrice) || toCartNumber(product.price),
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
  const cartTotal = items.reduce((sum, item) => sum + toCartNumber(item.price) * item.qty, 0);
  const cartSavings = items.reduce((sum, item) => {
    const originalPrice = toCartNumber(item.originalPrice);
    const livePrice = toCartNumber(item.price);
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
        revalidateCart: () => revalidateCartItems(itemsRef.current),
      }}
    >
      {children}
    </CartContext.Provider>
  );
}
