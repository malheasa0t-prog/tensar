/**
 * Public Orange Money deposit page wrapper.
 */

import DepositPage from "@/app/dashboard/deposit/page";

/**
 * Renders the public deposit page on the main website.
 *
 * @returns {JSX.Element}
 */
export default function PublicDepositPage() {
  return (
    <section className="section">
      <div className="container">
        <div className="section-header" style={{ marginBottom: "1.5rem", textAlign: "start" }}>
          <span className="section-badge">طلبات الإيداع</span>
          <h1>إيداع رصيد في المحفظة</h1>
          <p>
            أدخل المبلغ ورقم الهاتف الذي تم التحويل منه عبر Orange Money. إذا كانت الحوالة وصلت مسبقًا يمكنك أيضًا إدخال الرقم المرجعي لربطها فورًا، وإلا فسيتم تأكيد الطلب تلقائيًا عند وصول الرسالة المطابقة.
          </p>
        </div>

        <DepositPage />
      </div>
    </section>
  );
}
