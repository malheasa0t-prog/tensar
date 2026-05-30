import Button from "@/components/Button";
import CheckoutWalletTransferModal from "@/components/checkout/CheckoutWalletTransferModal";
import { formatCurrency } from "@/lib/formatCurrency";

/**
 * Formats the order number returned by checkout.
 *
 * @param {{ display_number?: number | string, order_id?: string } | null | undefined} success
 * @returns {string}
 */
function getCheckoutSuccessOrderNumber(success) {
  const displayNumber = Number(success?.display_number || 0);
  if (Number.isInteger(displayNumber) && displayNumber > 0) {
    return `#${displayNumber}`;
  }

  return String(success?.order_id || "-").trim() || "-";
}

/**
 * Main checkout form card with dynamic payment and delivery options.
 *
 * @param {{
 *   canSubmit: boolean,
 *   checkoutOptions: { paymentMethods: Array<Record<string, unknown>>, deliveryMethods: Array<Record<string, unknown>>, walletTransferNumber?: string },
 *   checkoutTotal: number,
 *   error: string,
 *   form: Record<string, string>,
 *   hasDigitalItems: boolean,
 *   isWalletTransferModalOpen: boolean,
 *   isWalletTransferUnavailable: boolean,
 *   loading: boolean,
 *   onCloseWalletTransferModal: () => void,
 *   onFieldChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void,
 *   onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>,
 *   success: Record<string, unknown> | null,
 *   walletTransferInstructions: { amountText: string, walletNumber: string } | null,
 * }} props
 * @returns {JSX.Element}
 */
export default function CheckoutFormCard({
  canSubmit,
  checkoutOptions,
  checkoutTotal,
  coupon,
  error,
  form,
  hasDigitalItems,
  isWalletTransferModalOpen,
  isWalletTransferUnavailable,
  loading,
  payableTotal,
  walletBalance,
  walletPayAvailable,
  walletInsufficient,
  onApplyCoupon,
  onCloseWalletTransferModal,
  onFieldChange,
  onSubmit,
  success,
  walletTransferInstructions,
}) {
  return (
    <div className="surface-card checkout-main-card">
      <h2 style={{ marginBottom: "0.75rem" }}>بيانات العميل</h2>
      <p style={{ color: "var(--text-muted)", marginBottom: "1rem" }}>
        أكمل المعلومات الأساسية ثم راجع الملخص قبل تأكيد الطلب.
      </p>

      {error ? <div className="form-alert error">{error}</div> : null}
      {success ? (
        <div className="form-alert success">
          تم إنشاء الطلب بنجاح. رقم الطلب: <strong>{getCheckoutSuccessOrderNumber(success)}</strong>
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="auth-form" style={{ marginTop: "1rem" }}>
        <div className="field-grid">
          <div className="form-field">
            <label htmlFor="customer_name">الاسم الكامل *</label>
            <input
              id="customer_name"
              className="form-input"
              name="customer_name"
              value={form.customer_name}
              onChange={onFieldChange}
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="customer_phone">رقم الهاتف *</label>
            <input
              id="customer_phone"
              className="form-input"
              name="customer_phone"
              value={form.customer_phone}
              onChange={onFieldChange}
              required
              dir="ltr"
            />
          </div>
        </div>

        {hasDigitalItems ? (
          <div className="form-field">
            <label htmlFor="customer_contact_link">
              رقم الواتساب أو وسيلة التواصل *
            </label>
            <input
              id="customer_contact_link"
              className="form-input"
              name="customer_contact_link"
              value={form.customer_contact_link || ''}
              onChange={onFieldChange}
              required
              dir="ltr"
              placeholder="مثال: 962790000000+"
            />
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.35rem' }}>
              مطلوب للخدمات الرقمية — سيتم التواصل معك لتسليم الطلب.
            </p>
          </div>
        ) : null}

        <div className="field-grid">
          <div className="form-field">
            <label htmlFor="delivery_method">طريقة التسليم</label>
            <select
              id="delivery_method"
              className="form-input"
              name="delivery_method"
              value={form.delivery_method}
              onChange={onFieldChange}
            >
              {checkoutOptions.deliveryMethods.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="payment_method">طريقة الدفع</label>
            <select
              id="payment_method"
              className="form-input"
              name="payment_method"
              value={form.payment_method}
              onChange={onFieldChange}
            >
              {checkoutOptions.paymentMethods.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.value === "wallet" ? "محفظة Orange Money" : option.label}
                </option>
              ))}
              {walletPayAvailable ? (
                <option value="wallet_balance">
                  الدفع من رصيد المحفظة ({formatCurrency(walletBalance || 0)})
                </option>
              ) : null}
            </select>

            {form.payment_method === "wallet_balance" ? (
              <div className={walletInsufficient ? "form-alert error" : "form-alert success"} role="alert">
                {walletInsufficient
                  ? `رصيد محفظتك (${formatCurrency(walletBalance || 0)}) لا يكفي لدفع ${formatCurrency(payableTotal ?? checkoutTotal)}. اشحن المحفظة أو اختر طريقة دفع أخرى.`
                  : `سيتم خصم ${formatCurrency(payableTotal ?? checkoutTotal)} من رصيد محفظتك فوراً وتأكيد الطلب — بدون تحويل أو انتظار.`}
              </div>
            ) : null}

            {form.payment_method === "wallet" ? (
              <div
                className={isWalletTransferUnavailable ? "form-alert error" : "form-alert success"}
                role="alert"
              >
                {isWalletTransferUnavailable
                  ? "تحويل المحفظة غير متاح لهذا الطلب."
                  : `سيظهر لك رقم محفظة Orange Money والمبلغ المطلوب (${walletTransferInstructions?.amountText || formatCurrency(checkoutTotal)}) في نافذة منبثقة. استخدم نفس رقم الهاتف المكتوب في بيانات الطلب حتى تتم مطابقة الحوالة وتأكيد الطلب تلقائياً فور وصولها.`}
              </div>
            ) : null}
          </div>
        </div>

        <div className="form-field">
          <label htmlFor="coupon_code">كود الخصم (اختياري)</label>
          <div style={{ display: "flex", gap: "8px", alignItems: "stretch" }}>
            <input
              id="coupon_code"
              className="form-input"
              type="text"
              name="coupon_code"
              value={form.coupon_code || ""}
              onChange={onFieldChange}
              placeholder="أدخل كود الكوبون إن وُجد"
              style={{ textTransform: "uppercase", flex: 1 }}
              autoComplete="off"
            />
            <Button
              type="button"
              variant="outline"
              onClick={onApplyCoupon}
              disabled={!form.coupon_code?.trim() || coupon?.status === "checking"}
              loading={coupon?.status === "checking"}
            >
              تطبيق
            </Button>
          </div>
          {coupon?.status === "valid" ? (
            <p style={{ marginTop: "6px", color: "var(--success, #16a34a)", fontSize: "0.9rem" }}>
              ✓ تم تطبيق الخصم: {formatCurrency(coupon.discount)}
            </p>
          ) : null}
          {coupon?.status === "invalid" ? (
            <p style={{ marginTop: "6px", color: "var(--danger, #dc2626)", fontSize: "0.9rem" }}>
              {coupon.message}
            </p>
          ) : null}
        </div>

        <div className="form-field">
          <label htmlFor="notes">ملاحظات إضافية</label>
          <textarea
            id="notes"
            className="form-input"
            rows={4}
            name="notes"
            value={form.notes}
            onChange={onFieldChange}
            placeholder="أي تفاصيل إضافية للطلب"
          />
        </div>

        <Button
          type="submit"
          disabled={!canSubmit}
          loading={loading}
          fullWidth
          loadingLabel="جارٍ إنشاء الطلب..."
        >
          {success ? "تم الإرسال بنجاح" : "تأكيد الطلب"}
        </Button>
      </form>

      <CheckoutWalletTransferModal
        instructions={walletTransferInstructions}
        isOpen={isWalletTransferModalOpen}
        onClose={onCloseWalletTransferModal}
      />
    </div>
  );
}
