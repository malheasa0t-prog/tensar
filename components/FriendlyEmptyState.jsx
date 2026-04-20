import AppIcon from "@/components/AppIcon";
import styles from "@/components/FriendlyEmptyState.module.css";

/**
 * Displays a polished empty-state card with a lightweight illustration.
 *
 * @param {{
 *   actions?: import("react").ReactNode,
 *   compact?: boolean,
 *   description: string,
 *   eyebrow?: string,
 *   icon?: string,
 *   title: string,
 *   tone?: "default" | "search" | "contrast",
 * }} props
 * @returns {JSX.Element}
 */
export default function FriendlyEmptyState({
  actions = null,
  compact = false,
  description,
  eyebrow = "",
  icon = "sparkles",
  title,
  tone = "default",
}) {
  const toneClassName =
    tone === "search"
      ? styles.toneSearch
      : tone === "contrast"
        ? styles.toneContrast
        : styles.toneDefault;

  return (
    <section className={`${styles.panel} ${toneClassName} ${compact ? styles.compact : ""}`}>
      <div className={styles.illustration} aria-hidden="true">
        <span className={styles.glow} />
        <span className={styles.orbit} />
        <span className={styles.grid} />
        <span className={styles.iconFrame}>
          <AppIcon name={icon} size={compact ? 28 : 34} />
        </span>
        <span className={`${styles.floatingCard} ${styles.floatingCardPrimary}`} />
        <span className={`${styles.floatingCard} ${styles.floatingCardSecondary}`} />
      </div>

      <div className={styles.copy}>
        {eyebrow ? <span className={styles.eyebrow}>{eyebrow}</span> : null}
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.description}>{description}</p>
      </div>

      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </section>
  );
}
