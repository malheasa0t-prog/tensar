'use client';

import "../techfix-pages.css";
import "@/app/techfix-neon.css";
import "@/app/techfix-neon-effects.css";
import "../techfix-checkout.css";
import CheckoutFormCard from '@/components/checkout/CheckoutFormCard';
import CheckoutHero from '@/components/checkout/CheckoutHero';
import CheckoutSummaryCard from '@/components/checkout/CheckoutSummaryCard';
import CheckoutTrustBadges from '@/components/checkout/CheckoutTrustBadges';
import SuccessConfetti from '@/components/SuccessConfetti';
import { useCheckoutPage } from '@/hooks/useCheckoutPage';

/**
 * Customer checkout page with dynamic settings-backed options.
 *
 * @returns {JSX.Element}
 */
export default function CheckoutPage() {
  const {
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
    walletBalance,
    walletPayAvailable,
    walletInsufficient,
    applyCoupon,
    closeWalletTransferModal,
    updateField,
    submitCheckout,
  } = useCheckoutPage();

  const hasDigitalItems = items.some((item) => String(item.id || '').startsWith('srv-'));

  return (
    <>
      <SuccessConfetti activeKey={success?.order_id || ''} />
      <CheckoutHero />

      <section className="section" style={{ paddingTop: '2rem', paddingBottom: '4rem' }}>
        <div className="container checkout-layout">
          <CheckoutFormCard
            checkoutOptions={checkoutOptions}
            form={form}
            loading={loading}
            error={error}
            success={success}
            canSubmit={canSubmit}
            checkoutTotal={checkoutTotal}
            coupon={coupon}
            payableTotal={payableTotal}
            walletBalance={walletBalance}
            walletPayAvailable={walletPayAvailable}
            walletInsufficient={walletInsufficient}
            hasDigitalItems={hasDigitalItems}
            walletTransferInstructions={walletTransferInstructions}
            isWalletTransferModalOpen={isWalletTransferModalOpen}
            isWalletTransferUnavailable={isWalletTransferUnavailable}
            onApplyCoupon={applyCoupon}
            onCloseWalletTransferModal={closeWalletTransferModal}
            onSubmit={submitCheckout}
            onFieldChange={updateField}
          />
          <CheckoutSummaryCard
            items={items}
            cartTotal={cartTotal}
            shippingFee={shippingFee}
            checkoutTotal={checkoutTotal}
            couponDiscount={couponDiscount}
            payableTotal={payableTotal}
          />
        </div>

        <div className="container" style={{ marginTop: '1.4rem' }}>
          <CheckoutTrustBadges />
        </div>
      </section>
    </>
  );
}
