import AppIcon from '@/components/AppIcon';

/**
 * Main checkout form card with dynamic payment and delivery options.
 *
 * @param {{
 *   checkoutOptions: { paymentMethods: Array<Record<string, unknown>>, deliveryMethods: Array<Record<string, unknown>> },
 *   form: Record<string, string>,
 *   loading: boolean,
 *   error: string,
 *   success: Record<string, unknown> | null,
 *   canSubmit: boolean,
 *   onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>,
 *   onFieldChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void,
 * }} props
 * @returns {JSX.Element}
 */
export default function CheckoutFormCard({
  checkoutOptions,
  form,
  loading,
  error,
  success,
  canSubmit,
  onSubmit,
  onFieldChange,
}) {
  return (
    <div className="surface-card checkout-main-card">
      <h2 style={{ marginBottom: '0.75rem' }}>بيانات العميل</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
        أكمل المعلومات الأساسية ثم راجع الملخص قبل تأكيد الطلب.
      </p>

      {error ? <div className="form-alert error">{error}</div> : null}
      {success ? (
        <div className="form-alert success">
          تم إنشاء الطلب بنجاح. رقم الطلب: <strong>{success.order_id}</strong>
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="auth-form" style={{ marginTop: '1rem' }}>
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

        <div className="form-field">
          <label htmlFor="customer_email">البريد الإلكتروني</label>
          <input
            id="customer_email"
            className="form-input"
            type="email"
            name="customer_email"
            value={form.customer_email}
            onChange={onFieldChange}
            dir="ltr"
          />
        </div>

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

        <button
          type="submit"
          className={loading ? 'btn btn-primary btn-block is-loading' : 'btn btn-primary btn-block'}
          disabled={loading || !canSubmit}
        >
          <AppIcon name="shopping-cart" size={16} />
          {loading ? 'جاري إنشاء الطلب...' : 'تأكيد الطلب'}
        </button>
      </form>
    </div>
  );
}
