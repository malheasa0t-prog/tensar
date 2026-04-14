import { cleanNumber, cleanValue } from "./helpers.js";

const FREE_DELIVERY_METHODS = new Set(["pickup", "store_pickup", "remote"]);
const STANDARD_DELIVERY_METHODS = new Set(["delivery", "home_delivery", "shipping"]);
const EXPRESS_DELIVERY_METHODS = new Set(["express", "express_delivery"]);

/**
 * Normalizes a delivery fee into a safe non-negative number.
 *
 * @param {unknown} value
 * @returns {number}
 */
function normalizeDeliveryFee(value) {
  return Math.max(0, cleanNumber(value, 0));
}

/**
 * Resolves fallback delivery fees from legacy shipping settings.
 *
 * @param {string} deliveryMethod
 * @param {{ standardFee?: unknown, expressFee?: unknown }} shippingSettings
 * @returns {number}
 */
function resolveLegacyDeliveryFee(deliveryMethod, shippingSettings) {
  const normalizedMethod = cleanValue(deliveryMethod).toLowerCase();

  if (FREE_DELIVERY_METHODS.has(normalizedMethod)) {
    return 0;
  }

  if (EXPRESS_DELIVERY_METHODS.has(normalizedMethod)) {
    return normalizeDeliveryFee(shippingSettings.expressFee);
  }

  if (STANDARD_DELIVERY_METHODS.has(normalizedMethod)) {
    return normalizeDeliveryFee(shippingSettings.standardFee);
  }

  return 0;
}

/**
 * Normalizes delivery method options while preserving per-method fees.
 *
 * @param {unknown} value
 * @param {Array<{ value: string, label: string, fee?: number }>} fallback
 * @param {{ standardFee?: unknown, expressFee?: unknown }} [shippingSettings]
 * @returns {Array<{ value: string, label: string, fee: number }>}
 */
export function normalizeDeliveryMethodList(value, fallback, shippingSettings = {}) {
  const sourceItems = Array.isArray(value) ? value : fallback;
  const items = sourceItems
    .map((item) => {
      const itemValue = cleanValue(item?.value || item?.id || item?.key || item?.name || item);
      const label = cleanValue(item?.label || item?.name || item?.title || item);

      if (!itemValue || !label) {
        return null;
      }

      const fallbackFee = resolveLegacyDeliveryFee(itemValue, shippingSettings);

      return {
        value: itemValue,
        label,
        fee: normalizeDeliveryFee(item?.fee ?? item?.shippingFee ?? item?.price ?? fallbackFee),
      };
    })
    .filter(Boolean);

  return items.length > 0
    ? items
    : fallback.map((item) => ({
        value: item.value,
        label: item.label,
        fee: normalizeDeliveryFee(item.fee ?? resolveLegacyDeliveryFee(item.value, shippingSettings)),
      }));
}
