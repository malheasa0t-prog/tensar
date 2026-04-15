import Link from "next/link";
import AppIcon from "@/components/AppIcon";
import PageSectionBreadcrumbs from "@/components/PageSectionBreadcrumbs";
import RepairBookingFaq from "@/components/repair-booking/RepairBookingFaq";
import RepairBookingForm from "@/components/RepairBookingForm";
import RepairOrderLookupCard from "@/components/repair-booking/RepairOrderLookupCard";
import StatusPanel from "@/components/StatusPanel";
import { useAsyncPageData } from "../hooks/useAsyncPageData.js";
import { formatCurrency, loadServicesPageSnapshot } from "../data/publicPageData.js";

const EMPTY_SERVICES_DATA = {
  services: [],
  siteSettings: {
    company: { name: "TechZone" },
    content: { faqs: [] },
    deliveryMethods: [],
    serviceFeatures: []
  }
};

/**
 * Renders the services page in the non-Next copy.
 *
 * @returns {JSX.Element}
 */
export default function ServicesRoute() {
  const { data, error } = useAsyncPageData(loadServicesPageSnapshot, [], EMPTY_SERVICES_DATA);
  const faqs = Array.isArray(data.siteSettings.content?.faqs) ? data.siteSettings.content.faqs : [];

  if (error) {
    return (
      <section className="section page-top">
        <div className="container">
          <StatusPanel
            tone="error"
            icon="refresh-cw"
            eyebrow="تعذر تحميل خدمات الصيانة"
            title="حدث خطأ أثناء تحميل الخدمات"
            description="تعذر عرض باقات الصيانة حاليًا."
          />
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="section">
        <div className="container">
          <div className="section-topbar" style={{ marginBottom: "1rem" }}>
            <PageSectionBreadcrumbs />
          </div>
          <div className="repair-layout">
            <div className="repair-primary-column">
              <RepairBookingForm
                services={data.services}
                deliveryMethods={data.siteSettings.deliveryMethods}
              />
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
            <h2>الخدمات المتاحة حاليًا</h2>
          </div>

          {data.services.length === 0 ? (
            <StatusPanel
              icon="wrench"
              eyebrow="لا توجد خدمات متاحة"
              title="ستظهر الخدمات هنا تلقائيًا عند توفرها"
              description="حالما يتم تفعيل خدمات جديدة ستظهر تلقائيًا داخل هذه الصفحة."
            />
          ) : (
            <div className="techfix-service-grid techfix-service-grid--pricing">
              {data.services.map((service) => (
                <article key={service.id} className="service-card service-card-pricing">
                  <span className="featured-badge">
                    {service.category || "خدمات الصيانة"}
                  </span>
                  <div className="service-icon">
                    <AppIcon name={service.icon || "wrench"} size={24} />
                  </div>
                  <h3>{service.name}</h3>
                  <p>{service.description || "خدمة صيانة احترافية متاحة الآن."}</p>
                  <div className="techfix-meta" style={{ marginBottom: "1rem" }}>
                    <span>السعر الأساسي: {formatCurrency(service.price)}</span>
                    {service.duration ? <span>{service.duration}</span> : null}
                  </div>
                  <Link
                    href={`/services/${service.id}`}
                    className="btn btn-primary btn-full service-card-details-link"
                  >
                    عرض التفاصيل والحجز
                  </Link>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
