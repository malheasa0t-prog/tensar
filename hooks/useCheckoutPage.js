'use client';

import { useEffect, useState } from 'react';
import { useCart } from '@/components/CartProvider';
import { createCheckoutFormState, syncCheckoutSelections } from '@/lib/checkoutModel';
import {
  fetchCheckoutOptions,
  getDefaultCheckoutOptions,
  submitCheckoutOrder,
} from '@/services/checkoutService';

/**
 * Handles dynamic checkout options, form state, and order submission.
 *
 * @returns {{
 *   items: Array<Record<string, unknown>>,
 *   cartTotal: number,
 *   checkoutOptions: { paymentMethods: Array<Record<string, unknown>>, deliveryMethods: Array<Record<string, unknown>> },
 *   form: Record<string, string>,
 *   loading: boolean,
 *   error: string,
 *   success: Record<string, unknown> | null,
 *   canSubmit: boolean,
 *   updateField: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void,
 *   submitCheckout: (event: React.FormEvent<HTMLFormElement>) => Promise<void>,
 * }}
 */
export function useCheckoutPage() {
  const { items, cartTotal, clearCart } = useCart();
  const defaultOptions = getDefaultCheckoutOptions();
  const [checkoutOptions, setCheckoutOptions] = useState(defaultOptions);
  const [form, setForm] = useState(createCheckoutFormState(defaultOptions));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    let mounted = true;

    /**
     * Hydrates payment and delivery options from the current site settings.
     *
     * @returns {Promise<void>}
     */
    async function hydrateCheckoutSettings() {
      const nextOptions = await fetchCheckoutOptions();

      if (!mounted) {
        return;
      }

      setCheckoutOptions(nextOptions);
      setForm((prev) =>
        syncCheckoutSelections({
          form: prev,
          paymentMethods: nextOptions.paymentMethods,
          deliveryMethods: nextOptions.deliveryMethods,
        })
      );
    }

    hydrateCheckoutSettings();

    return () => {
      mounted = false;
    };
  }, []);

  /**
   * Updates one checkout form field.
   *
   * @param {React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>} event
   * @returns {void}
   */
  function updateField(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  /**
   * Submits the checkout order and clears the cart on success.
   *
   * @param {React.FormEvent<HTMLFormElement>} event
   * @returns {Promise<void>}
   */
  async function submitCheckout(event) {
    event.preventDefault();

    if (!items.length || !form.customer_name.trim() || !form.customer_phone.trim()) {
      return;
    }

    setLoading(true);
    setError('');
    setSuccess(null);

    try {
      const response = await submitCheckoutOrder({ items, form });
      clearCart();
      setSuccess(response.order_id ? response : { ...response, order_id: 'N/A', total: cartTotal });
    } catch (err) {
      setError(err.message || 'حدث خطأ غير متوقع أثناء إتمام الطلب');
    } finally {
      setLoading(false);
    }
  }

  const canSubmit =
    items.length > 0 && !!form.customer_name.trim() && !!form.customer_phone.trim();

  return {
    items,
    cartTotal,
    checkoutOptions,
    form,
    loading,
    error,
    success,
    canSubmit,
    updateField,
    submitCheckout,
  };
}
