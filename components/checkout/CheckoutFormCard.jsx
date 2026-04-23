import Button from "@/components/Button";
import CheckoutWalletTransferModal from "@/components/checkout/CheckoutWalletTransferModal";
import { formatCurrency } from "@/lib/formatCurrency";

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
  error,
  form,
  hasDigitalItems,
  isWalletTransferModalOpen,
  isWalletTransferUnavailable,
  loading,
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
          تم إنشاء الطلب بنجاح. رقم الطلب: <strong>{success.order_id}</strong>
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
                  {option.label}
                </option>
              ))}
            </select>

            {form.payment_method === "wallet" ? (
              <div
                className={isWalletTransferUnavailable ? "form-alert error" : "form-alert success"}
                style={{ marginTop: "0.75rem" }}
              >
                {isWalletTransferUnavailable
                  ? "لم يتم ضبط رقم المحفظة في لوحة التحكم بعد، لذلك لا يمكن استخدام هذا الخيار حاليًا."
                  : `سيظهر لك رقم المحفظة والمبلغ المطلوب (${walletTransferInstructions?.amountText || formatCurrency(checkoutTotal)}) في نافذة منبثقة.`}
              </div>
            ) : null}
          </div>
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
