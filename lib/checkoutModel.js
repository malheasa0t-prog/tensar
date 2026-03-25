/**
 * Creates the checkout form state using the current dynamic options.
 *
 * @param {{ paymentMethods: Array<{ value: string }>, deliveryMethods: Array<{ value: string }> }} options
 * @returns {{
 *   customer_name: string,
 *   customer_phone: string,
 *   customer_email: string,
 *   notes: string,
 *   payment_method: string,
 *   delivery_method: string,
 * }}
 */
export function createCheckoutFormState(options) {
  return {
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    notes: '',
    payment_method: options.paymentMethods[0]?.value || 'cod',
    delivery_method: options.deliveryMethods[0]?.value || 'delivery',
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
