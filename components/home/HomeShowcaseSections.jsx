import Link from "next/link";
import AppIcon from "@/components/AppIcon";
import ScrollReveal from "@/components/ScrollReveal";
import { getStaggeredRevealDelay } from "@/lib/scrollRevealModel";

/**
 * Feature highlight card for the homepage showcase.
 *
 * @param {{ icon: string, title: string, description: string, delayMs: number }} props
 * @returns {JSX.Element}
 */
function FeatureCard({ icon, title, description, delayMs }) {
  return (
    <ScrollReveal variant="fade-up" delayMs={delayMs}>
      <div className="home-feature-card">
        <div className="home-feature-icon">
          <AppIcon name={icon} size={22} />
        </div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </ScrollReveal>
  );
}

/** @type {Array<{icon: string, title: string, description: string}>} */
const FEATURES = [
  {
    icon: "shield-check",
    title: "ضمان الجودة",
    description: "جميع المنتجات والخدمات مضمونة ومعتمدة بأعلى معايير الجودة.",
  },
  {
    icon: "zap",
    title: "تسليم فوري",
    description: "خدمات رقمية تُسلّم فورياً وشحن سريع للمنتجات الفعلية.",
  },
  {
    icon: "headphones",
    title: "دعم فني متواصل",
    description: "فريق دعم جاهز لمساعدتك على مدار الساعة عبر جميع القنوات.",
  },
  {
    icon: "credit-card",
    title: "دفع آمن",
    description: "طرق دفع متعددة وآمنة تشمل البطاقات والمحافظ الإلكترونية.",
  },
];

/**
 * Renders the homepage showcase sections below the hero.
 *
 * @param {{
 *   socialLinks: Array<{ key: string, href: string, icon: string, label: string, description: string }>,
 *   whatsappSupportLink?: string
 * }} props
 * @returns {JSX.Element}
 */
export default function HomeShowcaseSections({
  socialLinks,
  whatsappSupportLink,
}) {
  const availableSocialLinks = (Array.isArray(socialLinks) ? socialLinks : []).filter(
    (item) => item?.key !== "youtube" && item?.label !== "YouTube"
  );

  return (
    <>
      {/* Features Section */}
      <section className="section home-features-section" id="features">
        <div className="container">
          <ScrollReveal className="section-header home-features-header" variant="fade-up">
            <span className="section-badge">
              <AppIcon name="sparkles" size={14} />
              لماذا TechZone؟
            </span>
            <h2>كل ما تحتاجه في مكان واحد</h2>
            <p>منصة متكاملة للمنتجات والخدمات الرقمية بأفضل الأسعار.</p>
          </ScrollReveal>

          <div className="home-features-grid">
            {FEATURES.map((feature, index) => (
              <FeatureCard
                key={feature.title}
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
                delayMs={getStaggeredRevealDelay(index, 80)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="section alt home-contact-section" id="contact">
        <div className="container">
          <div className="home-contact-wrapper">
            <ScrollReveal className="section-header home-contact-header" variant="fade-up">
              <span className="section-badge">
                <AppIcon name="message" size={14} />
                تواصل مباشر
              </span>
              <h2>قنوات سريعة للحجز والاستفسار ومتابعة الطلبات</h2>
              <p>اختر القناة المناسبة وسنوجهك إلى أسرع طريقة لخدمتك.</p>
            </ScrollReveal>

            <ScrollReveal variant="slide-in-right" delayMs={160}>
              <aside className="techfix-cta-panel home-contact-panel">
                <div className="home-contact-panel-copy">
                  <h3>جاهزون لخدمتك في الشراء والصيانة</h3>
                  <p>
                    إذا كنت بحاجة إلى استشارة سريعة، ترشيح قطعة، أو تقييم عطل، ابدأ من صفحة التواصل أو الحجز.
                  </p>
                </div>

                <div className="hero-actions home-contact-actions">
                  <Link href="/contact" className="btn btn-secondary">
                    <AppIcon name="mail" size={16} />
                    صفحة التواصل
                  </Link>
                  {whatsappSupportLink ? (
                    <a
                      href={whatsappSupportLink}
                      className="btn btn-primary"
                      target="_blank"
                      rel="noreferrer"
                    >
                      <AppIcon name="message-circle" size={16} />
                      واتساب
                    </a>
                  ) : null}
                </div>
              </aside>
            </ScrollReveal>
          </div>
        </div>
      </section>
    </>
  );
}
