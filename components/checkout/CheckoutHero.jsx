import AppIcon from '@/components/AppIcon';
import Breadcrumbs from '@/components/Breadcrumbs';

/**
 * Renders the checkout hero and breadcrumb trail.
 *
 * @returns {JSX.Element}
 */
export default function CheckoutHero() {
  return (
    <section className="page-hero" style={{ paddingBottom: '2rem' }}>
      <div className="container">
        <div className="section-topbar">
          <Breadcrumbs
            items={[
              { href: '/', label: 'الرئيسية' },
              { href: '/products', label: 'المنتجات' },
              { label: 'إتمام الشراء' },
            ]}
            currentPath="/checkout"
          />

          <span className="section-badge">
            <AppIcon name="credit-card" size={14} />
            إتمام الشراء
          </span>
        </div>

        <h1>خطوة أخيرة قبل تأكيد الطلب</h1>
        <p>أدخل بيانات الطلب وسيتم إنشاء العملية مباشرة داخل النظام.</p>
      </div>
    </section>
  );
}
