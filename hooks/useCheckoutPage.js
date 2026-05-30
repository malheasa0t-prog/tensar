'use client';

import { useEffect, useRef, useState } from 'react';
import { useCart } from '@/components/CartProvider';
import { useToast } from '@/components/ToastProvider';
import { trackPurchase } from '@/lib/analyticsModel';
import {
  calculateCheckoutTotals,
  createCheckoutFormState,
  getWalletTransferInstructions,
  syncCheckoutSelections,
} from '@/lib/checkoutModel';
import { formatDashboardOrderNumber } from '@/lib/dashboardOrdersModel';
import {
  acquireSubmissionLock,
  createSubmissionState,
  releaseSubmissionLock,
  resetSubmissionIdempotencyKey,
  resolveSubmissionIdempotencyKey,
} from '@/lib/idempotencyKey';
import { PUBLIC_ANALYTICS_CONFIG } from '@/lib/publicAnalyticsConfig';
import { evaluateCoupon, normalizeCouponCode } from '@/lib/couponModel';
import { loadSupabaseClient } from '@/lib/loadSupabaseClient';
import {
  fetchCheckoutOptions,
  getDefaultCheckoutOptions,
  submitCheckoutOrder,
} from '@/services/checkoutService';

const IDLE_COUPON_STATE = Object.freeze({ status: 'idle', discount: 0, message: '', code: '' });

const DEFAULT_CHECKOUT_ERROR_MESSAGE =
  '[CKP-500] \u062d\u062f\u062b \u062e\u0637\u0623 \u063a\u064a\u0631 \u0645\u062a\u0648\u0642\u0639 \u0623\u062b\u0646\u0627\u0621 \u0625\u062a\u0645\u0627\u0645 \u0627\u0644\u0637\u0644\u0628.';
const INCOMPLETE_CHECKOUT_MESSAGE =
  '[CKP-101] \u0623\u0643\u0645\u0644 \u0627\u0644\u0627\u0633\u0645 \u0648\u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062a\u0641 \u0642\u0628\u0644 \u062a\u0623\u0643\u064a\u062f \u0627\u0644\u0637\u0644\u0628.';
const MISSING_CONTACT_LINK_MESSAGE =
  '[CKP-102] \u0623\u062f\u062e\u0644 \u0631\u0642\u0645 \u0627\u0644\u0648\u0627\u062a\u0633\u0627\u0628 \u0623\u0648 \u0648\u0633\u064a\u0644\u0629 \u0627\u0644\u062a\u0648\u0627\u0635\u0644 \u0644\u0644\u062e\u062f\u0645\u0627\u062a \u0627\u0644\u0631\u0642\u0645\u064a\u0629.';
const INCOMPLETE_CHECKOUT_TITLE = '\u0628\u064a\u0627\u0646\u0627\u062a \u0646\u0627\u0642\u0635\u0629';
const CHECKOUT_SUCCESS_TITLE = '\u062a\u0645 \u0627\u0633\u062a\u0644\u0627\u0645 \u0627\u0644\u0637\u0644\u0628';
const CHECKOUT_ERROR_TITLE = '\u062a\u0639\u0630\u0631 \u0625\u062a\u0645\u0627\u0645 \u0627\u0644\u0637\u0644\u0628';

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
  const [coupon, setCoupon] = useState(IDLE_COUPON_STATE);
  const submissionStateRef = useRef(createSubmissionState());

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

    /**
     * Prefills the checkout form from the signed-in user's saved profile so
     * returning customers don't retype their details. Empty fields only.
     *
     * @returns {Promise<void>}
     */
    async function prefillFromProfile() {
      try {
        const supabase = await loadSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !mounted) return;

        const { data: profile } = await supabase
          .from('user_profiles')
          .select('full_name, phone')
          .eq('user_id', user.id)
          .maybeSingle();
        if (!mounted) return;

        setForm((prev) => ({
          ...prev,
          customer_name: prev.customer_name || profile?.full_name || user.user_metadata?.full_name || '',
          customer_phone: prev.customer_phone || profile?.phone || '',
          customer_email: prev.customer_email || user.email || '',
        }));
      } catch (prefillError) {
        void prefillError;
      }
    }

    hydrateCheckoutSettings();
    prefillFromProfile();

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
    // Editing the code invalidates any previous preview; force a re-check.
    if (name === 'coupon_code') {
      setCoupon(IDLE_COUPON_STATE);
    }
  }

  /**
   * Validates the entered coupon against the live catalog and previews the
   * discount. This is display-only — the server re-validates authoritatively.
   *
   * @returns {Promise<void>}
   */
  async function applyCoupon() {
    const code = normalizeCouponCode(form.coupon_code);
    if (!code) {
      setCoupon(IDLE_COUPON_STATE);
      return;
    }

    setCoupon({ status: 'checking', discount: 0, message: '', code });
    try {
      const supabase = await loadSupabaseClient();
      const { data: couponRow } = await supabase
        .from('coupons')
        .select('code, type, value, min_order, max_discount, max_uses, used_count, status, expires_at')
        .eq('code', code)
        .maybeSingle();

      const evaluation = evaluateCoupon({ coupon: couponRow, subtotal: cartTotal });
      if (!evaluation.valid) {
        setCoupon({ status: 'invalid', discount: 0, message: evaluation.reason || 'الكوبون غير صالح', code });
        return;
      }
      setCoupon({ status: 'valid', discount: evaluation.discount, message: '', code });
    } catch (couponError) {
      void couponError;
      setCoupon({ status: 'invalid', discount: 0, message: 'تعذّر التحقق من الكوبون', code });
    }
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
    if (!acquireSubmissionLock(submissionStateRef.current)) {
      return;
    }

    let shouldResetIdempotencyKey = false;

    try {
      if (!items.length || !form.customer_name.trim() || !form.customer_phone.trim()) {
        setError(INCOMPLETE_CHECKOUT_MESSAGE);
        showToast(INCOMPLETE_CHECKOUT_MESSAGE, { type: 'warning', title: INCOMPLETE_CHECKOUT_TITLE });
        return;
      }

      const cartHasDigitalItems = items.some((item) => String(item.id || '').startsWith('srv-'));
      if (cartHasDigitalItems && !form.customer_contact_link?.trim()) {
        setError(MISSING_CONTACT_LINK_MESSAGE);
        showToast(MISSING_CONTACT_LINK_MESSAGE, { type: 'warning', title: INCOMPLETE_CHECKOUT_TITLE });
        return;
      }

      setLoading(true);
      setError('');
      setSuccess(null);

      const response = await submitCheckoutOrder({
        items,
        form,
        idempotencyKey: resolveSubmissionIdempotencyKey({
          state: submissionStateRef.current,
          fingerprint: JSON.stringify({
            form,
            items: items.map((item) => ({
              id: String(item.id || ''),
              qty: Number(item.qty || 0),
            })),
          }),
        }),
      });
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
      showToast(
        `\u062a\u0645 \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0637\u0644\u0628 \u0628\u0646\u062c\u0627\u062d \u0628\u0631\u0642\u0645 ${formatDashboardOrderNumber({
          id: nextSuccess.order_id,
          display_number: nextSuccess.display_number,
        })}.`,
        {
          type: 'success',
          title: CHECKOUT_SUCCESS_TITLE,
        }
      );
      shouldResetIdempotencyKey = true;
    } catch (err) {
      const nextError = err instanceof Error ? err.message : DEFAULT_CHECKOUT_ERROR_MESSAGE;
      setError(nextError);
      showToast(nextError, { type: 'error', title: CHECKOUT_ERROR_TITLE });
    } finally {
      if (shouldResetIdempotencyKey) {
        resetSubmissionIdempotencyKey(submissionStateRef.current);
      }
      releaseSubmissionLock(submissionStateRef.current);
      setLoading(false);
    }
  }

  const hasDigitalItems = items.some((item) => String(item.id || '').startsWith('srv-'));
  const canSubmit =
    items.length > 0 &&
    Boolean(form.customer_name.trim()) &&
    Boolean(form.customer_phone.trim()) &&
    !(hasDigitalItems && !form.customer_contact_link?.trim()) &&
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

  const couponDiscount = coupon.status === 'valid' ? coupon.discount : 0;
  const payableTotal = Math.max(0, checkoutTotal - couponDiscount);

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
    coupon,
    couponDiscount,
    payableTotal,
    applyCoupon,
    closeWalletTransferModal,
    updateField,
    submitCheckout,
  };
}
