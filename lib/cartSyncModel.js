/**
 * Cart synchronization helpers for merging stored cart items with live catalog data.
 */

const DEFAULT_PRICE = 0;
const SINGLE_ITEM_COUNT = 1;
const AUTH_SIGNED_OUT_EVENT = "SIGNED_OUT";

/**
 * Converts a value to a finite number when possible.
 *
 * @param {unknown} value
 * @returns {number | null}
 */
function toFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Chooses the best available unit price from the server payload.
 *
 * @param {{ serverProduct: Record<string, unknown> | null | undefined, fallbackPrice: unknown }} input
 * @returns {number}
 */
function resolveServerProductPrice({ serverProduct, fallbackPrice }) {
  const discountPrice = toFiniteNumber(serverProduct?.discount_price ?? serverProduct?.discountPrice);
  if (discountPrice !== null && discountPrice > 0) {
    return discountPrice;
  }

  const basePrice = toFiniteNumber(serverProduct?.price);
  if (basePrice !== null && basePrice > 0) {
    return basePrice;
  }

  return toFiniteNumber(fallbackPrice) ?? DEFAULT_PRICE;
}

/**
 * Chooses the original reference price used to compute savings.
 *
 * @param {{ serverProduct: Record<string, unknown> | null | undefined, fallbackPrice: unknown }} input
 * @returns {number}
 */
function resolveServerOriginalPrice({ serverProduct, fallbackPrice }) {
  const basePrice = toFiniteNumber(serverProduct?.price);
  if (basePrice !== null && basePrice > 0) {
    return basePrice;
  }

  return toFiniteNumber(fallbackPrice) ?? DEFAULT_PRICE;
}

/**
 * Returns the next string value when it is not empty.
 *
 * @param {{ nextValue: unknown, fallbackValue: unknown }} input
 * @returns {string}
 */
function pickStringValue({ nextValue, fallbackValue }) {
  const normalized = typeof nextValue === "string" ? nextValue.trim() : "";
  return normalized || String(fallbackValue || "");
}

/**
 * Returns the next numeric value when it is finite.
 *
 * @param {{ nextValue: unknown, fallbackValue: unknown }} input
 * @returns {number | unknown}
 */
function pickNumericValue({ nextValue, fallbackValue }) {
  return toFiniteNumber(nextValue) ?? fallbackValue;
}

/**
 * Returns the next image list when it contains at least one value.
 *
 * @param {{ nextImages: unknown, fallbackImages: unknown }} input
 * @returns {Array<unknown>}
 */
function pickImageList({ nextImages, fallbackImages }) {
  if (Array.isArray(nextImages) && nextImages.length > 0) {
    return nextImages;
  }

  return Array.isArray(fallbackImages) ? fallbackImages : [];
}

/**
 * Determines whether two image arrays contain the same values in order.
 *
 * @param {{ currentImages: Array<unknown>, nextImages: Array<unknown> }} input
 * @returns {boolean}
 */
function hasMatchingImages({ currentImages, nextImages }) {
  if (currentImages.length !== nextImages.length) {
    return false;
  }

  return currentImages.every((image, index) => image === nextImages[index]);
}

/**
 * Merges one stored cart item with its live server product snapshot.
 *
 * @param {{ cartItem: Record<string, unknown>, serverProduct: Record<string, unknown> | null | undefined }} input
 * @returns {Record<string, unknown>}
 */
function mergeSingleCartItem({ cartItem, serverProduct }) {
  if (!serverProduct) {
    return cartItem;
  }

  const nextImages = pickImageList({ nextImages: serverProduct.images, fallbackImages: cartItem.images });
  const nextItem = {
    ...cartItem,
    name: pickStringValue({ nextValue: serverProduct.name, fallbackValue: cartItem.name }),
    originalPrice: resolveServerOriginalPrice({
      serverProduct,
      fallbackPrice: cartItem.originalPrice ?? cartItem.price,
    }),
    price: resolveServerProductPrice({ serverProduct, fallbackPrice: cartItem.price }),
    images: nextImages,
    status: pickStringValue({ nextValue: serverProduct.status, fallbackValue: cartItem.status }),
    category: pickStringValue({ nextValue: serverProduct.category, fallbackValue: cartItem.category }),
    icon: pickStringValue({ nextValue: serverProduct.icon, fallbackValue: cartItem.icon }),
    quantity: pickNumericValue({ nextValue: serverProduct.quantity, fallbackValue: cartItem.quantity }),
    stock: pickNumericValue({ nextValue: serverProduct.stock, fallbackValue: cartItem.stock }),
    inventory_quantity: pickNumericValue({
      nextValue: serverProduct.inventory_quantity,
      fallbackValue: cartItem.inventory_quantity,
    }),
    available_quantity: pickNumericValue({
      nextValue: serverProduct.available_quantity,
      fallbackValue: cartItem.available_quantity,
    }),
  };

  const hasSameImages = hasMatchingImages({
    currentImages: Array.isArray(cartItem.images) ? cartItem.images : [],
    nextImages,
  });
  const hasSameSnapshot =
    cartItem.name === nextItem.name &&
    cartItem.originalPrice === nextItem.originalPrice &&
    cartItem.price === nextItem.price &&
    cartItem.status === nextItem.status &&
    cartItem.category === nextItem.category &&
    cartItem.icon === nextItem.icon &&
    cartItem.quantity === nextItem.quantity &&
    cartItem.stock === nextItem.stock &&
    cartItem.inventory_quantity === nextItem.inventory_quantity &&
    cartItem.available_quantity === nextItem.available_quantity &&
    hasSameImages;

  return hasSameSnapshot ? cartItem : nextItem;
}

/**
 * Merges the stored cart with live server product snapshots.
 *
 * @param {{ cartItems: Array<Record<string, unknown>>, serverProducts: Array<Record<string, unknown>> }} input
 * @returns {Array<Record<string, unknown>>}
 */
export function mergeCartItemsWithServerProducts({ cartItems, serverProducts }) {
  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    return [];
  }

  const serverProductMap = new Map(
    (Array.isArray(serverProducts) ? serverProducts : [])
      .filter((product) => product && typeof product === "object" && product.id)
      .map((product) => [String(product.id), product])
  );
  const nextItems = cartItems.map((item) =>
    mergeSingleCartItem({ cartItem: item, serverProduct: serverProductMap.get(String(item?.id || "")) })
  );
  const hasChanges = nextItems.some((item, index) => item !== cartItems[index]);
  return hasChanges ? nextItems : cartItems;
}

/**
 * Returns whether the live product snapshot allows the item to remain in cart.
 *
 * Removed and inactive products are dropped so the user sees a clean cart
 * instead of being surprised at checkout. We treat a missing server snapshot
 * as "unavailable" — that's safer than carrying a phantom item that the
 * server will reject anyway.
 *
 * @param {Record<string, unknown> | null | undefined} serverProduct - Live product row.
 * @returns {boolean} True when the product can stay in the cart.
 */
function isProductStillAvailable(serverProduct) {
  if (!serverProduct || typeof serverProduct !== "object") return false;
  const status = String(serverProduct.status || "").trim().toLowerCase();
  if (status && status !== "active") return false;
  const quantity = toFiniteNumber(serverProduct.quantity);
  if (quantity !== null && quantity <= 0) return false;
  return true;
}

/**
 * Reconciles a cart against its live catalog snapshot.
 *
 * Produces three signals:
 *  - `items`: the new cart contents, with merged metadata and stock-clamped
 *    quantities.
 *  - `removedIds`: ids that disappeared because the product was deleted,
 *    disabled, or out of stock.
 *  - `clampedItems`: items whose stored quantity exceeded the new server
 *    stock and were trimmed.
 *
 * The CartProvider uses these to surface a toast so the user is not silently
 * deprived of items they think they have. Server-side checkout still
 * re-validates everything; this is UX-only.
 *
 * @param {{ cartItems: Array<Record<string, unknown>>, serverProducts: Array<Record<string, unknown>> }} input - Reconciliation input.
 * @returns {{
 *   items: Array<Record<string, unknown>>,
 *   removedIds: string[],
 *   clampedItems: Array<{ id: string, name: string, requestedQty: number, availableQty: number }>,
 * }} Reconciliation result.
 */
export function revalidateCartAgainstServer({ cartItems, serverProducts }) {
  const merged = mergeCartItemsWithServerProducts({ cartItems, serverProducts });
  const serverProductMap = new Map(
    (Array.isArray(serverProducts) ? serverProducts : [])
      .filter((product) => product && typeof product === "object" && product.id)
      .map((product) => [String(product.id), product])
  );

  const removedIds = [];
  const clampedItems = [];
  const items = [];

  for (const item of Array.isArray(merged) ? merged : []) {
    const itemId = String(item?.id || "").trim();
    if (!itemId) continue;
    const serverProduct = serverProductMap.get(itemId);
    if (!isProductStillAvailable(serverProduct)) {
      removedIds.push(itemId);
      continue;
    }
    const availableQuantity = toFiniteNumber(serverProduct.quantity);
    const requestedQty = toFiniteNumber(item.qty) ?? 0;
    if (availableQuantity !== null && requestedQty > availableQuantity) {
      clampedItems.push({
        id: itemId,
        name: String(item.name || serverProduct.name || ""),
        requestedQty,
        availableQty: availableQuantity,
      });
      items.push({ ...item, qty: availableQuantity });
    } else {
      items.push(item);
    }
  }

  return { items, removedIds, clampedItems };
}

/**
 * Builds the customer-facing message for cart reconciliation changes.
 *
 * @param {{ removedIds?: unknown, clampedItems?: unknown }} reconciliation
 * @returns {string}
 */
export function buildCartRevalidationNotice(reconciliation) {
  const removedCount = Array.isArray(reconciliation?.removedIds) ? reconciliation.removedIds.length : 0;
  const clampedCount = Array.isArray(reconciliation?.clampedItems) ? reconciliation.clampedItems.length : 0;
  const parts = [];

  if (removedCount > 0) {
    parts.push(
      `أزلنا ${removedCount} ${removedCount === SINGLE_ITEM_COUNT ? "عنصراً لم يعد متاحاً" : "عناصر لم تعد متاحة"}`
    );
  }

  if (clampedCount > 0) {
    parts.push(
      `عدّلنا كمية ${clampedCount} ${clampedCount === SINGLE_ITEM_COUNT ? "عنصر" : "عناصر"} حسب المخزون الحالي`
    );
  }

  return parts.length > 0 ? `تم تحديث السلة: ${parts.join("، ")}.` : "";
}

/**
 * Returns whether a cart stored on this browser should be reset for auth.
 *
 * @param {{ event?: unknown, nextUserId?: unknown, previousUserId?: unknown }} input
 * @returns {boolean}
 */
export function shouldResetCartForAuthTransition(input) {
  const event = String(input?.event || "").trim().toUpperCase();
  const previousUserId = String(input?.previousUserId || "").trim();
  const nextUserId = String(input?.nextUserId || "").trim();

  if (event === AUTH_SIGNED_OUT_EVENT) {
    return true;
  }

  return Boolean(previousUserId && nextUserId && previousUserId !== nextUserId);
}
