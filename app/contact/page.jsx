/**
 * Contact Page — Premium Glassmorphism Design.
 *
 * Displays contact methods in a horizontal grid, working hours,
 * branch info, and social media channels with smooth animations.
 */

'use client';

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import AppIcon from '@/components/AppIcon';
import CatalogPageSkeleton from '@/components/CatalogPageSkeleton';
import { getContactMethods, getSocialLinks } from '@/lib/contactChannels';
import { getSiteSettings } from '@/lib/siteSettings';
import styles from './contactPage.module.css';

/** Brand color mapping for social platform icon backgrounds. */
const SOCIAL_BRAND_COLORS = {
  whatsapp: { bg: 'rgba(37, 211, 102, 0.15)', border: 'rgba(37, 211, 102, 0.3)', color: '#25d366' },
  instagram: { bg: 'rgba(228, 64, 95, 0.15)', border: 'rgba(228, 64, 95, 0.3)', color: '#e4405f' },
  tiktok: { bg: 'rgba(255, 0, 80, 0.12)', border: 'rgba(255, 0, 80, 0.25)', color: '#ff0050' },
  x: { bg: 'rgba(255, 255, 255, 0.1)', border: 'rgba(255, 255, 255, 0.2)', color: '#ffffff' },
  snapchat: { bg: 'rgba(255, 252, 0, 0.12)', border: 'rgba(255, 252, 0, 0.3)', color: '#fffc00' },
  facebook: { bg: 'rgba(24, 119, 242, 0.15)', border: 'rgba(24, 119, 242, 0.3)', color: '#1877f2' },
  youtube: { bg: 'rgba(255, 0, 0, 0.12)', border: 'rgba(255, 0, 0, 0.25)', color: '#ff0000' },
  telegram: { bg: 'rgba(38, 165, 227, 0.15)', border: 'rgba(38, 165, 227, 0.3)', color: '#26a5e4' },
  linkedin: { bg: 'rgba(10, 102, 194, 0.15)', border: 'rgba(10, 102, 194, 0.3)', color: '#0a66c2' },
};

/**
 * Renders the contact page with all channels and social links.
 *
 * @returns {JSX.Element}
 */
export default function ContactPage() {
  const [siteSettings, setSiteSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    /**
     * Loads site settings from Supabase.
     *
     * @returns {Promise<void>}
     */
    async function loadData() {
      try {
        const settings = await getSiteSettings();
        if (!cancelled) setSiteSettings(settings);
      } catch (error) {
        console.error('[CTP-500] ContactPage: failed to load', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();
    return () => { cancelled = true; };
  }, []);

  if (loading || !siteSettings) {
    return <CatalogPageSkeleton productCount={3} />;
  }

  const { company } = siteSettings;
  const contactMethods = getContactMethods(siteSettings);
  const workingHours = Array.isArray(siteSettings.content?.workingHours)
    ? siteSettings.content.workingHours
    : [];
  const socialLinks = getSocialLinks(siteSettings);

  return (
    <section className={styles.page}>
      <div className={styles.container}>
        {/* ── Page Header ── */}
        <div className={styles.header}>
          <span className={styles.badge}>
            <AppIcon name="headphones" size={15} />
            تواصل معنا
          </span>
          <h1 className={styles.title}>طرق التواصل المباشرة</h1>
          <p className={styles.subtitle}>
            اختر الطريقة الأنسب لك — هاتف، بريد، واتساب، أو زيارة مباشرة.
          </p>
        </div>

        {/* ── Social Media Links ── */}
        {socialLinks.length > 0 ? (
          <div className={styles.socialSection}>
            <div className={styles.socialHeader}>
              <span className={styles.badge}>
                <AppIcon name="share-2" size={15} />
                تابعنا
              </span>
              <h2 className={styles.socialTitle}>قنواتنا الاجتماعية الرسمية</h2>
              <p className={styles.subtitle}>
                تابعنا على جميع المنصات للبقاء على اطلاع بأحدث العروض والمنتجات
              </p>
            </div>

            <div className={styles.socialGrid}>
              {socialLinks.map((item) => {
                const brandColor = SOCIAL_BRAND_COLORS[item.key] || {
                  bg: 'rgba(131, 56, 236, 0.16)',
                  border: 'rgba(131, 56, 236, 0.3)',
                  color: '#cc80ff',
                };

                return (
                  <a
                    key={item.key}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.socialCard}
                    id={`social-link-${item.key}`}
                    title={item.label}
                    style={{
                      '--social-brand-bg': brandColor.bg,
                      '--social-brand-border': brandColor.border,
                      '--social-brand-color': brandColor.color,
                    }}
                  >
                    <span className={styles.socialIconWrap}>
                      <AppIcon name={item.icon} size={28} />
                    </span>
                    <div className={styles.socialCopy}>
                      <strong className={styles.socialLabel}>{item.label}</strong>
                      {item.description ? (
                        <span className={styles.socialDesc}>{item.description}</span>
                      ) : null}
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* ── Contact Methods — Horizontal Grid ── */}
        <div className={styles.methodsGrid}>
          {contactMethods.length > 0 ? (
            contactMethods.map((item) => (
              <a
                key={item.key}
                href={item.href}
                className={styles.methodCard}
                id={`contact-method-${item.key}`}
                target={item.external ? '_blank' : undefined}
                rel={item.external ? 'noopener noreferrer' : undefined}
              >
                <span className={styles.methodIcon}>
                  <AppIcon name={item.icon} size={26} />
                </span>
                <div className={styles.methodCopy}>
                  <strong>{item.label}</strong>
                  <span>{item.value}</span>
                </div>
              </a>
            ))
          ) : (
            <div className={styles.emptyState}>
              <AppIcon name="message-circle" size={32} />
              <h3>لا توجد وسائل تواصل مضافة حالياً</h3>
            </div>
          )}
        </div>

        {/* ── Working Hours + Branch Info ── */}
        <div className={styles.infoRow}>
          {/* Working Hours Card */}
          <div className={styles.infoCard}>
            <div className={styles.infoCardHeader}>
              <span className={styles.infoCardIcon}>
                <AppIcon name="clock" size={20} />
              </span>
              <h2 className={styles.infoCardTitle}>ساعات العمل</h2>
            </div>
            <ul className={styles.hoursList}>
              {workingHours.map((item) => (
                <li key={item.day} className={styles.hoursItem}>
                  <strong>{item.day}</strong>: {item.hours}
                </li>
              ))}
            </ul>
          </div>

          {/* Branch + Actions Card */}
          <div className={styles.infoCard}>
            <div className={styles.infoCardHeader}>
              <span className={styles.infoCardIcon}>
                <AppIcon name="building-2" size={20} />
              </span>
              <h2 className={styles.infoCardTitle}>الفرع والموقع</h2>
            </div>

            <div className={styles.branchInfo}>
              <span className={styles.branchIcon}>
                <AppIcon name="map-pin" size={22} />
              </span>
              <div className={styles.branchCopy}>
                <strong>عنوان الفرع</strong>
                <span>
                  {company?.address ||
                    'سيتم تزويدك بالموقع الدقيق عند التواصل المباشر مع فريقنا.'}
                </span>
              </div>
            </div>

            <div className={styles.actions}>
              <Link to="/services" className="btn btn-primary">
                <AppIcon name="wrench" size={16} />
                احجز صيانة
              </Link>
              <Link to="/services" className="btn btn-secondary">
                <AppIcon name="wrench" size={16} />
                تصفح المنتجات
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
