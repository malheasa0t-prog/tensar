import Link from "next/link";
import styles from "./notFound.module.css";
import AppIcon from "@/components/AppIcon";

const SUGGESTED_LINKS = [
  { href: "/products", label: "المنتجات الأكثر زيارة", icon: "shopping-bag" },
  { href: "/services", label: "خدمات الصيانة", icon: "wrench" },
  { href: "/subscriptions", label: "الاشتراكات والشحن", icon: "wallet" },
];

export default function NotFound() {
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
            <h1>يبدو أنك ضللت الطريق</h1>
            <p>
              الرابط الذي تحاول الوصول إليه لم يعد متاحاً، لكن يمكنك البحث مباشرة أو الرجوع إلى الأقسام
              الأكثر زيارة داخل المتجر.
            </p>

            <form action="/products" method="get" className={styles.searchForm}>
              <label htmlFor="not-found-search" className={styles.searchLabel}>
                جرّب البحث عما تريد
              </label>
              <div className={styles.searchField}>
                <input
                  id="not-found-search"
                  name="search"
                  type="search"
                  placeholder="ابحث عن منتج أو فئة أو خدمة..."
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
              <Link href="/products" className={styles.secondaryButton}>
                تصفح المنتجات
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
