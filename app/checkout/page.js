'use client';

import CheckoutFormCard from '@/components/checkout/CheckoutFormCard';
import CheckoutHero from '@/components/checkout/CheckoutHero';
import CheckoutSummaryCard from '@/components/checkout/CheckoutSummaryCard';
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
    checkoutOptions,
    form,
    loading,
    error,
    success,
    canSubmit,
    updateField,
    submitCheckout,
  } = useCheckoutPage();

  return (
    <>
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
            onSubmit={submitCheckout}
            onFieldChange={updateField}
          />
          <CheckoutSummaryCard items={items} cartTotal={cartTotal} />
        </div>
      </section>
    </>
  );
}
