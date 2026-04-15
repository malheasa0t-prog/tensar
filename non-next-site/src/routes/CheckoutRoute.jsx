import "@/app/techfix-pages.css";
import "@/app/techfix-checkout.css";
import CheckoutFormCard from "@/components/checkout/CheckoutFormCard";
import CheckoutHero from "@/components/checkout/CheckoutHero";
import CheckoutSummaryCard from "@/components/checkout/CheckoutSummaryCard";
import CheckoutTrustBadges from "@/components/checkout/CheckoutTrustBadges";
import { useCheckoutPage } from "@/hooks/useCheckoutPage";

/**
 * Renders the checkout route in the non-Next copy.
 *
 * @returns {JSX.Element}
 */
export default function CheckoutRoute() {
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
    submitCheckout
  } = useCheckoutPage();

  return (
    <>
      <CheckoutHero />

      <section className="section" style={{ paddingTop: "2rem", paddingBottom: "4rem" }}>
        <div className="container checkout-layout">
          <CheckoutFormCard
            checkoutOptions={checkoutOptions}
            form={form}
            loading={loading}
            error={error}
            success={success}
            canSubmit={canSubmit}
            checkoutTotal={checkoutTotal}
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

        <div className="container" style={{ marginTop: "1.4rem" }}>
          <CheckoutTrustBadges />
        </div>
      </section>
    </>
  );
}
