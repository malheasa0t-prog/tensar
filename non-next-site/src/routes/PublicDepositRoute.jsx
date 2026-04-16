import DepositRequestPanel from "../components/DepositRequestPanel.jsx";

/**
 * Renders the public manual deposit route in the non-Next copy.
 *
 * @returns {JSX.Element}
 */
export default function PublicDepositRoute() {
  return (
    <section className="section">
      <div className="container">
        <div className="section-header" style={{ marginBottom: "1.5rem", textAlign: "start" }}>
          <span className="section-badge">طلبات الإيداع</span>
          <h1>إيداع رصيد في المحفظة</h1>
          <p>أدخل المبلغ المطلوب وارفع إثبات التحويل، وسيصل الطلب مباشرة إلى لوحة التحكم للموافقة أو الرفض.</p>
        </div>

        <DepositRequestPanel />
      </div>
    </section>
  );
}
