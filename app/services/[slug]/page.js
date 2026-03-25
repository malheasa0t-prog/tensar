import Link from "next/link";
import { notFound } from "next/navigation";
import AppIcon from "@/components/AppIcon";
import InternalPageHero from "@/components/InternalPageHero";
import { supabase } from "@/lib/supabaseClient";

export const revalidate = 0;

function slugifyArabic(text) {
  return (text || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\u0600-\u06FFa-z0-9-_]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export default async function ServiceDetailsPage({ params }) {
  const { slug } = await params;

  const { data: allServices, error: serviceError } = await supabase
    .from("repair_services")
    .select("*")
    .eq("status", "active");

  const service = (allServices || []).find(
    (item) => item.id === slug || slugifyArabic(item.name) === slug
  );

  if (serviceError || !service) {
    notFound();
  }

  return (
    <>
      <InternalPageHero
        items={[
          { href: "/", label: "الرئيسية" },
          { href: "/services", label: "خدمات الصيانة" },
          { label: service.name },
        ]}
        badgeIcon="wrench"
        badgeLabel="تفاصيل خدمة الصيانة"
        title={service.name}
        description={
          service.description ||
          "خدمة صيانة احترافية مع واجهة أوضح للحجز، معرفة السعر، وفهم مدة التنفيذ قبل اتخاذ القرار."
        }
        stats={[
          { label: "السعر الابتدائي", value: `${Number(service.price || 0).toFixed(2)} د.أ`, tone: "success" },
          { label: "المدة", value: service.duration || "حسب الحالة" },
          { label: "الحجز", value: "متاح الآن", tone: "accent" },
        ]}
        summary={
          <div className="hero-summary-card">
            <div className="hero-summary-list">
              <div className="hero-summary-item">
                <span className="hero-summary-icon">
                  <AppIcon name="clock" size={18} />
                </span>
                <div>
                  <strong>معلومة قبل الحجز</strong>
                  <span>تظهر المدة والسعر وطبيعة الخدمة في أعلى الصفحة بدل ترك المستخدم يبحث عنها داخل المحتوى.</span>
                </div>
              </div>

              <div className="hero-summary-item">
                <span className="hero-summary-icon">
                  <AppIcon name="message-circle" size={18} />
                </span>
                <div>
                  <strong>قناة طلب مباشرة</strong>
                  <span>يمكن للمستخدم الانتقال مباشرة إلى واتساب أو الرجوع لقائمة الخدمات دون فقدان السياق.</span>
                </div>
              </div>
            </div>
          </div>
        }
      />

      <section className="section" style={{ paddingTop: 0, paddingBottom: "4rem" }}>
        <div className="container detail-layout">
          <div className="detail-stack">
            <div className="surface-card detail-media-card">
              <div className="detail-media-frame">
                {service.image ? (
                  <img src={service.image} alt={service.name} />
                ) : (
                  <div className="detail-media-placeholder">
                    <AppIcon name={service.icon || "wrench"} size={46} />
                  </div>
                )}
              </div>
            </div>

            <div className="detail-subgrid">
              <div className="detail-subcard">
                <strong>التصنيف</strong>
                <span>{service.category || "خدمات الصيانة"}</span>
              </div>
              <div className="detail-subcard">
                <strong>مدة التنفيذ</strong>
                <span>{service.duration || "تحدد بعد التشخيص"}</span>
              </div>
              <div className="detail-subcard">
                <strong>طريقة الطلب</strong>
                <span>حجز مباشر أو تواصل واتساب</span>
              </div>
            </div>
          </div>

          <div className="detail-stack">
            <div className="surface-card detail-content-card">
              <div className="detail-kicker">{service.category || "خدمات الصيانة"}</div>

              <div className="detail-price-row">
                <div className="detail-price">
                  {Number(service.price || 0).toFixed(2)} <span>د.أ</span>
                </div>
              </div>

              <p>
                {service.description ||
                  "خدمة صيانة احترافية متاحة لدينا مع شرح أوضح للخطوات والمخرجات وطريقة الحجز."}
              </p>

              <div className="detail-meta-grid">
                <div className="detail-meta-card">
                  <strong>نوع الخدمة</strong>
                  <span>صيانة احترافية</span>
                </div>
                <div className="detail-meta-card">
                  <strong>الحجز</strong>
                  <span>متاح الآن</span>
                </div>
                <div className="detail-meta-card">
                  <strong>التصنيف</strong>
                  <span>{service.category || "خدمات الصيانة"}</span>
                </div>
                <div className="detail-meta-card">
                  <strong>مدة التنفيذ</strong>
                  <span>{service.duration || "حسب الحالة"}</span>
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <Link href="/services" className="btn btn-outline">
                  العودة إلى خدمات الصيانة
                </Link>

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
                  <span className="detail-note-icon">
                    <AppIcon name="refresh-cw" size={18} />
                  </span>
                  <div>
                    <strong>تشخيص واضح</strong>
                    <span>يبدأ المسار بفهم الحالة وتحديد نوع الخدمة المناسبة قبل تنفيذ الصيانة أو طلب القطع.</span>
                  </div>
                </div>

                <div className="detail-note-item">
                  <span className="detail-note-icon">
                    <AppIcon name="shield-check" size={18} />
                  </span>
                  <div>
                    <strong>متابعة أكثر طمأنينة</strong>
                    <span>تمت إعادة توزيع الصفحة لتشرح للمستخدم ما سيحصل بعد الحجز بدل تركه أمام شاشة مقتضبة جدًا.</span>
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
