import Link from "next/link";
import Breadcrumbs from "@/components/Breadcrumbs";
import AppIcon from "@/components/AppIcon";
import RepairBookingForm from "@/components/RepairBookingForm";
import { getPageMetadata } from "@/lib/siteMetadata";
import { getSiteSettings } from "@/lib/siteSettings";
import { supabase } from "@/lib/supabaseClient";

export async function generateMetadata() {
  return getPageMetadata({
    title: "خدمات الصيانة",
    description: "خدمات الصيانة والحجوزات والتشخيص في صفحة مخصصة وسهلة الإدارة.",
  });
}

export const revalidate = 60;

export default async function ServicesPage() {
  const siteSettings = await getSiteSettings();
  const serviceFeatures = siteSettings.serviceFeatures;

  const { data: servicesData, error: servicesError } = await supabase
    .from("repair_services")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (servicesError) {
    return (
      <div className="container" style={{ padding: "5rem 0", textAlign: "center" }}>
        حدث خطأ أثناء تحميل خدمات الصيانة.
      </div>
    );
  }

  const services = (servicesData || []).slice().sort((first, second) => {
    const firstCategory = first.category || "خدمات الصيانة";
    const secondCategory = second.category || "خدمات الصيانة";

    return (
      firstCategory.localeCompare(secondCategory, "ar") ||
      (first.name || "").localeCompare(second.name || "", "ar")
    );
  });

  return (
    <>
      <section className="page-hero" style={{ paddingBottom: "2rem" }}>
        <div className="container">
          <div className="section-topbar">
            <Breadcrumbs
              items={[
                { href: "/", label: "الرئيسية" },
                { label: "خدمات الصيانة" },
              ]}
            />
            <span className="section-badge">
              <AppIcon name="wrench" size={14} />
              خدمات الصيانة
            </span>
          </div>

          <h1>
            خدمات <span className="gradient-text">الصيانة</span>
          </h1>
          <p>صفحة مخصصة للصيانة والحجوزات، منفصلة بصريًا ووظيفيًا عن مسار التسوق.</p>
        </div>
      </section>

      <section className="section" style={{ paddingTop: "1.5rem", paddingBottom: "2rem" }}>
        <div className="container">
          <div className="repair-layout">
            <RepairBookingForm
              services={services}
              deliveryMethods={siteSettings.deliveryMethods}
            />

            <div className="repair-services-list surface-panel category-section-card">
              <h3>لماذا تختار صيانة {siteSettings.company.name}؟</h3>
              <p style={{ marginBottom: "1rem", color: "var(--text-muted)" }}>
                خبرة عملية، قطع أصلية، ومتابعة واضحة لكل طلب حتى التسليم.
              </p>

              {serviceFeatures.map((feature) => (
                <div key={`${feature.icon}-${feature.title}`} className="repair-service-item selected">
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
      </section>

      <section className="section" style={{ paddingTop: "3rem", paddingBottom: "4rem" }}>
        <div className="container" style={{ display: "grid", gap: "2rem" }}>
          {services.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <AppIcon name="wrench" size={28} />
              </div>
              لا توجد خدمات صيانة متاحة حاليًا.
            </div>
          ) : (
            <div className="surface-panel category-section-card">
              <div
                style={{
                  padding: "0 0 1rem",
                  borderBottom: "1px solid var(--border)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "1rem",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "grid", gap: "0.35rem" }}>
                  <h2 style={{ margin: 0, fontSize: "1.25rem" }}>كل خدمات الصيانة</h2>
                  <p style={{ margin: 0, color: "var(--text-muted)" }}>
                    رتبنا الخدمات داخل شبكة واحدة مع إظهار التصنيف على كل بطاقة بدل تقسيمها إلى أقسام منفصلة.
                  </p>
                </div>
                <span style={{ color: "var(--text-muted)", fontSize: "0.88rem" }}>
                  عدد الخدمات: {services.length}
                </span>
              </div>

              <div style={{ paddingTop: "1rem" }}>
                <div className="services-grid long">
                  {services.map((service) => (
                    <article key={service.id} className="service-card featured">
                      <span className="featured-badge">{service.category || "خدمات الصيانة"}</span>
                      <div className="service-icon-wrap">
                        <div className="service-icon">
                          <AppIcon name={service.icon || "wrench"} size={24} />
                        </div>
                      </div>
                      <h3>{service.name}</h3>
                      <p>{service.description || "خدمة صيانة احترافية متاحة الآن."}</p>
                      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginTop: "0.3rem" }}>
                        <span className="service-eta">
                          ابتداءً من {Number(service.price || 0).toFixed(2)} د.أ
                        </span>
                        {service.duration ? <span className="service-eta">{service.duration}</span> : null}
                      </div>
                      <div style={{ marginTop: "0.9rem", display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                        <Link href={`/services/${service.id}`} className="btn btn-outline btn-sm">
                          التفاصيل
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
