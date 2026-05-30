/**
 * Public order/booking tracking page.
 *
 * Hosts the existing RepairOrderLookupCard (which posts to /api/orders/lookup)
 * on a dedicated, shareable URL so customers can check a delivery order or a
 * repair booking by its number + the last 4 digits of their phone — no login.
 */

'use client';

import PageSectionBreadcrumbs from '@/components/PageSectionBreadcrumbs';
import RepairOrderLookupCard from '@/components/repair-booking/RepairOrderLookupCard';
import { usePageSeo } from '@/hooks/usePageSeo';

/**
 * Renders the standalone order-tracking page.
 *
 * @returns {JSX.Element}
 */
export default function TrackOrderPage() {
  usePageSeo({
    title: 'تتبّع الطلب',
    description: 'تابع حالة طلب التوصيل أو حجز الصيانة برقم الطلب وآخر 4 أرقام من هاتفك دون تسجيل دخول.',
    canonicalPath: '/track',
    breadcrumbItems: [
      { href: '/', label: 'الرئيسية' },
      { label: 'تتبّع الطلب' },
    ],
    breadcrumbLabel: 'تتبّع الطلب',
  });

  return (
    <section className="section page-top">
      <div className="container">
        <div className="section-topbar" style={{ marginBottom: '1rem' }}>
          <PageSectionBreadcrumbs />
        </div>

        <header style={{ textAlign: 'center', maxWidth: '640px', margin: '0 auto 1.5rem' }}>
          <h1 style={{ margin: 0 }}>تتبّع طلبك</h1>
          <p style={{ marginTop: '0.5rem', color: 'var(--text-muted)' }}>
            أدخل رقم الطلب أو الحجز مع آخر 4 أرقام من رقم هاتفك لعرض حالته الحالية.
          </p>
        </header>

        <div style={{ maxWidth: '640px', margin: '0 auto' }}>
          <RepairOrderLookupCard />
        </div>
      </div>
    </section>
  );
}
