import styles from "@/components/RouteLoadingScreen.module.css";

const DEFAULT_TITLE = "نحضّر الصفحة التالية";
const DEFAULT_DESCRIPTION = "يتم الآن تحميل المحتوى مع انتقال بصري أكثر سلاسة ووضوحاً.";

/**
 * Renders a polished route loading state for full-page and embedded flows.
 *
 * @param {{
 *   eyebrow?: string,
 *   title?: string,
 *   description?: string,
 *   compact?: boolean,
 * }} props
 * @returns {JSX.Element}
 */
export default function RouteLoadingScreen({
  eyebrow = "جاري التحميل",
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  compact = false,
}) {
  return (
    <section className={`${styles.screen} ${compact ? styles.compact : ""}`} aria-busy="true" aria-live="polite">
      <div className={styles.card}>
        <span className={styles.eyebrow}>{eyebrow}</span>
        <div className={styles.visual} aria-hidden="true">
          <span className={styles.orb} />
          <span className={styles.orbAlt} />
          <span className={styles.ring} />
        </div>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.description}>{description}</p>
        <div className={styles.progressTrack} aria-hidden="true">
          <span className={styles.progressBar} />
        </div>
        <div className={styles.metaRow} aria-hidden="true">
          <span className={styles.metaPill} />
          <span className={styles.metaPillWide} />
          <span className={styles.metaPill} />
        </div>
      </div>
    </section>
  );
}
