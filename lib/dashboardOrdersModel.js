export const PRODUCT_STATUS_MAP = {
  awaiting_delivery: { label: 'بانتظار التنفيذ', color: '#f39c12', icon: '⏳' },
  pending: { label: 'قيد الانتظار', color: '#f39c12', icon: '⏳' },
  confirmed: { label: 'تم التأكيد', color: '#3498db', icon: '📞' },
  processing: { label: 'قيد التجهيز', color: '#8e44ad', icon: '📦' },
  shipped: { label: 'تم الشحن', color: '#2980b9', icon: '🚚' },
  delivered: { label: 'تم التسليم', color: '#2ecc71', icon: '✅' },
  completed: { label: 'مكتمل', color: '#2ecc71', icon: '✅' },
  cancelled: { label: 'ملغي', color: '#95a5a6', icon: '🚫' },
  failed: { label: 'فشل', color: '#e74c3c', icon: '❌' },
};

export const DIGITAL_STATUS_MAP = {
  pending: { label: 'قيد الانتظار', color: '#f39c12', icon: '⏳' },
  processing: { label: 'جاري المعالجة', color: '#3498db', icon: '🔄' },
  in_progress: { label: 'قيد التنفيذ', color: '#9b59b6', icon: '⚙️' },
  completed: { label: 'مكتمل', color: '#2ecc71', icon: '✅' },
  partial: { label: 'تنفيذ جزئي', color: '#e67e22', icon: '⚠️' },
  failed: { label: 'فشل', color: '#e74c3c', icon: '❌' },
  cancelled: { label: 'ملغي', color: '#95a5a6', icon: '🚫' },
  refunded: { label: 'مسترجع', color: '#1abc9c', icon: '💰' },
};

export const REPAIR_STATUS_MAP = {
  pending: { label: 'بانتظار المراجعة', color: '#f39c12', icon: '🛠️' },
  received: { label: 'تم الاستلام', color: '#3498db', icon: '📥' },
  diagnosing: { label: 'قيد التشخيص', color: '#8e44ad', icon: '🔍' },
  waiting_approval: { label: 'بانتظار الموافقة', color: '#e67e22', icon: '📋' },
  in_progress: { label: 'قيد الصيانة', color: '#9b59b6', icon: '⚙️' },
  ready: { label: 'جاهز للاستلام', color: '#2ecc71', icon: '🎉' },
  completed: { label: 'مكتمل', color: '#2ecc71', icon: '✅' },
  cancelled: { label: 'ملغي', color: '#95a5a6', icon: '🚫' },
};

export const DASHBOARD_ORDER_FILTERS = [
  { key: 'all', label: 'الكل' },
  { key: 'products', label: 'طلبات المنتجات' },
  { key: 'digital', label: 'الشحن والخدمات الرقمية' },
  { key: 'repairs', label: 'حجوزات الصيانة' },
];

/**
 * Formats monetary values for dashboard cards.
 *
 * @param {number | string | null | undefined} value
 * @returns {string}
 */
export function formatDashboardMoney(value) {
  return `${Number(value || 0).toFixed(2)} د.أ`;
}

/**
 * Formats a simple date in the local Arabic locale.
 *
 * @param {string | null | undefined} value
 * @returns {string}
 */
export function formatDashboardDate(value) {
  if (!value) {
    return 'غير متاح';
  }

  return new Date(value).toLocaleDateString('ar-JO');
}

/**
 * Formats a date and time in the local Arabic locale.
 *
 * @param {string | null | undefined} value
 * @returns {string}
 */
export function formatDashboardDateTime(value) {
  if (!value) {
    return 'غير متاح';
  }

  return new Date(value).toLocaleString('ar-JO');
}

/**
 * Formats the payment method label displayed in product orders.
 *
 * @param {string | null | undefined} method
 * @returns {string}
 */
export function getDashboardPaymentLabel(method) {
  const labels = {
    cod: 'الدفع عند الاستلام',
    bank_transfer: 'تحويل بنكي',
    wallet: 'محفظة',
  };

  return labels[method] || method || 'غير محدد';
}

/**
 * Formats the delivery method label displayed in product orders.
 *
 * @param {string | null | undefined} method
 * @returns {string}
 */
export function getDashboardDeliveryLabel(method) {
  const labels = {
    delivery: 'توصيل',
    pickup: 'استلام من المحل',
  };

  return labels[method] || method || 'غير محدد';
}

/**
 * Formats the repair mode label displayed in repair bookings.
 *
 * @param {string | null | undefined} mode
 * @returns {string}
 */
export function getDashboardRepairModeLabel(mode) {
  const labels = {
    delivery: 'استلام وتوصيل',
    pickup: 'أحضره إلى المحل',
  };

  return labels[mode] || mode || 'غير محدد';
}

/**
 * Builds the top summary counters for the orders dashboard.
 *
 * @param {{
 *   productOrders: Array<unknown>,
 *   serviceOrders: Array<unknown>,
 *   repairBookings: Array<unknown>,
 * }} data
 * @returns {{ total: number, products: number, digital: number, repairs: number }}
 */
export function buildDashboardOrdersStats({
  productOrders = [],
  serviceOrders = [],
  repairBookings = [],
}) {
  return {
    total: productOrders.length + serviceOrders.length + repairBookings.length,
    products: productOrders.length,
    digital: serviceOrders.length,
    repairs: repairBookings.length,
  };
}
