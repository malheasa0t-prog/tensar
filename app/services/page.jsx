/**
 * Services Page - Client-side version.
 *
 * Fetches repair services and site settings on mount,
 * then renders the booking form, FAQs, and service packages.
 */

'use client';

import { useState, useEffect } from 'react';
import '@/app/techfix-pages.css';
import '@/app/techfix-services.css';
import Image from 'next/image';
import Link from 'next/link';
import AppIcon from '@/components/AppIcon';
import PageSectionBreadcrumbs from '@/components/PageSectionBreadcrumbs';
import RepairBookingForm from '@/components/RepairBookingForm';
import RepairBookingFaq from '@/components/repair-booking/RepairBookingFaq';
import RepairOrderLookupCard from '@/components/repair-booking/RepairOrderLookupCard';
import StatusPanel from '@/components/StatusPanel';
import CatalogPageSkeleton from '@/components/CatalogPageSkeleton';
import { formatCurrency } from '@/lib/formatCurrency';
import { isOptimizableImageSrc } from '@/lib/imageUtils';
import { getSiteSettings } from '@/lib/siteSettings';
import { supabase } from '@/lib/supabaseClient';

const REPAIR_BOOKING_STEPS = [
  'بيانات التواصل',
  'الخدمة المطلوبة',
  'طريقة الاستلام أو التنفيذ',
];

/**
 * Renders the repair services page.
 *
 * @returns {JSX.Element}
 */
export default function ServicesPage() {
  const [services, setServices] = useState([]);
  const [siteSettings, setSiteSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        const [settings, servicesResult] = await Promise.all([
          getSiteSettings(),
          supabase
            .from('repair_services')
            .select('*')
            .eq('status', 'active')
            .order('created_at', { ascending: true }),
        ]);

        if (cancelled) return;

        if (servicesResult.error) {
          setError(true);
          return;
        }

        setSiteSettings(settings);

        const sorted = (servicesResult.data || []).slice().sort((a, b) => {
          const catA = a.category || 'خدمات الصيانة';
          const catB = b.category || 'خدمات الصيانة';
          return catA.localeCompare(catB, 'ar') || (a.name || '').localeCompare(b.name || '', 'ar');
        });

        setServices(sorted);
      } catch (err) {
        console.error('[SVG-500] ServicesPage: failed to load', err);
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <CatalogPageSkeleton productCount={6} />;
  }

  if (error) {
    return (
      <section className="section page-top">
        <div className="container">
          <StatusPanel
            tone="error"
            icon="refresh-cw"
            eyebrow="تعذر تحميل خدمات الصيانة"
            title="حدث خطأ أثناء تحميل الخدمات"
            description="[SVG-500] تعذر عرض باقات الصيانة حالياً. حاول مرة أخرى بعد قليل أو تواصل معنا مباشرة."
          />
        </div>
      </section>
    );
  }

  const faqs = Array.isArray(siteSettings?.content?.faqs) ? siteSettings.content.faqs : [];

  return (
    <>
      <section className="section">
        <div className="container">
          <div className="section-topbar" style={{ marginBottom: '1rem' }}>
            <PageSectionBreadcrumbs />
          </div>

          <div className="repair-layout">
            <div className="repair-primary-column">
              <RepairBookingForm services={services} deliveryMethods={siteSettings?.deliveryMethods} />

              <div style={{ marginTop: '2rem' }}>
                <div className="section-header" style={{ marginBottom: '1rem' }}>
                  <span className="section-badge">
                    <AppIcon name="shield-check" size={14} />
                    لماذا تختار {siteSettings?.company?.name || 'TechZone'}؟
                  </span>
                  <p>خبرة عملية، متابعة واضحة، وقطع موثوقة مع شرح قبل التنفيذ.</p>
                </div>

                <div className="repair-side-note" style={{ marginBottom: '1.5rem' }}>
                  <h3>احجز الصيانة بخطوات واضحة</h3>
                  <p>اكتب رقم التواصل، اختر الخدمة، ثم حدّد هل التنفيذ في المحل أو صيانة عن بعد.</p>
                  <div className="repair-side-note-steps">
                    {REPAIR_BOOKING_STEPS.map((step, index) => (
                      <span key={step} className="repair-side-step">
                        <strong>{index + 1}</strong>
                        <span>{step}</span>
                      </span>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  {(siteSettings?.serviceFeatures || []).map((feature) => (
                    <div key={`${feature.icon}-${feature.title}`} className="repair-service-item">
                      <div className="repair-srv-icon">
                        <AppIcon name={feature.icon || 'wrench'} size={20} />
                      </div>
                      <div className="repair-srv-body">
                        <strong>{feature.title}</strong>
                        <div className="repair-srv-meta">
                          <span>{feature.subtitle}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="repair-services-list">
              <RepairBookingFaq items={faqs} />
              <RepairOrderLookupCard />
            </div>
          </div>
        </div>
      </section>

      <section className="section alt">
        <div className="container">
          <div className="section-header">
            <span className="section-badge">
              <AppIcon name="settings" size={14} />
              باقات الصيانة
            </span>
            <h2>الخدمات المتاحة حالياً</h2>
            <p>اختر الخطة المناسبة لكل خدمة، ثم انتقل إلى التفاصيل أو الحجز المباشر بخطوة واحدة.</p>
          </div>

          {services.length === 0 ? (
            <StatusPanel
              icon="wrench"
              eyebrow="لا توجد خدمات متاحة"
              title="سنضيف الخدمات هنا تلقائياً عند توفرها"
              description="حالما يتم تفعيل خدمات جديدة ستظهر تلقائياً داخل هذه الصفحة."
            />
          ) : (
            <div className="techfix-service-grid techfix-service-grid--pricing">
              {services.map((service) => (
                <article key={service.id} className="service-card service-card-pricing">
                  <span className="featured-badge">
                    {service.category || 'خدمات الصيانة'}
                  </span>
                  {service.image ? (
                    <div className="service-card-media">
                      <div className="service-card-media-fallback" aria-hidden="true">
                        <AppIcon name={service.icon || 'wrench'} size={24} />
                      </div>
                      <Image
                        src={service.image}
                        alt={service.name}
                        width={960}
                        height={640}
                        className="service-card-media-image"
                        sizes="(max-width: 900px) 100vw, 480px"
                        loading="lazy"
                        unoptimized={!isOptimizableImageSrc(service.image)}
                        onError={(event) => {
                          event.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                  ) : (
                    <div className="service-icon">
                      <AppIcon name={service.icon || 'wrench'} size={24} />
                    </div>
                  )}
                  <h3>{service.name}</h3>
                  <p>
                    {service.description ||
                      'خدمة صيانة احترافية متاحة الآن ضمن نظام متابعة واضح وتشخيص قبل التنفيذ.'}
                  </p>
                  <div className="techfix-meta" style={{ marginBottom: '1rem' }}>
                    <span>السعر الأساسي: {formatCurrency(service.price)}</span>
                    {service.duration ? <span>{service.duration}</span> : null}
                  </div>
                  <div style={{ marginTop: 'auto', paddingTop: '0.5rem' }}>
                    <Link
                      href={`/services/${service.id}`}
                      className="btn btn-primary btn-full service-card-details-link"
                      style={{ justifyContent: 'center' }}
                    >
                      عرض التفاصيل والحجز
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
