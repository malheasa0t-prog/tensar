import {
  PRODUCT_STATUS_MAP,
  REPAIR_STATUS_MAP,
  formatDashboardDateTime,
  getDashboardDeliveryLabel,
  getDashboardRepairModeLabel,
} from "../lib/dashboardOrdersModel.js";

const LOOKUP_TYPE_VALUES = new Set(["all", "repair", "delivery"]);
const ORDER_NUMBER_PATTERN = /^(ord|bk)-[a-z0-9-]+$/i;

/**
 * Normalizes the public lookup type into a supported value.
 *
 * @param {string | null | undefined} value
 * @returns {"all" | "repair" | "delivery"}
 */
export function normalizeLookupType(value) {
  const normalized = String(value || "all").trim().toLowerCase();
  return LOOKUP_TYPE_VALUES.has(normalized) ? normalized : "all";
}

/**
 * Validates and normalizes the entered order number.
 *
 * @param {string | null | undefined} value
 * @returns {string}
 * @throws {Error}
 */
export function normalizeOrderNumber(value) {
  const normalized = String(value || "").trim().toLowerCase();

  if (!ORDER_NUMBER_PATTERN.test(normalized)) {
    throw new Error("[OLK-101] أدخل رقم طلب صحيح مثل ord-123 أو bk-123.");
  }

  return normalized;
}

/**
 * Infers the best lookup type from the order prefix when possible.
 *
 * @param {{ lookupType: "all" | "repair" | "delivery", orderNumber: string }} input
 * @returns {"all" | "repair" | "delivery"}
 */
export function inferLookupType({ lookupType, orderNumber }) {
  if (orderNumber.startsWith("bk-")) return "repair";
  if (orderNumber.startsWith("ord-")) return "delivery";
  return lookupType;
}

/**
 * Maps a status value to a public-facing label and color.
 *
 * @param {{ requestType: "repair" | "delivery", status: string | null | undefined }} input
 * @returns {{ label: string, color: string }}
 */
export function resolveLookupStatus({ requestType, status }) {
  const statusMap = requestType === "repair" ? REPAIR_STATUS_MAP : PRODUCT_STATUS_MAP;
  const fallbackLabel = status || "غير معروف";
  const fallbackColor = requestType === "repair" ? "#8b5cf6" : "#06b6d4";
  const meta = statusMap[status || ""] || null;

  return {
    label: meta?.label || fallbackLabel,
    color: meta?.color || fallbackColor,
  };
}

/**
 * Builds a compact response payload for a public delivery lookup.
 *
 * @param {{ created_at?: string, delivery_method?: string, id: string, status?: string, updated_at?: string }} order
 * @returns {{
 *   details: Array<{ label: string, value: string }>,
 *   orderNumber: string,
 *   requestType: "delivery",
 *   requestTypeLabel: string,
 *   status: { color: string, label: string },
 *   title: string,
 * }}
 */
export function buildDeliveryLookupResult(order) {
  const status = resolveLookupStatus({ requestType: "delivery", status: order.status });

  return {
    orderNumber: order.id,
    requestType: "delivery",
    requestTypeLabel: "طلب توصيل",
    status,
    title: "متابعة طلب التوصيل",
    details: [
      { label: "رقم الطلب", value: order.id },
      { label: "طريقة الاستلام", value: getDashboardDeliveryLabel(order.delivery_method) },
      { label: "تاريخ الإنشاء", value: formatDashboardDateTime(order.created_at) },
      { label: "آخر تحديث", value: formatDashboardDateTime(order.updated_at || order.created_at) },
    ],
  };
}

/**
 * Builds a compact response payload for a public repair lookup.
 *
 * @param {{ created_at?: string, id: string, mode?: string, service_name?: string, status?: string, updated_at?: string }} booking
 * @returns {{
 *   details: Array<{ label: string, value: string }>,
 *   orderNumber: string,
 *   requestType: "repair",
 *   requestTypeLabel: string,
 *   status: { color: string, label: string },
 *   title: string,
 * }}
 */
export function buildRepairLookupResult(booking) {
  const status = resolveLookupStatus({ requestType: "repair", status: booking.status });

  return {
    orderNumber: booking.id,
    requestType: "repair",
    requestTypeLabel: "طلب صيانة",
    status,
    title: booking.service_name || "متابعة طلب الصيانة",
    details: [
      { label: "رقم الطلب", value: booking.id },
      { label: "طريقة التنفيذ", value: getDashboardRepairModeLabel(booking.mode) },
      { label: "تاريخ الإنشاء", value: formatDashboardDateTime(booking.created_at) },
      { label: "آخر تحديث", value: formatDashboardDateTime(booking.updated_at || booking.created_at) },
    ],
  };
}

/**
 * Loads a delivery order by its public order number.
 *
 * @param {{ adminClient: { from: (table: string) => { select: (columns: string) => { eq: (column: string, value: string) => unknown } } }, orderNumber: string }} input
 * @returns {Promise<{ created_at?: string, delivery_method?: string, id: string, status?: string, updated_at?: string } | null>}
 */
async function loadDeliveryOrder({ adminClient, orderNumber }) {
  const response = await adminClient
    .from("orders")
    .select("id, delivery_method, status, created_at, updated_at")
    .eq("id", orderNumber)
    .eq("delivery_method", "delivery")
    .maybeSingle();

  return response.data || null;
}

/**
 * Loads a repair booking by its public booking number.
 *
 * @param {{ adminClient: { from: (table: string) => { select: (columns: string) => { eq: (column: string, value: string) => { maybeSingle: () => Promise<{ data: Record<string, unknown> | null }> } } } }, orderNumber: string }} input
 * @returns {Promise<{ created_at?: string, id: string, mode?: string, service_name?: string, status?: string, updated_at?: string } | null>}
 */
async function loadRepairBooking({ adminClient, orderNumber }) {
  const response = await adminClient
    .from("repair_bookings")
    .select("id, service_name, mode, status, created_at, updated_at")
    .eq("id", orderNumber)
    .maybeSingle();

  return response.data || null;
}

/**
 * Resolves a public lookup request to either a repair booking or a delivery order.
 *
 * @param {{ adminClient: { from: (table: string) => { select: (columns: string) => { eq: (column: string, value: string) => unknown } } }, lookupType?: string, orderNumber?: string }} input
 * @returns {Promise<ReturnType<typeof buildDeliveryLookupResult> | ReturnType<typeof buildRepairLookupResult> | null>}
 * @throws {Error}
 */
export async function lookupPublicOrderByNumber({ adminClient, lookupType, orderNumber }) {
  const normalizedOrderNumber = normalizeOrderNumber(orderNumber);
  const normalizedType = inferLookupType({
    lookupType: normalizeLookupType(lookupType),
    orderNumber: normalizedOrderNumber,
  });

  const loaders = {
    repair: async () => {
      const booking = await loadRepairBooking({ adminClient, orderNumber: normalizedOrderNumber });
      return booking ? buildRepairLookupResult(booking) : null;
    },
    delivery: async () => {
      const deliveryOrder = await loadDeliveryOrder({ adminClient, orderNumber: normalizedOrderNumber });
      return deliveryOrder ? buildDeliveryLookupResult(deliveryOrder) : null;
    },
  };

  if (normalizedType !== "all") {
    return loaders[normalizedType]();
  }

  const [repairResult, deliveryResult] = await Promise.all([
    loaders.repair(),
    loaders.delivery(),
  ]);

  return repairResult || deliveryResult || null;
}
