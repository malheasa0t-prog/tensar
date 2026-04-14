/**
 * Cart availability helpers for client and server validation.
 */

const ACTIVE_PRODUCT_STATUS = "active";
const MAX_CART_ITEM_QTY = 99;
const INVALID_PRODUCT_MESSAGE = "تعذر إضافة المنتج حالياً.";
const INVALID_QUANTITY_MESSAGE = "الكمية المطلوبة غير صالحة.";
const UNAVAILABLE_PRODUCT_MESSAGE = "هذا المنتج غير متاح حالياً.";
const OUT_OF_STOCK_MESSAGE = "نفد مخزون هذا المنتج حالياً.";
const MAX_CART_ITEM_QTY_MESSAGE = `الحد الأقصى للكمية في السلة هو ${MAX_CART_ITEM_QTY}.`;

/**
 * Normalizes product status values for availability checks.
 *
 * @param {unknown} status
 * @returns {string}
 */
function normalizeProductStatus(status) {
  return typeof status === "string" && status.trim() ? status.trim().toLowerCase() : ACTIVE_PRODUCT_STATUS;
}

/**
 * Returns the first finite stock value found on a product record.
 *
 * @param {Record<string, unknown> | null | undefined} product
 * @returns {number | null}
 */
function resolveProductStock(product) {
  const candidates = [
    product?.quantity,
    product?.stock,
    product?.inventory_quantity,
    product?.available_quantity,
  ];

  for (const candidate of candidates) {
    const parsed = Number(candidate);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

/**
 * Normalizes the requested quantity for cart changes.
 *
 * @param {unknown} nextQty
 * @returns {number | null}
 */
function normalizeRequestedQuantity(nextQty) {
  const parsed = Number(nextQty);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Validates the per-item quantity cap applied inside the cart.
 *
 * @param {number} desiredQty
 * @returns {{ ok: boolean, message: string, availableStock: number | null } | null}
 */
function validateCartQuantityLimit(desiredQty) {
  if (desiredQty > MAX_CART_ITEM_QTY) {
    return { ok: false, message: MAX_CART_ITEM_QTY_MESSAGE, availableStock: null };
  }

  return null;
}

/**
 * Validates whether a product can be added to the cart with the requested quantity.
 *
 * @param {{ product: Record<string, unknown> | null | undefined, nextQty: unknown }} input
 * @returns {{ ok: boolean, message: string, availableStock: number | null }}
 */
export function validateCartChange({ product, nextQty }) {
  const desiredQty = normalizeRequestedQuantity(nextQty);

  if (!product || typeof product !== "object") {
    return { ok: false, message: INVALID_PRODUCT_MESSAGE, availableStock: null };
  }

  if (desiredQty === null) {
    return { ok: false, message: INVALID_QUANTITY_MESSAGE, availableStock: null };
  }

  const quantityLimitResult = validateCartQuantityLimit(desiredQty);
  if (quantityLimitResult) {
    return quantityLimitResult;
  }

  if (normalizeProductStatus(product.status) !== ACTIVE_PRODUCT_STATUS) {
    return { ok: false, message: UNAVAILABLE_PRODUCT_MESSAGE, availableStock: null };
  }

  const availableStock = resolveProductStock(product);
  if (availableStock !== null && availableStock <= 0) {
    return { ok: false, message: OUT_OF_STOCK_MESSAGE, availableStock };
  }

  if (availableStock !== null && desiredQty > availableStock) {
    return {
      ok: false,
      message: `الكمية المتاحة حالياً هي ${availableStock} فقط.`,
      availableStock,
    };
  }

  return { ok: true, message: "", availableStock };
}
