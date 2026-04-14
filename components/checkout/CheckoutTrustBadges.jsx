import AppIcon from "@/components/AppIcon";

const CHECKOUT_TRUST_BADGES = Object.freeze([
  {
    icon: "lock",
    title: "دفع آمن ومشفر",
    description: "بيانات الدفع والطلب تُعالج داخل قناة آمنة ومحمية طوال عملية الشراء.",
  },
  {
    icon: "shield-check",
    title: "ضمان جودة المنتجات",
    description: "المنتجات المعروضة تمر بمراجعة واضحة للحالة والتوفر قبل تأكيد الطلب.",
  },
  {
    icon: "refresh-cw",
    title: "سياسة إرجاع واضحة",
    description: "إجراءات الاستبدال أو الإرجاع موضحة بشكل مباشر عند الحاجة إلى المتابعة.",
  },
  {
    icon: "phone-call",
    title: "دعم فني على مدار الساعة",
    description: "يمكنك التواصل معنا سريعًا عند أي استفسار قبل أو بعد إتمام الشراء.",
  },
]);

/**
 * Renders trust badges below the checkout flow to reinforce confidence.
 *
 * @returns {JSX.Element}
 */
export default function CheckoutTrustBadges() {
  return (
    <div className="surface-panel checkout-trust-panel">
      <div className="checkout-trust-header">
        <span className="section-badge">
          <AppIcon name="shield-check" size={14} />
          حماية وثقة
        </span>
        <h2>لماذا تشعر بالاطمئنان أثناء إتمام الطلب؟</h2>
      </div>

      <div className="checkout-trust-list">
        {CHECKOUT_TRUST_BADGES.map((badge) => (
          <div key={badge.title} className="checkout-trust-card">
            <span className="checkout-trust-icon" aria-hidden="true">
              <AppIcon name={badge.icon} size={18} />
            </span>
            <div className="checkout-trust-copy">
              <strong>{badge.title}</strong>
              <span>{badge.description}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
