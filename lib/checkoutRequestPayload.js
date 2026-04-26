/**
 * Checkout request payload helpers.
 */

/**
 * Normalizes one checkout cart item for transport.
 *
 * @param {Record<string, unknown>} item - Raw cart item.
 * @returns {{ id: string, qty: number }} Normalized item payload.
 */
function normalizeCheckoutPayloadItem(item) {
  return {
    id: String(item?.id || "").trim(),
    qty: Number(item?.qty) || 1,
  };
}

/**
 * Builds an allow-listed checkout payload from cart items and form data.
 *
 * @param {{ form: Record<string, unknown>, items: Array<Record<string, unknown>> }} input - Checkout source values.
 * @returns {Record<string, unknown>} Sanitized checkout payload.
 */
export function buildCheckoutRequestPayload(input) {
  const form = input?.form || {};
  const items = Array.isArray(input?.items) ? input.items : [];

  return {
    items: items.map(normalizeCheckoutPayloadItem),
    customer_name: String(form.customer_name || "").trim(),
    customer_phone: String(form.customer_phone || "").trim(),
    customer_email: String(form.customer_email || "").trim(),
    customer_contact_link: String(form.customer_contact_link || "").trim(),
    delivery_method: String(form.delivery_method || "delivery").trim(),
    payment_method: String(form.payment_method || "cod").trim(),
    notes: String(form.notes || "").trim(),
  };
}
