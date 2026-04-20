/**
 * Shared stock-alert helpers for storefront and server handlers.
 */

import { getProductsExplorerAvailability } from "./productsExplorerModel.js";

export const RESTOCK_SUBSCRIPTION_REFERENCE_TYPE = "restock_subscription";
export const RESTOCK_NOTIFICATION_REFERENCE_TYPE = "product";

/**
 * Normalizes a product id for stock-alert operations.
 *
 * @param {unknown} productId
 * @returns {string}
 */
export function normalizeStockAlertProductId(productId) {
  return typeof productId === "string" ? productId.trim() : "";
}

/**
 * Returns whether the product is currently eligible for a back-in-stock alert.
 *
 * @param {Record<string, unknown> | null | undefined} product
 * @returns {boolean}
 */
export function isStockAlertEligibleProduct(product) {
  return getProductsExplorerAvailability(product) === "out_of_stock";
}

/**
 * Checks whether a product transitioned from unavailable to available.
 *
 * @param {{
 *   previousProduct?: Record<string, unknown> | null,
 *   nextProduct?: Record<string, unknown> | null,
 * }} input
 * @returns {boolean}
 */
export function hasProductBeenRestocked({ previousProduct, nextProduct }) {
  return isStockAlertEligibleProduct(previousProduct) && !isStockAlertEligibleProduct(nextProduct);
}

/**
 * Builds the internal subscription row stored in the notifications table.
 *
 * @param {{ productId: string, productName: string, userId: string }} input
 * @returns {Record<string, unknown>}
 */
export function buildRestockSubscriptionPayload({ productId, productName, userId }) {
  return {
    user_id: userId,
    title: "اشتراك تنبيه التوفر",
    body: `سنخبرك عند توفر ${productName || "هذا المنتج"} مرة أخرى.`,
    type: "info",
    is_read: true,
    reference_type: RESTOCK_SUBSCRIPTION_REFERENCE_TYPE,
    reference_id: productId,
    metadata: {
      source: "stock_alert_subscription",
      product_name: productName || "",
    },
  };
}

/**
 * Builds the visible notification shown after a product becomes available again.
 *
 * @param {{ productId: string, productName: string, userId: string }} input
 * @returns {Record<string, unknown>}
 */
export function buildRestockReadyNotificationPayload({ productId, productName, userId }) {
  return {
    user_id: userId,
    title: "عاد المنتج إلى المخزون",
    body: `${productName || "المنتج"} متوفر الآن من جديد ويمكنك إكمال الطلب.`,
    type: "success",
    reference_type: RESTOCK_NOTIFICATION_REFERENCE_TYPE,
    reference_id: productId,
  };
}
