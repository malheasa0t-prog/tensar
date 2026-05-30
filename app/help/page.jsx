/**
 * Help center / FAQ page.
 *
 * Aggregates the editable FAQ content (stored in site settings → content.faqs),
 * working hours, and contact channels into one self-service support page so
 * customers can find answers without opening a ticket. All content is editable
 * from the admin settings (content block) — no code change needed to update it.
 */

'use client';

import Link from 'next/link';
import AppIcon from '@/components/AppIcon';
import PageSectionBreadcrumbs from '@/components/PageSectionBreadcrumbs';
import RepairBookingFaq from '@/components/repair-booking/RepairBookingFaq';
import { useSiteRuntime } from '@/components/SiteRuntimeProvider';
import { usePageSeo } from '@/hooks/usePageSeo';
import { getWhatsappSupportLink, normalizeSiteSettings } from '@/lib/contactChannels';

/**
 * Renders the help center page.
 *
 * @returns {JSX.Element}
 */
export default function HelpCenterPage() {
  const { siteSettings } = useSiteRuntime();
  const settings = siteSettings || normalizeSiteSettings();
  const faqs = settings.content?.faqs || [];
  const workingHours = settings.content?.workingHours || [];
  const phone = settings.company?.phone || '';
  const email = settings.company?.email || '';
  const whatsappHref = getWhatsappSupportLink(settings);

  usePageSeo({
    title: 'مركز المساعدة',
    description: 'إجابات الأسئلة الشائعة وساعات العمل وطرق التواصل مع TechZone.',
    canonicalPath: '/help',
    breadcrumbItems: [
      { href: '/', label: 'الرئيسية' },
      { label: 'مركز المساعدة' },
    ],
    breadcrumbLabel: 'مركز المساعدة',
  });

  return (
    <section className="section page-top">
      <div className="container">
        <div className="section-topbar" style={{ marginBottom: '1rem' }}>
          <PageSectionBreadcrumbs />
        </div>

        <header style={{ textAlign: 'center', maxWidth: '680px', margin: '0 auto 2rem' }}>
          <h1 style={{ margin: 0 }}>مركز المساعدة</h1>
          <p style={{ marginTop: '0.5rem', color: 'var(--text-muted)' }}>
            إجابات سريعة لأكثر الأسئلة شيوعاً. لم تجد ما تبحث عنه؟ تواصل معنا مباشرة.
          </p>
        </header>

        {/* ── Contact channels ── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1rem',
            marginBottom: '2rem',
          }}
        >
          {whatsappHref ? (
            <a className="surface-card" href={whatsappHref} target="_blank" rel="noopener noreferrer" style={{ padding: '1.1rem', display: 'flex', gap: '12px', alignItems: 'center', textDecoration: 'none' }}>
              <AppIcon name="message-circle" size={24} />
              <div><strong>واتساب</strong><div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>تواصل فوري عبر واتساب</div></div>
            </a>
          ) : null}
          {phone ? (
            <a className="surface-card" href={`tel:${phone}`} style={{ padding: '1.1rem', display: 'flex', gap: '12px', alignItems: 'center', textDecoration: 'none' }}>
              <AppIcon name="phone" size={24} />
              <div><strong>اتصل بنا</strong><div dir="ltr" style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{phone}</div></div>
            </a>
          ) : null}
          {email ? (
            <a className="surface-card" href={`mailto:${email}`} style={{ padding: '1.1rem', display: 'flex', gap: '12px', alignItems: 'center', textDecoration: 'none' }}>
              <AppIcon name="mail" size={24} />
              <div><strong>البريد الإلكتروني</strong><div dir="ltr" style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{email}</div></div>
            </a>
          ) : null}
        </div>

        {/* ── FAQs ── */}
        {faqs.length > 0 ? (
          <div style={{ maxWidth: '820px', margin: '0 auto 2rem' }}>
            <h2 style={{ marginBottom: '1rem' }}>الأسئلة الشائعة</h2>
            <RepairBookingFaq items={faqs} />
          </div>
        ) : null}

        {/* ── Working hours ── */}
        {workingHours.length > 0 ? (
          <div className="surface-card" style={{ maxWidth: '820px', margin: '0 auto', padding: '1.25rem' }}>
            <h2 style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AppIcon name="clock" size={20} /> ساعات العمل
            </h2>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {workingHours.map((entry) => (
                <li key={`${entry.day}-${entry.hours}`} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                  <span>{entry.day}</span>
                  <strong dir="ltr">{entry.hours}</strong>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <Link href="/contact" className="btn btn-primary">ما زلت بحاجة لمساعدة؟ تواصل معنا</Link>
        </div>
      </div>
    </section>
  );
}
