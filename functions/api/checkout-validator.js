/**
 * Checkout request validation and catalog loading helpers.
 */

const BANNED_ACCOUNT_MESSAGE = "حسابك محظور. تواصل مع الإدارة.";
const DIGITAL_CONTACT_ERROR_MESSAGE =
  "[CHK-112] رقم الواتساب أو وسيلة التواصل مطلوبة للخدمات الرقمية";

const ALLOWED_DELIVERY_METHODS = Object.freeze(["delivery", "pickup", "digital"]);
const ALLOWED_PAYMENT_METHODS = Object.freeze(["cod", "wallet", "card"]);
const DEFAULT_DELIVERY_METHOD = "delivery";
const DEFAULT_PAYMENT_METHOD = "cod";

/**
 * Returns a trimmed string or an empty string for invalid values.
 *
 * @param {unknown} value
 * @returns {string}
 */
function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Converts a value into a positive integer when possible.
 *
 * @param {unknown} value
 * @returns {number | null}
 */
function asPositiveInt(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Validates the basic checkout customer fields.
 *
 * @param {{ customerName: string, customerPhone: string }} input
 * @returns {void}
 * @throws {Error}
 */
function validateCustomer({ customerName, customerPhone }) {
  if (!customerName || customerName.length < 2 || customerName.length > 120) {
    throw new Error("[CHK-101] الاسم غير صالح");
  }

  if (!/^[+0-9\s()-]{7,20}$/.test(customerPhone)) {
    throw new Error("[CHK-102] رقم الهاتف غير صالح");
  }
}

/**
 * Normalizes and deduplicates checkout items.
 *
 * @param {Array<unknown>} rawItems
 * @returns {Array<{ id: string, qty: number }>}
 */
function normalizeItems(rawItems) {
  const normalizedItems = (Array.isArray(rawItems) ? rawItems : [])
    .map((item) => ({ id: normalizeText(item?.id), qty: asPositiveInt(item?.qty) }))
    .filter((item) => item.id && item.qty);
  const itemsById = new Map();

  for (const item of normalizedItems) {
    itemsById.set(item.id, (itemsById.get(item.id) || 0) + item.qty);
  }

  return Array.from(itemsById, ([id, qty]) => ({ id, qty }));
}

/**
 * Builds the normalized service snapshot used during item validation.
 *
 * @param {Record<string, unknown>} service
 * @returns {Record<string, unknown>}
 */
function buildServiceProduct(service) {
  const serviceMetadata = service.metadata || {};
  return {
    id: service.id,
    name: service.name,
    price: Number(service.price),
    discount_price: null,
    quantity: service.max_qty || 9999,
    sold: 0,
    status: service.status,
    category_id: service.category_id,
    product_type: "digital",
    brand: null,
    images: service.image ? [service.image] : [],
    provider_service_id: service.provider_service_id,
    link_required: Boolean(serviceMetadata.link_required),
    provider_fields: Array.isArray(serviceMetadata.provider_fields)
      ? serviceMetadata.provider_fields
      : [],
  };
}

/**
 * Builds a normalized order item snapshot row.
 *
 * @param {Record<string, unknown>} product
 * @param {number} qty
 * @returns {{ price: number, row: Record<string, unknown> }}
 */
function buildOrderItem(product, qty) {
  const unitPrice = Number(product.discount_price || product.price || 0);
  return {
    price: unitPrice,
    row: {
      product_id: product.id,
      product_name: product.name,
      qty,
      price: unitPrice,
      snapshot: {
        category_id: product.category_id || null,
        product_type: product.product_type || "physical",
        brand: product.brand || null,
        image: Array.isArray(product.images) ? product.images[0] || null : null,
        provider_service_id: product.provider_service_id || null,
      },
    },
  };
}

/**
 * Detects whether a provider-backed service requires a dedicated contact handle.
 *
 * @param {Record<string, unknown>} service
 * @returns {boolean}
 */
function serviceRequiresDigitalContact(service) {
  if (service?.link_required) {
    return true;
  }

  return (Array.isArray(service?.provider_fields) ? service.provider_fields : []).some((field) => {
    const metadataText = [
      field?.key,
      field?.label,
      field?.name,
      field?.type,
      field?.placeholder,
    ]
      .map((value) => normalizeText(value).toLowerCase())
      .join(" ");

    return /whatsapp|phone|mobile|contact|link|profile|username|user/.test(metadataText);
  });
}

/**
 * Resolves a value against an allowlist, falling back to the default.
 *
 * @param {string} value - Raw normalized value.
 * @param {readonly string[]} allowed - Whitelisted values.
 * @param {string} fallback - Default to use when value is empty or unknown.
 * @returns {string} A value guaranteed to be in `allowed`.
 */
function resolveEnumValue(value, allowed, fallback) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return fallback;
  return allowed.includes(normalized) ? normalized : fallback;
}

/**
 * Parses and validates the raw checkout request body.
 *
 * - Rejects non-array `items` explicitly so the caller sees [CHK-108] rather
 *   than the generic "items invalid" message.
 * - Constrains `delivery_method` and `payment_method` to known enums.
 *
 * @param {Record<string, unknown>} body - Parsed JSON request body.
 * @returns {{
 *   customerName: string,
 *   customerPhone: string,
 *   customerEmail: string,
 *   customerContactLink: string,
 *   deliveryMethod: string,
 *   items: Array<{ id: string, qty: number }>,
 *   notes: string,
 *   paymentMethod: string,
 * }} Normalized request state.
 * @throws {Error}
 */
export function parseCheckoutRequest(body) {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("[CHK-108] هيكل الطلب غير صالح");
  }

  if (body.items !== undefined && !Array.isArray(body.items)) {
    throw new Error("[CHK-108] حقل المنتجات يجب أن يكون قائمة");
  }

  const requestState = {
    customerName: normalizeText(body?.customer_name),
    customerPhone: normalizeText(body?.customer_phone),
    customerEmail: normalizeText(body?.customer_email),
    customerContactLink: normalizeText(body?.customer_contact_link),
    deliveryMethod: resolveEnumValue(
      body?.delivery_method,
      ALLOWED_DELIVERY_METHODS,
      DEFAULT_DELIVERY_METHOD
    ),
    items: normalizeItems(body?.items),
    notes: normalizeText(body?.notes),
    paymentMethod: resolveEnumValue(
      body?.payment_method,
      ALLOWED_PAYMENT_METHODS,
      DEFAULT_PAYMENT_METHOD
    ),
  };

  validateCustomer(requestState);
  if (requestState.items.length === 0) {
    throw new Error("[CHK-103] بيانات السلة غير صالحة");
  }

  return requestState;
}

/**
 * Resolves the authenticated checkout user when a bearer token exists.
 *
 * @param {{
 *   admin: import("@supabase/supabase-js").SupabaseClient,
 *   requestClient: import("@supabase/supabase-js").SupabaseClient | null,
 * }} input
 * @returns {Promise<string | null>}
 * @throws {Error}
 */
export async function resolveCheckoutUserId({ admin, requestClient }) {
  if (!requestClient) {
    return null;
  }

  const {
    data: { user },
  } = await requestClient.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile } = await admin
    .from("user_profiles")
    .select("status")
    .eq("user_id", user.id)
    .single();

  if (profile?.status === "banned") {
    throw new Error(`[CHK-104] ${BANNED_ACCOUNT_MESSAGE}`);
  }

  return user.id;
}

/**
 * Loads the active products and services needed for checkout.
 *
 * @param {{
 *   admin: import("@supabase/supabase-js").SupabaseClient,
 *   items: Array<{ id: string, qty: number }>,
 * }} input
 * @returns {Promise<{
 *   physicalProducts: Array<Record<string, unknown>>,
 *   productMap: Map<string, Record<string, unknown>>,
 *   serviceProducts: Array<Record<string, unknown>>,
 * }>}
 * @throws {Error}
 */
export async function loadCheckoutCatalog({ admin, items }) {
  const serviceIds = items.filter((item) => item.id.startsWith("srv-")).map((item) => item.id);
  const physicalIds = items.filter((item) => !item.id.startsWith("srv-")).map((item) => item.id);
  const [productsResult, servicesResult] = await Promise.all([
    physicalIds.length > 0
      ? admin
          .from("products")
          .select("id,name,price,discount_price,quantity,sold,status,category_id,product_type,brand,images")
          .in("id", physicalIds)
          .eq("status", "active")
          .or("product_type.is.null,product_type.eq.physical")
      : { data: [], error: null },
    serviceIds.length > 0
      ? admin
          .from("services")
          .select("id,name,price,min_qty,max_qty,image,category_id,status,provider_service_id,metadata")
          .in("id", serviceIds)
          .eq("status", "active")
      : { data: [], error: null },
  ]);

  if (productsResult.error || servicesResult.error) {
    throw new Error("[CHK-105] تعذر تحميل بيانات المنتجات أو الخدمات");
  }

  const productMap = new Map((productsResult.data || []).map((product) => [product.id, product]));
  const serviceProducts = (servicesResult.data || []).map((service) => buildServiceProduct(service));

  for (const service of serviceProducts) {
    productMap.set(service.id, service);
  }

  return {
    physicalProducts: productsResult.data || [],
    productMap,
    serviceProducts,
  };
}

/**
 * Validates the digital contact requirement for provider-backed services.
 *
 * @param {{ customerContactLink: string, serviceProducts: Array<Record<string, unknown>> }} input
 * @returns {void}
 * @throws {Error}
 */
export function validateCheckoutDigitalContact({ customerContactLink, serviceProducts }) {
  const requiresDigitalContact = (Array.isArray(serviceProducts) ? serviceProducts : []).some(
    (service) => serviceRequiresDigitalContact(service)
  );

  if (requiresDigitalContact && !customerContactLink) {
    throw new Error(DIGITAL_CONTACT_ERROR_MESSAGE);
  }
}

/**
 * Builds validated checkout order items and subtotal.
 *
 * @param {{
 *   items: Array<{ id: string, qty: number }>,
 *   productMap: Map<string, Record<string, unknown>>,
 * }} input
 * @returns {{ orderItems: Array<Record<string, unknown>>, subtotal: number }}
 * @throws {Error}
 */
export function buildCheckoutOrderItems({ items, productMap }) {
  let subtotal = 0;
  const orderItems = [];

  for (const item of items) {
    const product = productMap.get(item.id);
    if (!product) {
      throw new Error(`[CHK-106] المنتج غير متاح: ${item.id}`);
    }

    if (product.quantity < item.qty) {
      throw new Error(
        `[CHK-107] الكمية المطلوبة (${item.qty}) تتجاوز المتوفر (${product.quantity}) — ${product.name}`
      );
    }

    const normalizedItem = buildOrderItem(product, item.qty);
    subtotal += normalizedItem.price * item.qty;
    orderItems.push(normalizedItem.row);
  }

  return { orderItems, subtotal };
}
