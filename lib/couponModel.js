/**
 * Pure coupon validation + discount computation.
 *
 * Shared between the storefront (preview) and the server checkout pipeline
 * (authoritative). The server always re-evaluates against the DB row so the
 * client can never inject a discount.
 */

export const COUPON_INVALID = "الكوبون غير صالح";
export const COUPON_INACTIVE = "هذا الكوبون غير مفعّل";
export const COUPON_EXPIRED = "انتهت صلاحية الكوبون";
export const COUPON_EXHAUSTED = "تم استنفاد عدد مرات استخدام الكوبون";
export const COUPON_MIN_ORDER = "قيمة الطلب أقل من الحد الأدنى لهذا الكوبون";

/**
 * Normalizes a coupon code for storage/lookup (trim + uppercase).
 *
 * @param {unknown} code
 * @returns {string}
 */
export function normalizeCouponCode(code) {
  return String(code == null ? "" : code).trim().toUpperCase();
}

/**
 * Rounds a money value to 2 decimals, guarding floating-point drift.
 *
 * @param {number} value
 * @returns {number}
 */
function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

/**
 * Validates a coupon row against an order subtotal and computes the discount.
 *
 * @param {{ coupon: Record<string, unknown> | null, subtotal: number, now?: number }} input
 * @returns {{ valid: boolean, discount: number, reason: string, code: string }}
 */
export function evaluateCoupon({ coupon, subtotal, now = Date.now() }) {
  const fail = (reason) => ({ valid: false, discount: 0, reason, code: "" });

  if (!coupon || typeof coupon !== "object") return fail(COUPON_INVALID);

  const numericSubtotal = Number(subtotal);
  if (!Number.isFinite(numericSubtotal) || numericSubtotal <= 0) return fail(COUPON_INVALID);

  if (String(coupon.status || "active") !== "active") return fail(COUPON_INACTIVE);

  if (coupon.expires_at) {
    const expiry = new Date(coupon.expires_at).getTime();
    if (Number.isFinite(expiry) && now > expiry) return fail(COUPON_EXPIRED);
  }

  const maxUses = coupon.max_uses == null ? null : Number(coupon.max_uses);
  const usedCount = Number(coupon.used_count) || 0;
  if (maxUses != null && Number.isFinite(maxUses) && usedCount >= maxUses) {
    return fail(COUPON_EXHAUSTED);
  }

  const minOrder = Number(coupon.min_order) || 0;
  if (numericSubtotal < minOrder) return fail(COUPON_MIN_ORDER);

  const value = Number(coupon.value) || 0;
  let discount;
  if (String(coupon.type) === "percentage") {
    discount = (numericSubtotal * value) / 100;
    const maxDiscount = coupon.max_discount == null ? null : Number(coupon.max_discount);
    if (maxDiscount != null && Number.isFinite(maxDiscount) && maxDiscount > 0) {
      discount = Math.min(discount, maxDiscount);
    }
  } else {
    // 'fixed' (or any non-percentage) → flat amount.
    discount = value;
  }

  // A discount can never exceed the subtotal or be negative.
  discount = roundMoney(Math.max(0, Math.min(discount, numericSubtotal)));

  if (discount <= 0) return fail(COUPON_INVALID);

  return { valid: true, discount, reason: "", code: normalizeCouponCode(coupon.code) };
}
