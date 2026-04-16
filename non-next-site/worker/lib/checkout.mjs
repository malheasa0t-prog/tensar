import { validateCartChange } from "../../../lib/cartAvailabilityModel.js";
import {
  aggregateCheckoutItems,
  calculateCheckoutTotals,
  getInitialPhysicalOrderStatus
} from "../../../lib/checkoutModel.js";
import { normalizeSiteSettings } from "../../../lib/contactChannels.js";
import { getPhysicalOrderKindFromProducts } from "../../../lib/physicalOrderRoutingModel.js";

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
 * Converts one value into a positive integer when possible.
 *
 * @param {unknown} value
 * @returns {number | null}
 */
function asPositiveInt(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Normalizes the submitted checkout payload.
 *
 * @param {Record<string, unknown>} body
 * @returns {{
 *   customerEmail: string,
 *   customerName: string,
 *   customerPhone: string,
 *   deliveryMethod: string,
 *   notes: string,
 *   paymentMethod: string,
 * }}
 */
export function normalizeCheckoutPayload(body) {
  return {
    customerEmail: normalizeText(body?.customer_email),
    customerName: normalizeText(body?.customer_name),
    customerPhone: normalizeText(body?.customer_phone),
    deliveryMethod: normalizeText(body?.delivery_method) || "delivery",
    notes: normalizeText(body?.notes),
    paymentMethod: normalizeText(body?.payment_method) || "cod"
  };
}

/**
 * Validates the checkout customer fields.
 *
 * @param {{ customerName: string, customerPhone: string }} input
 * @returns {string}
 */
export function validateCheckoutCustomer({ customerName, customerPhone }) {
  if (!customerName || customerName.length < 2 || customerName.length > 120) {
    return "الاسم غير صالح";
  }

  if (!/^[+0-9\s()-]{7,20}$/.test(customerPhone)) {
    return "رقم الهاتف غير صالح";
  }

  return "";
}

/**
 * Normalizes and aggregates the checkout items.
 *
 * @param {Array<unknown>} items
 * @returns {Array<{ id: string, qty: number }>}
 */
export function normalizeCheckoutItems(items) {
  const normalizedItems = (Array.isArray(items) ? items : [])
    .map((item) => ({
      id: normalizeText(item?.id),
      qty: asPositiveInt(item?.qty)
    }))
    .filter((item) => item.id && item.qty);

  return aggregateCheckoutItems(normalizedItems);
}

/**
 * Loads delivery methods from site settings with a safe fallback.
 *
 * @param {import("@supabase/supabase-js").SupabaseClient} adminClient
 * @returns {Promise<Array<{ fee?: number, value: string }>>}
 */
export async function loadCheckoutDeliveryMethods(adminClient) {
  const { data, error } = await adminClient.from("settings").select("data").limit(1).maybeSingle();
  return error ? normalizeSiteSettings().deliveryMethods : normalizeSiteSettings(data?.data).deliveryMethods;
}

/**
 * Loads the matching categories for checkout products.
 *
 * @param {Array<unknown>} categoryIds
 * @param {import("@supabase/supabase-js").SupabaseClient} adminClient
 * @returns {Promise<{ categories: Array<{ id: string, slug?: string }>, error: string }>}
 */
export async function loadCheckoutCategories(categoryIds, adminClient) {
  const normalizedCategoryIds = [
    ...new Set((Array.isArray(categoryIds) ? categoryIds : []).map(normalizeText).filter(Boolean))
  ];

  if (normalizedCategoryIds.length === 0) {
    return { categories: [], error: "" };
  }

  const { data, error } = await adminClient
    .from("categories")
    .select("id,slug")
    .in("id", normalizedCategoryIds);

  return {
    categories: Array.isArray(data) ? data : [],
    error: error ? "تعذر تحميل أقسام المنتجات" : ""
  };
}

/**
 * Builds validated order items and subtotal from the catalog snapshot.
 *
 * @param {{
 *   aggregatedItems: Array<{ id: string, qty: number }>,
 *   categories: Array<{ id: string, slug?: string }>,
 *   products: Array<Record<string, unknown>>,
 * }}
 * @returns {{
 *   catalogKind?: string,
 *   error?: string,
 *   orderItems?: Array<Record<string, unknown>>,
 *   subtotal?: number,
 * }}
 */
export function buildValidatedOrderLines({ aggregatedItems, categories, products }) {
  const productMap = new Map((Array.isArray(products) ? products : []).map((product) => [product.id, product]));
  const categoryMap = new Map((Array.isArray(categories) ? categories : []).map((category) => [category.id, category]));
  const orderItems = [];
  let subtotal = 0;

  for (const item of aggregatedItems) {
    const product = productMap.get(item.id);

    if (!product) {
      return { error: `المنتج غير متاح: ${item.id}` };
    }

    const availability = validateCartChange({ product, nextQty: item.qty });
    if (!availability.ok) {
      return { error: `${availability.message} (${product.name})` };
    }

    const unitPrice = Number(product.discount_price || product.price || 0);
    subtotal += unitPrice * item.qty;
    orderItems.push({
      price: unitPrice,
      product_id: product.id,
      product_name: product.name,
      qty: item.qty,
      snapshot: {
        brand: product.brand || null,
        category_id: product.category_id || null,
        category_slug: categoryMap.get(product.category_id || "")?.slug || null,
        image: Array.isArray(product.images) ? product.images[0] || null : null,
        product_type: product.product_type || "physical"
      }
    });
  }

  return {
    catalogKind: getPhysicalOrderKindFromProducts(products || [], { categories }),
    orderItems,
    subtotal
  };
}

/**
 * Computes the final checkout totals.
 *
 * @param {{
 *   deliveryMethod: string,
 *   deliveryMethods: Array<{ fee?: number, value: string }>,
 *   subtotal: number,
 * }}
 * @returns {{ shippingFee: number, total: number }}
 */
export function resolveCheckoutTotals({ deliveryMethod, deliveryMethods, subtotal }) {
  return calculateCheckoutTotals({ deliveryMethod, deliveryMethods, subtotal });
}

/**
 * Returns the first order status used for physical orders.
 *
 * @returns {string}
 */
export function resolveInitialCheckoutStatus() {
  return getInitialPhysicalOrderStatus();
}

/**
 * Creates one deterministic-enough order identifier.
 *
 * @param {() => number} [now]
 * @param {() => number} [randomValue]
 * @returns {string}
 */
export function createCheckoutOrderId(now = Date.now, randomValue = Math.random) {
  return `ord-${now()}-${randomValue().toString(36).slice(2, 7)}`;
}
