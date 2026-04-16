import Link from "next/link";
import AppIcon from "@/components/AppIcon";
import ProductCard from "@/components/ProductCard";
import ScrollReveal from "@/components/ScrollReveal";
import StatusPanel from "@/components/StatusPanel";
import InternalPageHero from "@/components/InternalPageHero";
import { useAsyncPageData } from "../hooks/useAsyncPageData.js";
import { loadSubscriptionsPageSnapshot } from "../data/publicPageData.js";

/**
 * Renders the subscriptions catalog in the non-Next copy.
 *
 * @returns {JSX.Element}
 */
export default function SubscriptionsRoute() {
  const { data, error } = useAsyncPageData(loadSubscriptionsPageSnapshot, [], []);
  const digitalProducts = Array.isArray(data) ? data : [];

  if (error) {
    return (
      <section className="section page-top">
        <div className="container">
          <StatusPanel
            tone="error"
            icon="refresh-cw"
            eyebrow="تعذر تحميل المنتجات الرقمية"
            title="حدث خلل أثناء فتح صفحة الشحن والاشتراكات"
            description="تعذر جلب المنتجات الرقمية أو الأقسام المرتبطة بها."
            actions={
              <>
                <Link href="/subscriptions" className="btn btn-primary">
                  إعادة المحاولة
                </Link>
                <Link href="/contact" className="btn btn-outline">
                  تواصل معنا
                </Link>
              </>
            }
          />
        </div>
      </section>
    );
  }

  return (
    <>
      <InternalPageHero
        currentPath="/subscriptions"
        items={[
          { href: "/", label: "الرئيسية" },
          { label: "شحن واشتراكات" }
        ]}
        badgeIcon="wallet"
        badgeLabel="خدمات رقمية"
        title={
          <>
            شحن <span className="gradient-text">واشتراكات</span>
          </>
        }
        description="منتجات رقمية فورية داخل واجهة أكثر تنظيمًا، مع إبراز واضح للعناصر المتاحة بدل ترك الصفحة كحالة فارغة."
        stats={[
          { label: "منتج رقمي", value: digitalProducts.length, tone: "success" },
          { label: "نوع الخدمة", value: "فوري" },
          { label: "الدعم", value: "مباشر", tone: "accent" }
        ]}
        summary={
          <div className="hero-summary-card">
            <div className="hero-summary-list">
              <div className="hero-summary-item">
                <span className="hero-summary-icon">
                  <AppIcon name="zap" size={18} />
                </span>
                <div>
                  <strong>تسليم أسرع بصريًا ووظيفيًا</strong>
                  <span>تعرض الصفحة حالة المنتجات الرقمية بشكل مباشر مع توزيع متوازن حتى عند وجود عدد قليل منها.</span>
                </div>
              </div>

              <div className="hero-summary-item">
                <span className="hero-summary-icon">
                  <AppIcon name="message-circle" size={18} />
                </span>
                <div>
                  <strong>دعم واضح عند عدم التوفر</strong>
                  <span>بدل أيقونة صغيرة مع نص قصير، تظهر الآن حالة فراغ كاملة تحافظ على مستوى التجربة.</span>
                </div>
              </div>
            </div>
          </div>
        }
      />

      <section className="section" style={{ paddingTop: 0, paddingBottom: "4rem" }}>
        <div className="container">
          {digitalProducts.length > 0 ? (
            <ScrollReveal variant="fade-up">
              <div className="surface-panel section-shell">
                <div className="section-shell-head">
                  <div className="section-shell-copy">
                    <h2>الخدمات الرقمية المتاحة الآن</h2>
                    <p>بطاقات موحدة بإيقاع بصري أكثر راحة، مع إبراز السعر والوصف ومسار الوصول للتفاصيل بدون فراغات ميتة.</p>
                  </div>

                  <span className="section-count-badge">
                    <AppIcon name="wallet" size={14} />
                    {digitalProducts.length} منتج
                  </span>
                </div>

                <div className="balanced-card-grid">
                  {digitalProducts.map((item, index) => (
                    <ProductCard key={item.id} product={item} revealIndex={index} />
                  ))}
                </div>
              </div>
            </ScrollReveal>
          ) : (
            <StatusPanel
              icon="wallet"
              eyebrow="قيد التحديث"
              title="لا توجد منتجات رقمية متاحة حاليًا"
              description="سيتم عرض بطاقات الشحن والاشتراكات هنا فور إضافتها. في الوقت الحالي يمكنك الوصول إلى المنتجات أو التواصل لطلب خدمة محددة."
              actions={
                <>
                  <Link href="/products" className="btn btn-primary">
                    تصفح المنتجات
                  </Link>
                  <Link href="/contact" className="btn btn-outline">
                    اطلب خدمة مخصصة
                  </Link>
                </>
              }
            />
          )}
        </div>
      </section>
    </>
  );
}
