/**
 * Renders the customer identity fields for the repair booking form.
 *
 * @param {{
 *   form: { name: string, phone: string },
 *   onChange: (event: React.ChangeEvent<HTMLInputElement>) => void
 * }} props
 * @returns {JSX.Element}
 */
export default function RepairBookingCustomerFields({ form, onChange }) {
  return (
    <>
      <label>
        الاسم الكامل *
        <input name="name" value={form.name} onChange={onChange} required />
      </label>

      <label>
        رقم الهاتف *
        <input name="phone" value={form.phone} onChange={onChange} required dir="ltr" />
      </label>
    </>
  );
}
