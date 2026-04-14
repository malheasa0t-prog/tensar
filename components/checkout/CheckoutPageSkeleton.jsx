import styles from '@/components/checkout/CheckoutPageSkeleton.module.css';

/**
 * Renders a checkout skeleton with hero, form, summary, and trust placeholders.
 *
 * @returns {JSX.Element}
 */
export default function CheckoutPageSkeleton() {
  return (
    <section className={styles.shell} aria-busy="true">
      <div className="container">
        <div className={styles.hero}>
          <span className={styles.crumbs} />
          <span className={styles.badge} />
          <span className={styles.title} />
          <span className={styles.copy} />
        </div>

        <div className={styles.layout}>
          <article className={styles.formCard}>
            <span className={styles.sectionTitle} />
            <span className={styles.sectionCopy} />
            <div className={styles.fieldGrid}>
              {Array.from({ length: 4 }).map((_, index) => (
                <span key={`checkout-field-${index}`} className={styles.field} />
              ))}
            </div>
            <span className={styles.textarea} />
            <span className={styles.submitButton} />
          </article>

          <aside className={styles.summaryCard}>
            <span className={styles.sectionTitle} />
            <div className={styles.summaryRows}>
              {Array.from({ length: 4 }).map((_, index) => (
                <span key={`checkout-row-${index}`} className={styles.summaryRow} />
              ))}
            </div>
            <span className={styles.totalRow} />
          </aside>
        </div>

        <div className={styles.trustGrid}>
          {Array.from({ length: 4 }).map((_, index) => (
            <span key={`checkout-badge-${index}`} className={styles.trustCard} />
          ))}
        </div>
      </div>
    </section>
  );
}
