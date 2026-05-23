import { formatCurrency } from "./formatCurrency.js";

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

export const REPAIR_STATUS_MAP = {
  pending: { label: 'بانتظار المراجعة', color: '#f39c12', icon: '🛠️' },
  received: { label: 'تم الاستلام', color: '#3498db', icon: '📥' },
  diagnosing: { label: 'قيد التشخيص', color: '#8e44ad', icon: '🔍' },
  waiting_approval: { label: 'بانتظار الموافقة', color: '#e67e22', icon: '📋' },
  in_progress: { label: 'قيد الصيانة', color: '#9b59b6', icon: '⚙️' },
  ready: { label: 'جاهز للاستلام', color: '#2ecc71', icon: '🎉' },
  completed: { label: 'مكتمل', color: '#2ecc71', icon: '✅' },
  completed_remote: { label: 'تمت الصيانة عن بعد', color: '#00cec9', icon: '💻' },
  cancelled: { label: 'ملغي', color: '#95a5a6', icon: '🚫' },
};

export const DASHBOARD_ORDER_FILTERS = [
  { key: 'all', label: 'الكل' },
  { key: 'products', label: 'طلبات المنتجات' },
  { key: 'repairs', label: 'حجوزات الصيانة' },
];

export function formatDashboardMoney(value) {
  return formatCurrency(value);
}

/**
 * Formats one customer-facing order number.
 *
 * @param {{ display_number?: number | string, displayNumber?: number | string, id?: string } | null | undefined} order
 * @returns {string}
 */
export function formatDashboardOrderNumber(order) {
  const displayNumber = Number(order?.display_number ?? order?.displayNumber);

  if (Number.isInteger(displayNumber) && displayNumber > 0) {
    return `#${displayNumber}`;
  }

  return String(order?.id || '-').trim() || '-';
}

export function formatDashboardDate(value) {
  if (!value) {
    return 'غير متاح';
  }

  return new Date(value).toLocaleDateString('ar-JO');
}

export function formatDashboardDateTime(value) {
  if (!value) {
    return 'غير متاح';
  }

  return new Date(value).toLocaleString('ar-JO');
}

export function getDashboardPaymentLabel(method) {
  const labels = {
    cod: 'الدفع عند الاستلام',
    bank_transfer: 'تحويل بنكي',
    wallet: 'محفظة',
  };

  return labels[method] || method || 'غير محدد';
}

export function getDashboardDeliveryLabel(method) {
  const labels = {
    delivery: 'توصيل',
    pickup: 'استلام من المحل',
  };

  return labels[method] || method || 'غير محدد';
}

export function getDashboardRepairModeLabel(mode) {
  const labels = {
    delivery: 'استلام وتوصيل',
    pickup: 'أحضره إلى المحل',
    remote: 'صيانة عن بعد',
  };

  return labels[mode] || mode || 'غير محدد';
}

/**
 * Builds the top summary counters for the orders dashboard.
 *
 * @param {{
 *   productOrders: Array<unknown>,
 *   repairBookings: Array<unknown>,
 * }} data
 * @returns {{ total: number, products: number, repairs: number }}
 */
export function buildDashboardOrdersStats({
  productOrders = [],
  repairBookings = [],
}) {
  return {
    total: productOrders.length + repairBookings.length,
    products: productOrders.length,
    repairs: repairBookings.length,
  };
}
