/**
 * Small helpers used by the cart provider state container.
 */

/**
 * Returns the valid product ids stored in a cart payload.
 *
 * @param {Array<Record<string, unknown>>} cartItems
 * @returns {string[]}
 */
export function getCartProductIds(cartItems) {
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
export function toCartNumber(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, "").trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}
