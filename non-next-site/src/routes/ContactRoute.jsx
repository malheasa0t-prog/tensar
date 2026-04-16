import Link from "next/link";
import AppIcon from "@/components/AppIcon";
import { useAsyncPageData } from "../hooks/useAsyncPageData.js";
import { loadContactPageSnapshot } from "../data/publicPageData.js";

const EMPTY_CONTACT_DATA = {
  contactMethods: [],
  siteSettings: {
    company: {},
    content: { workingHours: [] }
  },
  socialLinks: [],
  workingHours: []
};

/**
 * Renders the public contact page using the client-side data snapshot.
 *
 * @returns {JSX.Element}
 */
export default function ContactRoute() {
  const { data } = useAsyncPageData(loadContactPageSnapshot, [], EMPTY_CONTACT_DATA);
  const companyAddress =
    data.siteSettings?.company?.address ||
    "سيتم تزويدك بالموقع الدقيق عند التواصل المباشر مع فريقنا.";

  return (
    <>
      <section className="section">
        <div className="container">
          <div className="techfix-contact-grid">
            <div>
              <div className="section-header">
                <span className="section-badge">
                  <AppIcon name="phone" size={14} />
                  وسائل التواصل
                </span>
                <h2>طرق مباشرة للوصول إلينا</h2>
                <p>الهاتف، البريد، واتساب، أو زيارة الفرع عند الحاجة.</p>
              </div>

              <div className="contact-social-grid">
                {data.contactMethods.length > 0 ? (
                  data.contactMethods.map((item) => (
                    <a
                      key={item.key}
                      href={item.href}
                      className="contact-detail-card"
                      target={item.external ? "_blank" : undefined}
                      rel={item.external ? "noopener noreferrer" : undefined}
                    >
                      <span className="contact-detail-icon">
                        <AppIcon name={item.icon} size={18} />
                      </span>

                      <div>
                        <h3>{item.label}</h3>
                        <p>{item.value}</p>
                      </div>
                    </a>
                  ))
                ) : (
                  <div className="techfix-empty">
                    <AppIcon name="message" size={28} />
                    <h3>لا توجد وسائل تواصل مضافة حاليًا</h3>
                  </div>
                )}
              </div>
            </div>

            <aside className="contact-hours-card">
              <span className="section-badge">
                <AppIcon name="clock" size={14} />
                ساعات العمل
              </span>
              <ul className="techfix-list">
                {data.workingHours.map((item) => (
                  <li key={item.day}>
                    <strong>{item.day}</strong>: {item.hours}
                  </li>
                ))}
              </ul>

              <div className="contact-page-note">
                <span className="contact-detail-icon">
                  <AppIcon name="map-pin" size={18} />
                </span>
                <div>
                  <h3>عنوان الفرع</h3>
                  <p>{companyAddress}</p>
                </div>
              </div>

              <div className="contact-page-actions">
                <Link href="/services" className="btn btn-primary">
                  احجز صيانة
                </Link>
                <Link href="/products" className="btn btn-secondary">
                  تصفح المنتجات
                </Link>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {data.socialLinks.length > 0 ? (
        <section className="section alt">
          <div className="container">
            <div className="section-header">
              <span className="section-badge">
                <AppIcon name="message" size={14} />
                تابعنا
              </span>
              <h2>قنواتنا الاجتماعية الرسمية</h2>
            </div>

            <div className="contact-social-grid">
              {data.socialLinks.map((item) => (
                <a
                  key={item.key}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="contact-social-card"
                >
                  <span className="contact-social-icon">
                    <AppIcon name={item.icon} size={18} />
                  </span>
                  <div>
                    <h3>{item.label}</h3>
                    <p>{item.description}</p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
