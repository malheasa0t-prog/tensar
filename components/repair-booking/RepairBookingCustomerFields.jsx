import styles from "./RepairBookingForm.module.css";

/**
 * Renders the customer contact fields using filled inputs.
 *
 * @param {{
 *   form: { name: string, phone: string },
 *   onChange: (event: React.ChangeEvent<HTMLInputElement>) => void
 * }} props
 * @returns {JSX.Element}
 */
export default function RepairBookingCustomerFields({ form, onChange }) {
  return (
    <div className={styles.fieldsGrid}>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>الاسم الكامل *</span>
        <input
          className={`form-input ${styles.input}`}
          name="name"
          value={form.name}
          onChange={onChange}
          required
          autoComplete="name"
          placeholder="أدخل الاسم الكامل"
        />
      </label>

      <label className={styles.field}>
        <span className={styles.fieldLabel}>رقم الهاتف *</span>
        <input
          className={`form-input ${styles.input}`}
          name="phone"
          value={form.phone}
          onChange={onChange}
          required
          autoComplete="tel"
          dir="ltr"
          placeholder="07XXXXXXXX"
        />
      </label>
    </div>
  );
}
