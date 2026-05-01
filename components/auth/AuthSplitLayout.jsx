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
  const hasPanelIntro = Boolean(panel?.eyebrow || panel?.title || panel?.description);
  const hasPanelFeatures = Array.isArray(panel?.features) && panel.features.length > 0;
  const hasPanelStats = Array.isArray(panel?.stats) && panel.stats.length > 0;
  const hasShowcaseContent = hasPanelIntro || hasPanelFeatures || hasPanelStats;
  const layoutClassName = hasShowcaseContent
    ? styles.layout
    : `${styles.layout} ${styles.layoutSingleColumn}`;
  const dashboardFeatures = hasPanelFeatures ? panel.features.slice(0, 2) : [];

  return (
    <section className={styles.shell}>
      <div className={layoutClassName}>
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

        {hasShowcaseContent ? (
          <aside className={`surface-panel ${styles.showcaseCard}`}>
            {panel.eyebrow ? (
              <span className={styles.showcaseBadge}>
                <AppIcon name="sparkles" size={14} />
                {panel.eyebrow}
              </span>
            ) : null}
            {panel.title ? <h2>{panel.title}</h2> : null}
            {panel.description ? <p>{panel.description}</p> : null}

            {dashboardFeatures.length > 0 ? (
              <div className={styles.visualStage} aria-hidden="true">
                <div className={styles.glowOrb} />
                <div className={styles.dashboardCard}>
                  <div className={styles.dashboardBar}>
                    <span />
                    <span />
                    <span />
                  </div>
                  <div className={styles.dashboardGrid}>
                    {dashboardFeatures.map((feature) => (
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
              </div>
            ) : null}

            {hasPanelStats ? (
              <div className={styles.statsRow}>
                {panel.stats.map((item) => (
                  <div key={item.label} className={styles.statCard}>
                    <strong>{item.value}</strong>
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            ) : null}

            {hasPanelFeatures ? (
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
            ) : null}
          </aside>
        ) : null}
      </div>
    </section>
  );
}
