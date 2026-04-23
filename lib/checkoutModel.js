import { formatCurrency } from "./formatCurrency.js";

/**
 * Creates the checkout form state using the current dynamic options.
 *
 * @param {{ paymentMethods: Array<{ value: string }>, deliveryMethods: Array<{ value: string }> }} options
 * @returns {{
 *   customer_name: string,
 *   customer_phone: string,
 *   notes: string,
 *   payment_method: string,
 *   delivery_method: string,
 * }}
 */
export function createCheckoutFormState(options) {
  return {
    customer_name: '',
    customer_phone: '',
    customer_contact_link: '',
    notes: '',
    payment_method: options.paymentMethods[0]?.value || 'cod',
    delivery_method: options.deliveryMethods[0]?.value || 'delivery',
  };
}

/**
 * Aggregates repeated cart lines by product id before inventory validation.
 *
 * @param {Array<{ id: string, qty: number }>} items
 * @returns {Array<{ id: string, qty: number }>}
 */
export function aggregateCheckoutItems(items) {
  const quantitiesById = new Map();

  for (const item of items) {
    const productId = typeof item?.id === 'string' ? item.id.trim() : '';
    const quantity = Number(item?.qty);

    if (!productId || !Number.isInteger(quantity) || quantity <= 0) {
      continue;
    }

    quantitiesById.set(productId, (quantitiesById.get(productId) || 0) + quantity);
  }

  return Array.from(quantitiesById, ([id, qty]) => ({ id, qty }));
}

/**
 * Resolves the selected delivery fee from the available checkout options.
 *
 * @param {{
 *   deliveryMethod: string,
 *   deliveryMethods: Array<{ value: string, fee?: number }>,
 * }} params
 * @returns {number}
 */
export function resolveDeliveryMethodFee({ deliveryMethod, deliveryMethods }) {
  const matchedMethod = deliveryMethods.find((option) => option.value === deliveryMethod);
  const fee = Number(matchedMethod?.fee);
  return Number.isFinite(fee) && fee > 0 ? fee : 0;
}

/**
 * Calculates checkout totals using the selected delivery method.
 *
 * @param {{
 *   subtotal: number,
 *   deliveryMethod: string,
 *   deliveryMethods: Array<{ value: string, fee?: number }>,
 * }} params
 * @returns {{ shippingFee: number, total: number }}
 */
export function calculateCheckoutTotals({ subtotal, deliveryMethod, deliveryMethods }) {
  const normalizedSubtotal = Number.isFinite(Number(subtotal)) ? Number(subtotal) : 0;
  const shippingFee = resolveDeliveryMethodFee({ deliveryMethod, deliveryMethods });
  return {
    shippingFee,
    total: normalizedSubtotal + shippingFee,
  };
}

/**
 * Returns the initial status used for newly created physical orders.
 *
 * @returns {string}
 */
export function getInitialPhysicalOrderStatus() {
  return 'pending';
}

/**
 * Builds the wallet transfer instructions shown when the customer selects wallet payment.
 *
 * @param {{ paymentMethod: string, walletTransferNumber?: string, total: number }} params
 * @returns {{ amountText: string, walletNumber: string } | null}
 */
export function getWalletTransferInstructions({ paymentMethod, walletTransferNumber = '', total }) {
  const normalizedWalletNumber = walletTransferNumber.trim();

  if (paymentMethod !== 'wallet' || !normalizedWalletNumber) {
    return null;
  }

  return {
    amountText: formatCurrency(total),
    walletNumber: normalizedWalletNumber,
  };
}

/**
 * Aligns the selected option values with the latest dynamic settings.
 *
 * @param {{
 *   form: Record<string, string>,
 *   paymentMethods: Array<{ value: string }>,
 *   deliveryMethods: Array<{ value: string }>,
 * }} params
 * @returns {Record<string, string>}
 */
export function syncCheckoutSelections({ form, paymentMethods, deliveryMethods }) {
  return {
    ...form,
    payment_method: paymentMethods.some((option) => option.value === form.payment_method)
      ? form.payment_method
      : paymentMethods[0]?.value || form.payment_method,
    delivery_method: deliveryMethods.some((option) => option.value === form.delivery_method)
      ? form.delivery_method
      : deliveryMethods[0]?.value || form.delivery_method,
  };
}
