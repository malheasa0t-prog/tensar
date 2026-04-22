'use client';

import { useEffect, useState } from 'react';
import { useCart } from '@/components/CartProvider';
import { useToast } from '@/components/ToastProvider';
import { trackPurchase } from '@/lib/analyticsModel';
import {
  calculateCheckoutTotals,
  createCheckoutFormState,
  getWalletTransferInstructions,
  syncCheckoutSelections,
} from '@/lib/checkoutModel';
import { PUBLIC_ANALYTICS_CONFIG } from '@/lib/publicAnalyticsConfig';
import {
  fetchCheckoutOptions,
  getDefaultCheckoutOptions,
  submitCheckoutOrder,
} from '@/services/checkoutService';

const DEFAULT_CHECKOUT_ERROR_MESSAGE = '[CKP-500] حدث خطأ غير متوقع أثناء إتمام الطلب';
const INCOMPLETE_CHECKOUT_MESSAGE = '[CKP-101] أكمل الاسم ورقم الهاتف قبل تأكيد الطلب.';

/**
 * Handles dynamic checkout options, form state, and order submission.
 *
 * @returns {{
 *   canSubmit: boolean,
 *   cartTotal: number,
 *   checkoutOptions: { paymentMethods: Array<Record<string, unknown>>, deliveryMethods: Array<Record<string, unknown>>, walletTransferNumber: string },
 *   checkoutTotal: number,
 *   closeWalletTransferModal: () => void,
 *   error: string,
 *   form: Record<string, string>,
 *   isWalletTransferModalOpen: boolean,
 *   isWalletTransferUnavailable: boolean,
 *   items: Array<Record<string, unknown>>,
 *   loading: boolean,
 *   shippingFee: number,
 *   submitCheckout: (event: React.FormEvent<HTMLFormElement>) => Promise<void>,
 *   success: Record<string, unknown> | null,
 *   updateField: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void,
 *   walletTransferInstructions: { amountText: string, walletNumber: string } | null,
 * }}
 */
export function useCheckoutPage() {
  const { items, cartTotal, clearCart } = useCart();
  const { showToast } = useToast();
  const defaultOptions = getDefaultCheckoutOptions();
  const [checkoutOptions, setCheckoutOptions] = useState(defaultOptions);
  const [form, setForm] = useState(createCheckoutFormState(defaultOptions));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);
  const [isWalletTransferModalOpen, setIsWalletTransferModalOpen] = useState(false);

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

  useEffect(() => {
    const shouldOpenWalletModal =
      form.payment_method === 'wallet' && Boolean(checkoutOptions.walletTransferNumber?.trim());
    setIsWalletTransferModalOpen(shouldOpenWalletModal);
  }, [checkoutOptions.walletTransferNumber, form.payment_method]);

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
   * Closes the wallet transfer modal without changing the selected payment method.
   *
   * @returns {void}
   */
  function closeWalletTransferModal() {
    setIsWalletTransferModalOpen(false);
  }

  /**
   * Submits the checkout order, emits analytics, and clears the cart on success.
   *
   * @param {React.FormEvent<HTMLFormElement>} event
   * @returns {Promise<void>}
   */
  async function submitCheckout(event) {
    event.preventDefault();

    if (!items.length || !form.customer_name.trim() || !form.customer_phone.trim()) {
      setError(INCOMPLETE_CHECKOUT_MESSAGE);
      showToast(INCOMPLETE_CHECKOUT_MESSAGE, { type: 'warning', title: 'بيانات ناقصة' });
      return;
    }

    setLoading(true);
    setError('');
    setSuccess(null);

    try {
      const response = await submitCheckoutOrder({ items, form });
      const nextSuccess = response.order_id
        ? response
        : { ...response, order_id: 'N/A', total: checkoutTotal };

      trackPurchase({
        config: PUBLIC_ANALYTICS_CONFIG,
        deliveryMethod: form.delivery_method,
        items,
        orderId: nextSuccess.order_id,
        paymentMethod: form.payment_method,
        shippingFee,
        total: checkoutTotal,
      });

      clearCart();
      setSuccess(nextSuccess);
      showToast(`تم إنشاء الطلب بنجاح برقم ${nextSuccess.order_id}.`, {
        type: 'success',
        title: 'تم استلام الطلب',
      });
    } catch (err) {
      const nextError = err instanceof Error ? err.message : DEFAULT_CHECKOUT_ERROR_MESSAGE;
      setError(nextError);
      showToast(nextError, { type: 'error', title: 'تعذر إتمام الطلب' });
    } finally {
      setLoading(false);
    }
  }

  const canSubmit =
    items.length > 0 &&
    Boolean(form.customer_name.trim()) &&
    Boolean(form.customer_phone.trim()) &&
    !(form.payment_method === 'wallet' && !checkoutOptions.walletTransferNumber?.trim());
  const { shippingFee, total: checkoutTotal } = calculateCheckoutTotals({
    subtotal: cartTotal,
    deliveryMethod: form.delivery_method,
    deliveryMethods: checkoutOptions.deliveryMethods,
  });
  const walletTransferInstructions = getWalletTransferInstructions({
    paymentMethod: form.payment_method,
    walletTransferNumber: checkoutOptions.walletTransferNumber,
    total: checkoutTotal,
  });
  const isWalletTransferUnavailable =
    form.payment_method === 'wallet' && !checkoutOptions.walletTransferNumber?.trim();

  return {
    items,
    cartTotal,
    shippingFee,
    checkoutTotal,
    checkoutOptions,
    form,
    loading,
    error,
    success,
    canSubmit,
    walletTransferInstructions,
    isWalletTransferModalOpen,
    isWalletTransferUnavailable,
    closeWalletTransferModal,
    updateField,
    submitCheckout,
  };
}
