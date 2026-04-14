import Link from "next/link";
import AppIcon from "@/components/AppIcon";
import ScrollReveal from "@/components/ScrollReveal";
import { getStaggeredRevealDelay } from "@/lib/scrollRevealModel";

/**
 * Renders the homepage contact showcase section below the hero.
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
    <section className="section alt home-contact-section" id="contact">
      <div className="container">
        <div className="techfix-contact-grid">
          <div className="home-contact-main">
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
                    صفحة التواصل
                  </Link>
                  {whatsappSupportLink ? (
                    <a
                      href={whatsappSupportLink}
                      className="btn btn-primary"
                      target="_blank"
                      rel="noreferrer"
                    >
                      واتساب
                    </a>
                  ) : null}
                </div>
              </aside>
            </ScrollReveal>
          </div>
        </div>
      </div>
    </section>
  );
}
