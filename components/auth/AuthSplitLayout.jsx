import AppIcon from "@/components/AppIcon";
import styles from "./AuthAccessShell.module.css";

/**
 * Renders a reusable split authentication layout with a showcase panel.
 *
 * @param {{
 *   badgeIcon?: string,
 *   description: string,
 *   footer?: import("react").ReactNode,
 *   formChildren: import("react").ReactNode,
 *   panel: {
 *     eyebrow: string,
 *     title: string,
 *     description: string,
 *     features: Array<{ icon: string, title: string, description: string }>,
 *     stats: Array<{ value: string, label: string }>,
 *   },
 *   title: string,
 * }} props
 * @returns {import("react").JSX.Element}
 */
export default function AuthSplitLayout({
  badgeIcon = "lock",
  description,
  footer = null,
  formChildren,
  panel,
  title,
}) {
  return (
    <section className={styles.shell}>
      <div className={styles.layout}>
        <div className={`surface-panel auth-card ${styles.formCard}`}>
          <div className="auth-head">
            <div className="auth-icon">
              <AppIcon name={badgeIcon} size={28} />
            </div>
            <h1>{title}</h1>
            <p className="auth-subcopy">{description}</p>
          </div>

          {formChildren}
          {footer ? <div className={styles.footerSlot}>{footer}</div> : null}
        </div>

        <aside className={`surface-panel ${styles.showcaseCard}`}>
          <span className={styles.showcaseBadge}>
            <AppIcon name="sparkles" size={14} />
            {panel.eyebrow}
          </span>
          <h2>{panel.title}</h2>
          <p>{panel.description}</p>

          <div className={styles.visualStage} aria-hidden="true">
            <div className={styles.glowOrb} />
            <div className={styles.dashboardCard}>
              <div className={styles.dashboardBar}>
                <span />
                <span />
                <span />
              </div>
              <div className={styles.dashboardGrid}>
                {panel.features.slice(0, 2).map((feature) => (
                  <div key={feature.title} className={styles.dashboardMetric}>
                    <span className={styles.metricIcon}>
                      <AppIcon name={feature.icon} size={18} />
                    </span>
                    <strong>{feature.title}</strong>
                    <small>{feature.description}</small>
                  </div>
                ))}
              </div>
            </div>
            <div className={styles.floatingCard}>
              <span className={styles.metricIcon}>
                <AppIcon name="shield-check" size={18} />
              </span>
              <strong>جلسة آمنة</strong>
              <small>بياناتك تنتقل عبر مسار مصادقة مشفّر.</small>
            </div>
          </div>

          <div className={styles.statsRow}>
            {panel.stats.map((item) => (
              <div key={item.label} className={styles.statCard}>
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </div>
            ))}
          </div>

          <div className={styles.featureList}>
            {panel.features.map((feature) => (
              <article key={feature.title} className={styles.featureItem}>
                <span className={styles.featureIcon}>
                  <AppIcon name={feature.icon} size={18} />
                </span>
                <div>
                  <strong>{feature.title}</strong>
                  <p>{feature.description}</p>
                </div>
              </article>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
}
