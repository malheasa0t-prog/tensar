import "../techfix-pages.css";
import Link from "next/link";
import AppIcon from "@/components/AppIcon";
import {
  getContactMethods,
  getSocialLinks,
} from "@/lib/contactChannels";
import { getPageMetadata } from "@/lib/siteMetadata";
import { getSiteSettings } from "@/lib/siteSettings";

export const revalidate = 60;

export async function generateMetadata() {
  return getPageMetadata({
    title: "تواصل معنا",
    description: "طرق التواصل المباشرة مع المتجر في صفحة بسيطة وواضحة.",
  });
}

export default async function ContactPage() {
  const siteSettings = await getSiteSettings();
  const { company } = siteSettings;
  const contactMethods = getContactMethods(siteSettings);
  const workingHours = siteSettings.content?.workingHours || [];
  const socialLinks = getSocialLinks(siteSettings);

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
                {contactMethods.length > 0 ? (
                  contactMethods.map((item) => (
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
                    <h3>لا توجد وسائل تواصل مضافة حالياً</h3>
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
                {workingHours.map((item) => (
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
                  <p>{company?.address || "سيتم تزويدك بالموقع الدقيق عند التواصل المباشر مع فريقنا."}</p>
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

      {socialLinks.length > 0 ? (
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
              {socialLinks.map((item) => (
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
