import styles from '@/components/DashboardShellSkeleton.module.css';

/**
 * Renders a polished dashboard shell skeleton while user data loads.
 *
 * @returns {JSX.Element}
 */
export default function DashboardShellSkeleton() {
  return (
    <section className={styles.shell} aria-busy="true">
      <div className="container">
        <div className={styles.hero}>
          <div className={styles.heroCopy}>
            <span className={styles.badge} />
            <span className={styles.title} />
            <span className={styles.subtitle} />
          </div>

          <div className={styles.heroActions}>
            <span className={styles.wallet} />
            <span className={styles.button} />
          </div>
        </div>

        <div className={styles.tabs}>
          {Array.from({ length: 6 }).map((_, index) => (
            <span key={`dashboard-tab-${index}`} className={styles.tab} />
          ))}
        </div>

        <div className={styles.content}>
          <div className={styles.statsGrid}>
            {Array.from({ length: 4 }).map((_, index) => (
              <article key={`dashboard-stat-${index}`} className={styles.statCard}>
                <span className={styles.cardLabel} />
                <span className={styles.cardValue} />
                <span className={styles.cardMeta} />
              </article>
            ))}
          </div>

          <div className={styles.panelGrid}>
            <article className={styles.panelCard}>
              <span className={styles.panelTitle} />
              <span className={styles.panelLine} />
              <span className={styles.panelLine} />
              <span className={`${styles.panelLine} ${styles.panelLineShort}`} />
            </article>

            <article className={styles.panelCard}>
              <span className={styles.panelTitle} />
              <div className={styles.list}>
                {Array.from({ length: 3 }).map((_, index) => (
                  <span key={`dashboard-row-${index}`} className={styles.listRow} />
                ))}
              </div>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}
