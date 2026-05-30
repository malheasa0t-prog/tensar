/**
 * Pure invoice/receipt model builder for customer orders.
 *
 * Shapes a stored order + its line items + site settings into a flat,
 * render-ready invoice object. Kept side-effect free so it can be unit tested;
 * the actual printing/PDF step lives in printInvoice.js.
 */

/**
 * Formats an order number for display (prefers the public display number).
 *
 * @param {{ display_number?: number|string, id?: string }} order
 * @returns {string}
 */
export function formatInvoiceNumber(order) {
  const displayNumber = Number(order?.display_number || 0);
  if (Number.isInteger(displayNumber) && displayNumber > 0) {
    return `#${displayNumber}`;
  }
  return String(order?.id || '-').trim() || '-';
}

/**
 * Builds a render-ready invoice model from an order and its items.
 *
 * @param {{ order: Record<string, unknown>, items?: Array<Record<string, unknown>>, settings?: Record<string, unknown> }} input
 * @returns {{
 *   number: string,
 *   date: string,
 *   customer: { name: string, phone: string, email: string },
 *   company: { name: string, phone: string, email: string },
 *   lines: Array<{ name: string, qty: number, price: number, lineTotal: number }>,
 *   subtotal: number,
 *   shipping: number,
 *   discount: number,
 *   couponCode: string,
 *   total: number,
 *   status: string,
 * }}
 */
export function buildInvoiceModel({ order = {}, items = [], settings = {} }) {
  const company = settings.company && typeof settings.company === 'object' ? settings.company : {};

  const lines = (Array.isArray(items) ? items : []).map((item) => {
    const qty = Number(item.qty) || 0;
    const price = Number(item.price) || 0;
    return {
      name: String(item.product_name || item.name || '-'),
      qty,
      price,
      lineTotal: Math.round((qty * price + Number.EPSILON) * 100) / 100,
    };
  });

  const computedSubtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const subtotal = Number(order.subtotal) || computedSubtotal;
  const shipping = Number(order.shipping_fee) || 0;
  const discount = Number(order.discount_amount) || 0;
  const total = Number(order.total) || Math.max(0, subtotal + shipping - discount);

  return {
    number: formatInvoiceNumber(order),
    date: String(order.created_at || order.createdAt || ''),
    customer: {
      name: String(order.customer_name || ''),
      phone: String(order.customer_phone || ''),
      email: String(order.customer_email || ''),
    },
    company: {
      name: String(company.name || 'TechZone'),
      phone: String(company.phone || ''),
      email: String(company.email || ''),
    },
    lines,
    subtotal: Math.round((subtotal + Number.EPSILON) * 100) / 100,
    shipping,
    discount,
    couponCode: String(order.coupon_code || ''),
    total: Math.round((total + Number.EPSILON) * 100) / 100,
    status: String(order.status || ''),
  };
}
