import Link from "next/link";
import AppIcon from "@/components/AppIcon";

/**
 * Fallback page for routes that are not mapped yet in the non-Next copy.
 *
 * @returns {JSX.Element}
 */
export default function NotFoundPage() {
  return (
    <section className="section page-top">
      <div className="container">
        <div className="surface-panel section-shell" style={{ textAlign: "center" }}>
          <div className="section-header" style={{ alignItems: "center" }}>
            <span className="section-badge">
              <AppIcon name="triangle-alert" size={14} />
              الصفحة غير متاحة
            </span>
            <h1>لم نعثر على هذه الصفحة داخل النسخة بدون Next.js</h1>
            <p>
              أنشأنا هذه النسخة كمشروع موازٍ وآمن للهجرة التدريجية. بعض المسارات ما زالت
              تحتاج نقلًا إضافيًا.
            </p>
          </div>

          <div className="hero-actions" style={{ justifyContent: "center" }}>
            <Link href="/" className="btn btn-primary">
              العودة للرئيسية
            </Link>
            <Link href="/products" className="btn btn-secondary">
              تصفح المنتجات
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
