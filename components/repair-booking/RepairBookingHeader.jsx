/**
 * Renders the static header and account-prefill hint for the repair form.
 *
 * @param {{ isAccountPrefilled: boolean }} props
 * @returns {JSX.Element}
 */
export default function RepairBookingHeader({ isAccountPrefilled }) {
  return (
    <>
      <div className="repair-form-header">
        <div className="repair-srv-icon">🛠️</div>
        <div>
          <h3>نموذج طلب صيانة</h3>
          <p>أدخل بياناتك وسنرتب طلب الصيانة مباشرة.</p>
        </div>
      </div>

      {isAccountPrefilled ? (
        <p className="form-message" style={{ marginBottom: "1rem" }}>
          تم تعبئة بياناتك من الحساب لتسهيل متابعة الطلب من لوحة التحكم.
        </p>
      ) : null}
    </>
  );
}
