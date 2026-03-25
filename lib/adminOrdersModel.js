export const ADMIN_PRODUCT_STATUSES = [
  'awaiting_delivery',
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'completed',
  'cancelled',
  'failed',
];

export const ADMIN_DIGITAL_STATUSES = [
  'pending',
  'processing',
  'in_progress',
  'completed',
  'partial',
  'failed',
  'cancelled',
  'refunded',
];

export const ADMIN_ORDER_TABS = [
  { key: 'all', label: 'الكل' },
  { key: 'products', label: 'المتجر' },
  { key: 'digital', label: 'الرقمي' },
];

/**
 * Formats a currency value for the admin orders screen.
 *
 * @param {number | string | null | undefined} value
 * @returns {string}
 */
export function formatAdminOrderMoney(value) {
  return `${Number(value || 0).toFixed(2)} د.أ`;
}

/**
 * Formats a date-time value for the admin orders screen.
 *
 * @param {string | null | undefined} value
 * @returns {string}
 */
export function formatAdminOrderDateTime(value) {
  if (!value) {
    return 'غير متاح';
  }

  return new Date(value).toLocaleString('ar-JO');
}

/**
 * Returns the tab-filtered product and digital orders.
 *
 * @param {{
 *   activeTab: string,
 *   productOrders: Array<Record<string, unknown>>,
 *   digitalOrders: Array<Record<string, unknown>>,
 * }} params
 * @returns {{ visibleProductOrders: Array<Record<string, unknown>>, visibleDigitalOrders: Array<Record<string, unknown>> }}
 */
export function getVisibleAdminOrders({
  activeTab,
  productOrders = [],
  digitalOrders = [],
}) {
  return {
    visibleProductOrders:
      activeTab === 'all' || activeTab === 'products' ? productOrders : [],
    visibleDigitalOrders:
      activeTab === 'all' || activeTab === 'digital' ? digitalOrders : [],
  };
}
