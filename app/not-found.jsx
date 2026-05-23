import Link from "next/link";
import styles from "./notFound.module.css";
import AppIcon from "@/components/AppIcon";
import { usePageSeo } from "@/hooks/usePageSeo";

const SUGGESTED_LINKS = [
  { href: "/services", label: "خدمات الصيانة", icon: "wrench" },
  { href: "/contact", label: "تواصل معنا", icon: "phone" },
];

/**
 * Renders the public 404 page.
 *
 * @returns {JSX.Element} Not-found page.
 */
export default function NotFound() {
  usePageSeo({
    title: "الصفحة غير موجودة",
    description: "الرابط المطلوب غير متاح حالياً. عد إلى الرئيسية أو تصفح خدمات الصيانة للوصول إلى ما تريد.",
    robots: "noindex, nofollow",
  });

  return (
    <section className={`section page-top ${styles.section}`}>
      <div className="container">
        <div className={styles.card}>
          <div className={styles.visual} aria-hidden="true">
            <span className={styles.orbPrimary} />
            <span className={styles.orbSecondary} />
            <span className={styles.compass}>
              <AppIcon name="compass" size={54} />
            </span>
          </div>

          <div className={styles.copy}>
            <span className={styles.eyebrow}>404 • الصفحة غير موجودة</span>
            <h1>يبدو أن الرابط لم يعد متاحاً</h1>
            <p>
              يمكنك العودة للرئيسية أو فتح خدمات الصيانة مباشرة، وسنساعدك في الوصول إلى الخدمة
              المناسبة بأسرع طريق.
            </p>

            <form action="/services" method="get" className={styles.searchForm}>
              <label htmlFor="not-found-search" className={styles.searchLabel}>
                ابحث عن خدمة صيانة
              </label>
              <div className={styles.searchField}>
                <input
                  id="not-found-search"
                  name="search"
                  type="search"
                  placeholder="ابحث عن خدمة أو فئة صيانة..."
                />
                <button type="submit" className={styles.searchButton}>
                  <AppIcon name="search" size={16} />
                  ابحث الآن
                </button>
              </div>
            </form>

            <div className={styles.actions}>
              <Link href="/" className={styles.primaryButton}>
                العودة للرئيسية
              </Link>
              <Link href="/services" className={styles.secondaryButton}>
                تصفح الخدمات
              </Link>
            </div>

            <div className={styles.linksGrid}>
              {SUGGESTED_LINKS.map((link) => (
                <Link key={link.href} href={link.href} className={styles.linkCard}>
                  <span className={styles.linkIcon}>
                    <AppIcon name={link.icon} size={18} />
                  </span>
                  <span>{link.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
