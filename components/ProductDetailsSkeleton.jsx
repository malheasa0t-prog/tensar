import styles from '@/components/ProductDetailsSkeleton.module.css';

/**
 * Renders a product-detail skeleton that mirrors the final two-column layout.
 *
 * @returns {JSX.Element}
 */
export default function ProductDetailsSkeleton() {
  return (
    <section className={styles.section} aria-busy="true">
      <div className="container">
        <div className={styles.hero}>
          <span className={styles.crumbs} />
          <span className={styles.badge} />
          <span className={styles.title} />
          <span className={styles.copy} />
          <div className={styles.stats}>
            {Array.from({ length: 3 }).map((_, index) => (
              <span key={`product-hero-stat-${index}`} className={styles.stat} />
            ))}
          </div>
        </div>

        <div className={styles.layout}>
          <div className={styles.mediaColumn}>
            <div className={styles.mediaCard}>
              <span className={styles.mediaFrame} />
            </div>

            <div className={styles.subgrid}>
              {Array.from({ length: 3 }).map((_, index) => (
                <span key={`product-meta-${index}`} className={styles.subcard} />
              ))}
            </div>
          </div>

          <div className={styles.contentColumn}>
            <div className={styles.contentCard}>
              <span className={styles.kicker} />
              <span className={styles.price} />
              <span className={styles.line} />
              <span className={`${styles.line} ${styles.lineWide}`} />
              <div className={styles.metaGrid}>
                {Array.from({ length: 4 }).map((_, index) => (
                  <span key={`product-grid-${index}`} className={styles.metaCard} />
                ))}
              </div>
              <div className={styles.specs}>
                {Array.from({ length: 4 }).map((_, index) => (
                  <span key={`product-spec-${index}`} className={styles.specRow} />
                ))}
              </div>
              <div className={styles.actions}>
                <span className={styles.buttonPrimary} />
                <span className={styles.buttonSecondary} />
              </div>
            </div>

            <div className={styles.sideCard}>
              <span className={styles.sideTitle} />
              <span className={styles.sideLine} />
              <span className={styles.sideLine} />
              <span className={`${styles.sideLine} ${styles.sideLineShort}`} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
