const DEFAULT_CURRENCY = "JOD";
const DEFAULT_HOTJAR_VERSION = "6";
const DEFAULT_PRODUCT_CATEGORY = "المنتجات";
const ANALYTICS_FALLBACK_PRODUCT_ID = "unknown-product";
const ANALYTICS_FALLBACK_PRODUCT_NAME = "منتج";

/**
 * Converts mixed price-like values into a safe finite number.
 *
 * @param {unknown} value
 * @returns {number}
 */
function toAnalyticsNumber(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const normalized = value.replace(/,/g, "").trim();
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

/**
 * Normalizes public analytics identifiers from environment values.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeAnalyticsIdentifier(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Resolves the Hotjar script version with a safe fallback.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeHotjarVersion(value) {
  const normalized = normalizeAnalyticsIdentifier(value);
  return normalized || DEFAULT_HOTJAR_VERSION;
}

/**
 * Builds the public analytics configuration consumed by client providers.
 *
 * @param {Record<string, unknown>} env
 * @returns {{
 *   facebookPixelId: string,
 *   gaMeasurementId: string,
 *   hasAnyProvider: boolean,
 *   hotjarId: string,
 *   hotjarVersion: string,
 * }}
 */
export function getPublicAnalyticsConfig(env = {}) {
  const gaMeasurementId = normalizeAnalyticsIdentifier(env.NEXT_PUBLIC_GA_MEASUREMENT_ID);
  const facebookPixelId = normalizeAnalyticsIdentifier(env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID);
  const hotjarId = normalizeAnalyticsIdentifier(env.NEXT_PUBLIC_HOTJAR_ID);
  const hotjarVersion = normalizeHotjarVersion(env.NEXT_PUBLIC_HOTJAR_VERSION);

  return {
    gaMeasurementId,
    facebookPixelId,
    hotjarId,
    hotjarVersion,
    hasAnyProvider: Boolean(gaMeasurementId || facebookPixelId || hotjarId),
  };
}

/**
 * Converts pathname/search data into one canonical path string.
 *
 * @param {{ pathname?: string, search?: string }} input
 * @returns {string}
 */
export function buildAnalyticsPath(input) {
  const pathname = typeof input?.pathname === "string" && input.pathname.trim() ? input.pathname : "/";
  const search = typeof input?.search === "string" ? input.search.trim() : "";

  if (!search) {
    return pathname;
  }

  return `${pathname}${search.startsWith("?") ? search : `?${search}`}`;
}

/**
 * Normalizes one product or cart item into a GA4-compatible analytics item.
 *
 * @param {Record<string, unknown>} item
 * @returns {{
 *   discount: number,
 *   item_category: string,
 *   item_id: string,
 *   item_name: string,
 *   price: number,
 *   quantity: number,
 * }}
 */
export function buildAnalyticsItem(item = {}) {
  const originalPrice = toAnalyticsNumber(item.originalPrice ?? item.price);
  const price = toAnalyticsNumber(item.discount_price ?? item.price);
  const quantity = Math.max(1, Math.floor(toAnalyticsNumber(item.qty ?? item.quantity ?? 1)));

  return {
    item_id: normalizeAnalyticsIdentifier(item.id) || ANALYTICS_FALLBACK_PRODUCT_ID,
    item_name: normalizeAnalyticsIdentifier(item.name) || ANALYTICS_FALLBACK_PRODUCT_NAME,
    item_category: normalizeAnalyticsIdentifier(item.category) || DEFAULT_PRODUCT_CATEGORY,
    price,
    quantity,
    discount: Number(Math.max(0, originalPrice - price).toFixed(2)),
  };
}

/**
 * Builds the payload for add-to-cart tracking across analytics providers.
 *
 * @param {{ currency?: string, product?: Record<string, unknown> }} input
 * @returns {{ currency: string, items: Array<ReturnType<typeof buildAnalyticsItem>>, value: number }}
 */
export function buildAddToCartPayload(input = {}) {
  const item = buildAnalyticsItem(input.product || {});
  const currency = normalizeAnalyticsIdentifier(input.currency) || DEFAULT_CURRENCY;

  return {
    currency,
    items: [item],
    value: Number((item.price * item.quantity).toFixed(2)),
  };
}

/**
 * Builds the payload for successful purchase tracking.
 *
 * @param {{
 *   currency?: string,
 *   deliveryMethod?: string,
 *   items?: Array<Record<string, unknown>>,
 *   orderId?: string | number,
 *   paymentMethod?: string,
 *   shippingFee?: number | string,
 *   total?: number | string,
 * }} input
 * @returns {{
 *   currency: string,
 *   items: Array<ReturnType<typeof buildAnalyticsItem>>,
 *   payment_type?: string,
 *   shipping: number,
 *   transaction_id: string,
 *   value: number,
 *   delivery_type?: string,
 * }}
 */
export function buildPurchasePayload(input = {}) {
  const items = Array.isArray(input.items) ? input.items.map((item) => buildAnalyticsItem(item)) : [];
  const derivedValue = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const transactionId = normalizeAnalyticsIdentifier(input.orderId) || `pending-order-${items.length || 1}`;
  const value = toAnalyticsNumber(input.total) || Number(derivedValue.toFixed(2));
  const shipping = Number(toAnalyticsNumber(input.shippingFee).toFixed(2));
  const currency = normalizeAnalyticsIdentifier(input.currency) || DEFAULT_CURRENCY;
  const paymentType = normalizeAnalyticsIdentifier(input.paymentMethod);
  const deliveryType = normalizeAnalyticsIdentifier(input.deliveryMethod);

  return {
    transaction_id: transactionId,
    currency,
    value,
    shipping,
    items,
    ...(paymentType ? { payment_type: paymentType } : {}),
    ...(deliveryType ? { delivery_type: deliveryType } : {}),
  };
}

/**
 * Dispatches a page view event to every enabled analytics provider.
 *
 * @param {{
 *   config?: ReturnType<typeof getPublicAnalyticsConfig>,
 *   locationHref?: string,
 *   pathname?: string,
 *   search?: string,
 * }} input
 * @returns {boolean}
 */
export function trackPageView(input = {}) {
  const config = input.config || getPublicAnalyticsConfig();
  const browserWindow = typeof window === "undefined" ? null : window;
  const pagePath = buildAnalyticsPath({ pathname: input.pathname, search: input.search });

  if (!browserWindow || !config.hasAnyProvider) {
    return false;
  }

  if (config.gaMeasurementId && typeof browserWindow.gtag === "function") {
    browserWindow.gtag("event", "page_view", {
      page_location: input.locationHref || browserWindow.location?.href || pagePath,
      page_path: pagePath,
      page_title: browserWindow.document?.title || "",
    });
  }

  if (config.facebookPixelId && typeof browserWindow.fbq === "function") {
    browserWindow.fbq("track", "PageView");
  }

  if (config.hotjarId && typeof browserWindow.hj === "function") {
    browserWindow.hj("stateChange", pagePath);
  }

  return true;
}

/**
 * Dispatches a successful add-to-cart event to the enabled providers.
 *
 * @param {{ config?: ReturnType<typeof getPublicAnalyticsConfig>, currency?: string, product?: Record<string, unknown> }} input
 * @returns {boolean}
 */
export function trackAddToCart(input = {}) {
  const config = input.config || getPublicAnalyticsConfig();
  const browserWindow = typeof window === "undefined" ? null : window;
  const payload = buildAddToCartPayload({ currency: input.currency, product: input.product });
  const [item] = payload.items;

  if (!browserWindow || !config.hasAnyProvider) {
    return false;
  }

  if (config.gaMeasurementId && typeof browserWindow.gtag === "function") {
    browserWindow.gtag("event", "add_to_cart", payload);
  }

  if (config.facebookPixelId && typeof browserWindow.fbq === "function") {
    browserWindow.fbq("track", "AddToCart", {
      content_ids: [item.item_id],
      content_name: item.item_name,
      content_type: "product",
      currency: payload.currency,
      value: payload.value,
    });
  }

  if (config.hotjarId && typeof browserWindow.hj === "function") {
    browserWindow.hj("event", "add_to_cart");
  }

  return true;
}

/**
 * Dispatches a successful purchase event to the enabled providers.
 *
 * @param {{
 *   config?: ReturnType<typeof getPublicAnalyticsConfig>,
 *   currency?: string,
 *   deliveryMethod?: string,
 *   items?: Array<Record<string, unknown>>,
 *   orderId?: string | number,
 *   paymentMethod?: string,
 *   shippingFee?: number | string,
 *   total?: number | string,
 * }} input
 * @returns {boolean}
 */
export function trackPurchase(input = {}) {
  const config = input.config || getPublicAnalyticsConfig();
  const browserWindow = typeof window === "undefined" ? null : window;
  const payload = buildPurchasePayload(input);

  if (!browserWindow || !config.hasAnyProvider || payload.items.length === 0) {
    return false;
  }

  if (config.gaMeasurementId && typeof browserWindow.gtag === "function") {
    browserWindow.gtag("event", "purchase", payload);
  }

  if (config.facebookPixelId && typeof browserWindow.fbq === "function") {
    browserWindow.fbq("track", "Purchase", {
      content_ids: payload.items.map((item) => item.item_id),
      content_type: "product",
      currency: payload.currency,
      num_items: payload.items.reduce((sum, item) => sum + item.quantity, 0),
      value: payload.value,
    });
  }

  if (config.hotjarId && typeof browserWindow.hj === "function") {
    browserWindow.hj("event", "purchase");
  }

  return true;
}
