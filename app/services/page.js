import "../techfix-pages.css";
import "../techfix-services.css";
import Link from "next/link";
import AppIcon from "@/components/AppIcon";
import PageSectionBreadcrumbs from "@/components/PageSectionBreadcrumbs";
import RepairBookingForm from "@/components/RepairBookingForm";
import RepairBookingFaq from "@/components/repair-booking/RepairBookingFaq";
import RepairOrderLookupCard from "@/components/repair-booking/RepairOrderLookupCard";
import StatusPanel from "@/components/StatusPanel";
import { formatCurrency } from "@/lib/formatCurrency";
import { getPageMetadata } from "@/lib/siteMetadata";
import { getSiteSettings } from "@/lib/siteSettings";
import { supabase } from "@/lib/supabaseClient";

/**
 * Builds the metadata for the repair services page.
 *
 * @returns {Promise<import("next").Metadata>}
 */
export async function generateMetadata() {
  return getPageMetadata({
    title: "خدمات الصيانة",
    description: "خدمات الصيانة والحجوزات والتشخيص في صفحة مخصصة وسهلة الإدارة.",
  });
}

export const revalidate = 0;

/**
 * Renders the repair services page with booking, FAQs, and service packages.
 *
 * @returns {Promise<JSX.Element>}
 */
export default async function ServicesPage() {
  const [siteSettings, servicesResult] = await Promise.all([
    getSiteSettings(),
    supabase
      .from("repair_services")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: true }),
  ]);

  if (servicesResult.error) {
    return (
      <section className="section page-top">
        <div className="container">
          <StatusPanel
            tone="error"
            icon="refresh-cw"
            eyebrow="تعذر تحميل خدمات الصيانة"
            title="حدث خطأ أثناء تحميل الخدمات"
            description="تعذر عرض باقات الصيانة حالياً. حاول مرة أخرى بعد قليل أو تواصل معنا مباشرة."
          />
        </div>
      </section>
    );
  }

  const services = (servicesResult.data || []).slice().sort((first, second) => {
    const firstCategory = first.category || "خدمات الصيانة";
    const secondCategory = second.category || "خدمات الصيانة";

    return (
      firstCategory.localeCompare(secondCategory, "ar") ||
      (first.name || "").localeCompare(second.name || "", "ar")
    );
  });
  const faqs = Array.isArray(siteSettings.content?.faqs) ? siteSettings.content.faqs : [];
  const repairBookingSideSteps = [
    "بيانات التواصل",
    "الخدمة المطلوبة",
    "طريقة الاستلام أو التنفيذ",
  ];

  return (
    <>
      <section className="section">
        <div className="container">
          <div className="section-topbar" style={{ marginBottom: "1rem" }}>
            <PageSectionBreadcrumbs />
          </div>

          <div className="repair-layout">
            <div className="repair-primary-column">
              <RepairBookingForm services={services} deliveryMethods={siteSettings.deliveryMethods} />
              
              <div style={{ marginTop: '2rem' }}>
                <div className="section-header" style={{ marginBottom: '1rem' }}>
                  <span className="section-badge">
                    <AppIcon name="shield-check" size={14} />
                    لماذا تختار {siteSettings.company.name}؟
                  </span>
                  <p>خبرة عملية، متابعة واضحة، وقطع موثوقة مع شرح قبل التنفيذ.</p>
                </div>

                <div className="repair-side-note" style={{ marginBottom: '1.5rem' }}>
                  <h3>احجز الصيانة بخطوات واضحة</h3>
                  <p>اكتب رقم التواصل، اختر الخدمة، ثم حدّد هل التنفيذ في المحل أو صيانة عن بعد.</p>
                  <div className="repair-side-note-steps">
                    {repairBookingSideSteps.map((step, index) => (
                      <span key={step} className="repair-side-step">
                        <strong>{index + 1}</strong>
                        <span>{step}</span>
                      </span>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  {siteSettings.serviceFeatures.map((feature) => (
                    <div key={`${feature.icon}-${feature.title}`} className="repair-service-item">
                      <div className="repair-srv-icon">
                        <AppIcon name={feature.icon || "wrench"} size={20} />
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
              {services.map((service) => {
                return (
                  <article key={service.id} className="service-card service-card-pricing">
                    <span className="featured-badge">
                      {service.category || "خدمات الصيانة"}
                    </span>

                    <div className="service-icon">
                      <AppIcon name={service.icon || "wrench"} size={24} />
                    </div>

                    <h3>{service.name}</h3>
                    <p>
                      {service.description ||
                        "خدمة صيانة احترافية متاحة الآن ضمن نظام متابعة واضح وتشخيص قبل التنفيذ."}
                    </p>

                    <div className="techfix-meta" style={{ marginBottom: "1rem" }}>
                      <span>السعر الأساسي: {formatCurrency(service.price)}</span>
                      {service.duration ? <span>{service.duration}</span> : null}
                    </div>

                    <div style={{ marginTop: "auto", paddingTop: "0.5rem" }}>
                      <Link href={`/services/${service.id}`} className="btn btn-primary btn-full service-card-details-link" style={{ justifyContent: "center" }}>
                        عرض التفاصيل والحجز
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
