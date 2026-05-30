import {
  PRODUCT_STATUS_MAP,
  REPAIR_STATUS_MAP,
  formatDashboardDateTime,
  formatDashboardOrderNumber,
  getDashboardDeliveryLabel,
  getDashboardRepairModeLabel,
} from "../lib/dashboardOrdersModel.js";

const LOOKUP_TYPE_VALUES = new Set(["all", "repair", "delivery"]);
const DISPLAY_ORDER_NUMBER_PATTERN = /^#?\d+$/;
const LEGACY_ORDER_NUMBER_PATTERN = /^(ord|bk)-[a-z0-9-]+$/i;
const LOOKUP_CONTACT_PATTERN = /^\d{4}$/;
const LOOKUP_CONTACT_ERROR =
  "[OLK-103] الرجاء إدخال آخر 4 أرقام من رقم الهاتف المرتبط بالطلب.";

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

  if (DISPLAY_ORDER_NUMBER_PATTERN.test(normalized)) {
    return normalized.startsWith("#") ? normalized : `#${normalized}`;
  }

  if (!LEGACY_ORDER_NUMBER_PATTERN.test(normalized)) {
    throw new Error("[OLK-101] أدخل رقم طلب صحيح مثل #2000 أو ord-123 أو bk-123.");
  }

  return normalized;
}

/**
 * Extracts the numeric display number from a normalized lookup value.
 *
 * @param {string} orderNumber
 * @returns {number | null}
 */
function getDisplayNumberValue(orderNumber) {
  if (!DISPLAY_ORDER_NUMBER_PATTERN.test(orderNumber)) {
    return null;
  }

  const displayNumber = Number(String(orderNumber).replace("#", ""));
  return Number.isInteger(displayNumber) && displayNumber > 0 ? displayNumber : null;
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
 * @param {{ created_at?: string, delivery_method?: string, display_number?: number, id: string, status?: string, updated_at?: string }} order
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
    orderNumber: formatDashboardOrderNumber(order),
    requestType: "delivery",
    requestTypeLabel: "طلب توصيل",
    status,
    title: "متابعة طلب التوصيل",
    details: [
      { label: "رقم الطلب", value: formatDashboardOrderNumber(order) },
      { label: "طريقة الاستلام", value: getDashboardDeliveryLabel(order.delivery_method) },
      { label: "تاريخ الإنشاء", value: formatDashboardDateTime(order.created_at) },
      { label: "آخر تحديث", value: formatDashboardDateTime(order.updated_at || order.created_at) },
    ],
  };
}

/**
 * Builds a compact response payload for a public repair lookup.
 *
 * @param {{ created_at?: string, display_number?: number, id: string, mode?: string, service_name?: string, status?: string, updated_at?: string }} booking
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
    orderNumber: formatDashboardOrderNumber(booking),
    requestType: "repair",
    requestTypeLabel: "طلب صيانة",
    status,
    title: booking.service_name || "متابعة طلب الصيانة",
    details: [
      { label: "رقم الطلب", value: formatDashboardOrderNumber(booking) },
      { label: "طريقة التنفيذ", value: getDashboardRepairModeLabel(booking.mode) },
      { label: "تاريخ الإنشاء", value: formatDashboardDateTime(booking.created_at) },
      { label: "آخر تحديث", value: formatDashboardDateTime(booking.updated_at || booking.created_at) },
    ],
  };
}

/**
 * Validates and normalizes the contact verification suffix.
 *
 * The public order lookup must NEVER return order metadata to anyone who
 * cannot prove they own the order. We require the last 4 digits of the
 * customer's phone number as a secondary key — an attacker enumerating
 * sequential display_numbers would need to brute-force 10,000 phone
 * combinations per order, which the rate limiter blocks.
 *
 * @param {string | null | undefined} value - Raw contact suffix from the request.
 * @returns {string} 4-digit string.
 * @throws {Error} When the suffix is missing or malformed.
 */
export function normalizeLookupContactSuffix(value) {
  const normalized = String(value || "").replace(/\D/g, "").trim();
  if (!LOOKUP_CONTACT_PATTERN.test(normalized)) {
    throw new Error(LOOKUP_CONTACT_ERROR);
  }
  return normalized;
}

/**
 * Returns whether a stored phone number ends with the supplied 4-digit suffix.
 *
 * Strips non-digits before comparing so users can enter "1234" while the
 * stored value is "+962 79 123 1234".
 *
 * @param {string | null | undefined} storedPhone - Phone value stored on the order.
 * @param {string} suffix - Validated 4-digit suffix.
 * @returns {boolean} True when the last 4 digits match.
 */
function phoneSuffixMatches(storedPhone, suffix) {
  const digits = String(storedPhone || "").replace(/\D/g, "");
  if (digits.length < 4) return false;
  return digits.slice(-4) === suffix;
}

/**
 * Loads a delivery order by its public order number and verifies the phone suffix.
 *
 * @param {{
 *   adminClient: { from: (table: string) => { select: (columns: string) => { eq: (column: string, value: string) => unknown } } },
 *   contactSuffix: string,
 *   orderNumber: string,
 * }} input - Lookup parameters.
 * @returns {Promise<{ created_at?: string, delivery_method?: string, id: string, status?: string, updated_at?: string } | null>}
 */
async function loadDeliveryOrder({ adminClient, contactSuffix, orderNumber }) {
  const displayNumber = getDisplayNumberValue(orderNumber);
  const query = adminClient
    .from("orders")
    .select("id, display_number, delivery_method, status, customer_phone, created_at, updated_at");
  const response = displayNumber
    ? await query.eq("display_number", displayNumber).eq("delivery_method", "delivery").maybeSingle()
    : await query.eq("id", orderNumber).eq("delivery_method", "delivery").maybeSingle();

  const row = response.data || null;
  if (!row) return null;
  if (!phoneSuffixMatches(row.customer_phone, contactSuffix)) {
    return null;
  }
  // Strip phone before returning to caller — public payload must not echo it.
  const { customer_phone, ...publicRow } = row;
  void customer_phone;
  return publicRow;
}

/**
 * Loads a repair booking by its public booking number and verifies the phone suffix.
 *
 * @param {{
 *   adminClient: { from: (table: string) => { select: (columns: string) => { eq: (column: string, value: string) => { maybeSingle: () => Promise<{ data: Record<string, unknown> | null }> } } } },
 *   contactSuffix: string,
 *   orderNumber: string,
 * }} input - Lookup parameters.
 * @returns {Promise<{ created_at?: string, id: string, mode?: string, service_name?: string, status?: string, updated_at?: string } | null>}
 */
async function loadRepairBooking({ adminClient, contactSuffix, orderNumber }) {
  const displayNumber = getDisplayNumberValue(orderNumber);
  const query = adminClient
    .from("repair_bookings")
    .select("id, display_number, service_name, mode, status, phone, created_at, updated_at");
  const response = displayNumber
    ? await query.eq("display_number", displayNumber).maybeSingle()
    : await query.eq("id", orderNumber).maybeSingle();

  const row = response.data || null;
  if (!row) return null;
  if (!phoneSuffixMatches(row.phone, contactSuffix)) {
    return null;
  }
  const { phone, ...publicRow } = row;
  void phone;
  return publicRow;
}

/**
 * Resolves a public lookup request to either a repair booking or a delivery order.
 *
 * The caller MUST supply the last 4 digits of the customer's phone number
 * (`contactSuffix`). Lookups that match the order number but fail the phone
 * suffix return `null` — same response as a non-existent order — so an
 * attacker cannot use timing or response differences to enumerate orders.
 *
 * @param {{
 *   adminClient: { from: (table: string) => { select: (columns: string) => { eq: (column: string, value: string) => unknown } } },
 *   contactSuffix?: string,
 *   lookupType?: string,
 *   orderNumber?: string,
 * }} input - Lookup request.
 * @returns {Promise<ReturnType<typeof buildDeliveryLookupResult> | ReturnType<typeof buildRepairLookupResult> | null>}
 * @throws {Error}
 */
export async function lookupPublicOrderByNumber({ adminClient, contactSuffix, lookupType, orderNumber }) {
  const normalizedOrderNumber = normalizeOrderNumber(orderNumber);
  const normalizedContactSuffix = normalizeLookupContactSuffix(contactSuffix);
  const normalizedType = inferLookupType({
    lookupType: normalizeLookupType(lookupType),
    orderNumber: normalizedOrderNumber,
  });

  const loaders = {
    repair: async () => {
      const booking = await loadRepairBooking({
        adminClient,
        contactSuffix: normalizedContactSuffix,
        orderNumber: normalizedOrderNumber,
      });
      return booking ? buildRepairLookupResult(booking) : null;
    },
    delivery: async () => {
      const deliveryOrder = await loadDeliveryOrder({
        adminClient,
        contactSuffix: normalizedContactSuffix,
        orderNumber: normalizedOrderNumber,
      });
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
