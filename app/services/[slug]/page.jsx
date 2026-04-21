/**
 * Service Details Page — Client-side version.
 *
 * Fetches a single repair service by slug/id on mount.
 */

'use client';

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Image from 'next/image';
import Link from 'next/link';
import AppIcon from '@/components/AppIcon';
import InternalPageHero from '@/components/InternalPageHero';
import CatalogPageSkeleton from '@/components/CatalogPageSkeleton';
import { formatCurrency } from '@/lib/formatCurrency';
import { usePageSeo } from '@/hooks/usePageSeo';
import { isOptimizableImageSrc } from '@/lib/imageUtils';
import { buildServiceStructuredData } from '@/lib/seo';
import { supabase } from '@/lib/supabaseClient';

/**
 * Generates a simple Arabic slug from text.
 *
 * @param {string} text
 * @returns {string}
 */
function slugifyArabic(text) {
  return (text || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\u0600-\u06FFa-z0-9-_]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Finds an active repair service by slug or id.
 *
 * @param {string} slug
 * @returns {Promise<Record<string, unknown> | null>}
 */
async function findActiveServiceBySlug(slug) {
  const { data, error } = await supabase
    .from('repair_services')
    .select('*')
    .eq('status', 'active');

  if (error) return null;
  return (data || []).find((item) => item.id === slug || slugifyArabic(item.name) === slug) || null;
}

/**
 * Renders the service detail page.
 *
 * @returns {JSX.Element}
 */
export default function ServiceDetailsPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [service, setService] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadService() {
      try {
        const found = await findActiveServiceBySlug(slug);
        if (cancelled) return;

        if (!found) {
          navigate('/not-found', { replace: true });
          return;
        }

        setService(found);
      } catch (error) {
        console.error('ServiceDetailsPage: failed to load', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadService();
    return () => { cancelled = true; };
  }, [slug, navigate]);

  usePageSeo(service ? {
    title: service.name,
    description:
      service.description ||
      `اطلع على خدمة ${service.name} والسعر ومدة التنفيذ وخطوات الحجز لدى TechZone.`,
    image: service.image,
    canonicalPath: `/services/${slug}`,
    breadcrumbItems: [
      { href: '/', label: 'الرئيسية' },
      { href: '/services', label: 'خدمات الصيانة' },
      { label: service.name },
    ],
    breadcrumbLabel: service.name,
    structuredData: [
      buildServiceStructuredData({
        pathname: `/services/${slug}`,
        service,
      }),
    ],
  } : null);

  if (loading) return <CatalogPageSkeleton productCount={3} />;
  if (!service) return null;

  return (
    <>
      <InternalPageHero
        currentPath={`/services/${slug}`}
        items={[
          { href: '/', label: 'الرئيسية' },
          { href: '/services', label: 'خدمات الصيانة' },
          { label: service.name },
        ]}
        badgeIcon="wrench"
        badgeLabel="تفاصيل خدمة الصيانة"
        title={service.name}
        description={service.description || 'خدمة صيانة احترافية مع واجهة أوضح للحجز.'}
        stats={[
          { label: 'السعر الابتدائي', value: formatCurrency(service.price), tone: 'success' },
          { label: 'المدة', value: service.duration || 'حسب الحالة' },
          { label: 'الحجز', value: 'متاح الآن', tone: 'accent' },
        ]}
      />

      <section className="section" style={{ paddingTop: 0, paddingBottom: '4rem' }}>
        <div className="container detail-layout">
          <div className="detail-stack">
            <div className="surface-card detail-media-card">
              <div className="detail-media-frame">
                {service.image ? (
                  <Image
                    src={service.image}
                    alt={service.name}
                    width={1080}
                    height={1080}
                    loading="lazy"
                    quality={80}
                    sizes="(max-width: 900px) 100vw, 540px"
                    unoptimized={!isOptimizableImageSrc(service.image)}
                  />
                ) : (
                  <div className="detail-media-placeholder">
                    <AppIcon name={service.icon || 'wrench'} size={46} />
                  </div>
                )}
              </div>
            </div>

            <div className="detail-subgrid">
              <div className="detail-subcard">
                <strong>التصنيف</strong>
                <span>{service.category || 'خدمات الصيانة'}</span>
              </div>
              <div className="detail-subcard">
                <strong>مدة التنفيذ</strong>
                <span>{service.duration || 'تحدد بعد التشخيص'}</span>
              </div>
              <div className="detail-subcard">
                <strong>طريقة الطلب</strong>
                <span>حجز مباشر أو تواصل واتساب</span>
              </div>
            </div>
          </div>

          <div className="detail-stack">
            <div className="surface-card detail-content-card">
              <div className="detail-kicker">{service.category || 'خدمات الصيانة'}</div>
              <div className="detail-price-row">
                <div className="detail-price">{formatCurrency(service.price)}</div>
              </div>
              <p>{service.description || 'خدمة صيانة احترافية متاحة لدينا.'}</p>

              <div className="detail-meta-grid">
                <div className="detail-meta-card"><strong>نوع الخدمة</strong><span>صيانة احترافية</span></div>
                <div className="detail-meta-card"><strong>الحجز</strong><span>متاح الآن</span></div>
                <div className="detail-meta-card"><strong>التصنيف</strong><span>{service.category || 'خدمات الصيانة'}</span></div>
                <div className="detail-meta-card"><strong>مدة التنفيذ</strong><span>{service.duration || 'حسب الحالة'}</span></div>
              </div>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <Link href="/services" className="btn btn-outline">العودة إلى خدمات الصيانة</Link>
                <a
                  href={`https://wa.me/962771234567?text=${encodeURIComponent(`مرحباً، أريد طلب خدمة: ${service.name}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary"
                >
                  <AppIcon name="message-circle" size={16} />
                  طلب عبر واتساب
                </a>
              </div>
            </div>

            <div className="detail-side-card">
              <h2>كيف تسير الخدمة؟</h2>
              <div className="detail-note-list">
                <div className="detail-note-item">
                  <span className="detail-note-icon"><AppIcon name="refresh-cw" size={18} /></span>
                  <div>
                    <strong>تشخيص واضح</strong>
                    <span>يبدأ المسار بفهم الحالة وتحديد نوع الخدمة المناسبة.</span>
                  </div>
                </div>
                <div className="detail-note-item">
                  <span className="detail-note-icon"><AppIcon name="shield-check" size={18} /></span>
                  <div>
                    <strong>متابعة أكثر طمأنينة</strong>
                    <span>تم إعادة توزيع الصفحة لتشرح ما سيحصل بعد الحجز.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
