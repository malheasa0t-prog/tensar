import Image from "next/image";
import Link from "next/link";
import AppIcon from "@/components/AppIcon";
import CounterStats from "@/components/CounterStats";
import HomeNotificationBell from "@/components/HomeNotificationBell";
import {
  getSocialLinks,
  getWhatsappSupportLink,
} from "@/lib/contactChannels";
import { getSiteSettings } from "@/lib/siteSettings";
import { supabase } from "@/lib/supabaseClient";
import { isOptimizableImageSrc } from "@/lib/imageUtils";

export const revalidate = 60;

export default async function HomePage() {
  let { data: categoriesData, error: categoriesError } = await supabase
    .from("categories")
    .select("*")
    .eq("status", "active")
    .order("sort_order", { ascending: true });

  if (categoriesError) {
    const fallback = await supabase.from("categories").select("*").order("name", { ascending: true });
    categoriesData = fallback.data || [];
  }

  const allCategories = categoriesData || [];
  const categoryIdSet = new Set(allCategories.map((category) => category.id));
  const mainCategories = allCategories
    .filter((category) => !category.parent_id || !categoryIdSet.has(category.parent_id))
    .sort((first, second) => Number(first.sort_order || 0) - Number(second.sort_order || 0));
  const visibleMainCategories = mainCategories.length > 0 ? mainCategories : allCategories;
  const heroMainCategories = visibleMainCategories.slice(0, 4);

  const siteSettings = await getSiteSettings();
  const { hero, trustBar } = siteSettings;
  const socialLinks = getSocialLinks(siteSettings);
  const whatsappSupportLink = getWhatsappSupportLink(siteSettings);

  return (
    <>
      <section className="hero" id="home">
        <div className="hero-orb hero-orb-1" />
        <div className="hero-orb hero-orb-2" />
        <div className="hero-orb hero-orb-3" />
        <div className="hero-grid-pattern" />

        <div className="container">
          <div className="hero-content-grid hero-content-grid-categories">
            <div className="hero-text-col">
              <div className="hero-trust-badge">
                <span className="trust-dot" />
                {hero.trustBadge}
              </div>

              <h1>
                {hero.title}
                <br />
                <span className="gradient-text">{hero.titleHighlight}</span>
              </h1>

              <p className="hero-copy">{hero.description}</p>

              <div className="hero-actions">
                <Link href="/products" className="btn btn-solid btn-lg">
                  <AppIcon name="shopping-bag" size={18} />
                  تسوق الآن
                </Link>

                <Link href="/services" className="btn btn-secondary btn-lg">
                  <AppIcon name="wrench" size={18} />
                  خدمات الصيانة
                </Link>
              </div>

              <HomeNotificationBell />

              {heroMainCategories.length > 0 ? (
                <div className="hero-main-cards-shell" aria-label="الفئات الرئيسية">
                  <div className="hero-main-cards-head">
                    <div>
                      <h3>الفئات الرئيسية</h3>
                    </div>
                  </div>

                  <div className="hero-main-cards-grid">
                    {heroMainCategories.map((category) => (
                      <Link
                        key={category.id}
                        href={`/category/${category.slug || category.id}`}
                        className="hero-main-card"
                      >
                        <div className="hero-main-card-body">
                          <div className={`hero-main-card-icon-wrap${category.image ? " has-image" : ""}`}>
                            {category.image ? (
                              <Image
                                src={category.image}
                                alt={category.name}
                                className="hero-main-card-image"
                                width={88}
                                height={88}
                                unoptimized={!isOptimizableImageSrc(category.image)}
                              />
                            ) : (
                              <AppIcon
                                name={category.icon || category.name || "folder"}
                                className="hero-main-card-icon"
                                size={38}
                              />
                            )}
                          </div>

                          <div className="hero-main-card-copy">
                            <h4>{category.name}</h4>
                            <p>
                              {category.description ||
                                "استكشف منتجات وخدمات هذه الفئة عبر صفحة مرتبة وواضحة."}
                            </p>
                          </div>
                        </div>

                        <div className="hero-main-card-footer">
                          <span className="hero-main-card-cta">
                            ادخل الآن
                            <AppIcon name="arrow-left" size={14} />
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="trust-bar">
        <div className="container">
          <div className="trust-items">
            {trustBar.map((item) => (
              <div key={`${item.icon}-${item.title}`} className="trust-item">
                <span className="trust-icon">
                  <AppIcon name={item.icon || "shield-check"} size={18} />
                </span>
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.subtitle}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: "2rem", paddingBottom: "0" }}>
        <div className="container">
          <CounterStats />
        </div>
      </section>

      <section className="section alt" id="contact">
        <div className="container">
          <div className="section-header">
            <span className="section-badge">
              <AppIcon name="message" size={14} />
              تواصل معنا
            </span>
            <h2>
              تابعنا على <span className="gradient-text">قنوات التواصل</span>
            </h2>
            <p>يمكن تعديل الروابط مباشرة من لوحة التحكم عند الحاجة.</p>
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
              لا توجد روابط تواصل مضافة حاليًا.
            </div>
          )}

          <div className="contact-page-note">
            <AppIcon name="message" size={16} />
            <div>
              <p>جميع وسائل التواصل الاجتماعي والتواصل المباشر أصبحت متوفرة الآن في صفحة مستقلة داخل الموقع.</p>
              <div className="contact-page-actions">
                <Link href="/contact" className="btn btn-ghost btn-sm">
                  <AppIcon name="arrow-left" size={14} />
                  افتح صفحة تواصل معنا
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {whatsappSupportLink ? (
        <a
          href={whatsappSupportLink}
          className="whatsapp-float"
          target="_blank"
          rel="noopener noreferrer"
          title="تواصل عبر واتساب"
        >
          <AppIcon name="message" className="wa-icon" size={18} />
          تحتاج مساعدة؟
        </a>
      ) : null}
    </>
  );
}
