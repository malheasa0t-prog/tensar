'use client';

import "../techfix-pages.css";
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
            hasDigitalItems={hasDigitalItems}
            walletTransferInstructions={walletTransferInstructions}
            isWalletTransferModalOpen={isWalletTransferModalOpen}
            isWalletTransferUnavailable={isWalletTransferUnavailable}
            onCloseWalletTransferModal={closeWalletTransferModal}
            onSubmit={submitCheckout}
            onFieldChange={updateField}
          />
          <CheckoutSummaryCard
            items={items}
            cartTotal={cartTotal}
            shippingFee={shippingFee}
            checkoutTotal={checkoutTotal}
          />
        </div>

        <div className="container" style={{ marginTop: '1.4rem' }}>
          <CheckoutTrustBadges />
        </div>
      </section>
    </>
  );
}
