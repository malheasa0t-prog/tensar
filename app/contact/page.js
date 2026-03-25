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
    description: "جميع وسائل التواصل والروابط المباشرة في صفحة واحدة.",
  });
}

export default async function ContactPage() {
  const siteSettings = await getSiteSettings();
  const { company } = siteSettings;
  const contactMethods = getContactMethods(siteSettings);
  const socialLinks = getSocialLinks(siteSettings);

  return (
    <>
      <section className="section contact-page-hero">
        <div className="container">
          <div className="contact-page-shell surface-panel">
            <div className="contact-page-grid">
              <div className="contact-page-copy">
                <span className="section-badge">
                  <AppIcon name="headphones" size={14} />
                  تواصل معنا
                </span>

                <h1>
                  كل وسائل التواصل مع <span className="gradient-text">{company.name}</span> في صفحة واحدة
                </h1>

                <p>
                  {company.slogan ||
                    "نوفر لك وسائل تواصل واضحة وسريعة حتى تصل إلى فريق المتجر بسهولة من أي مكان."}
                </p>

                <div className="contact-page-badges">
                  <span className="contact-page-badge">
                    <AppIcon name="phone" size={14} />
                    اتصال مباشر
                  </span>
                  <span className="contact-page-badge">
                    <AppIcon name="message" size={14} />
                    قنوات اجتماعية محدثة
                  </span>
                  <span className="contact-page-badge">
                    <AppIcon name="mail" size={14} />
                    رد سريع من الفريق
                  </span>
                </div>

                <div className="contact-page-actions">
                  <Link href="/products" className="btn btn-solid btn-lg">
                    <AppIcon name="shopping-bag" size={18} />
                    تصفح المنتجات
                  </Link>

                  <Link href="/services" className="btn btn-outline btn-lg">
                    <AppIcon name="wrench" size={18} />
                    خدمات الصيانة
                  </Link>
                </div>
              </div>

              <div className="contact-page-panel">
                <div className="contact-page-panel-head">
                  <h2>معلومات التواصل المباشر</h2>
                  <p>يمكنك الوصول إلينا عبر الهاتف أو البريد أو الواتساب أو العنوان.</p>
                </div>

                <div className="contact-methods-grid">
                  {contactMethods.map((item) => (
                    <a
                      key={item.key}
                      href={item.href}
                      className="contact-method-card"
                      target={item.external ? "_blank" : undefined}
                      rel={item.external ? "noopener noreferrer" : undefined}
                    >
                      <span className="contact-method-card-icon">
                        <AppIcon name={item.icon} size={18} />
                      </span>
                      <div className="contact-method-card-copy">
                        <strong>{item.label}</strong>
                        <span>{item.value}</span>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="contact-social-panel surface-panel">
            <div className="section-head" style={{ marginBottom: "1rem" }}>
              <div>
                <span className="section-badge">
                  <AppIcon name="message" size={14} />
                  تابعنا
                </span>
                <h2>قنوات التواصل الاجتماعية</h2>
                <p>تظهر هذه القنوات الآن من الإعدادات مباشرة، ويمكن تحديثها دون تعديل في الواجهة.</p>
              </div>
            </div>

            {socialLinks.length > 0 ? (
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
                      <AppIcon name={item.icon} size={20} />
                    </span>
                    <div>
                      <h3>{item.label}</h3>
                      <p>{item.description}</p>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <AppIcon name="message" size={28} />
                </div>
                لا توجد قنوات اجتماعية مضافة حاليًا.
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
