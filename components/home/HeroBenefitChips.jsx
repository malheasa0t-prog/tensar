import AppIcon from "@/components/AppIcon";
import styles from "./HeroBenefitChips.module.css";

/**
 * Renders a compact row of hero benefits.
 *
 * @param {{ highlights: Array<{ icon: string, title: string, subtitle: string }> }} props
 * @returns {JSX.Element}
 */
export default function HeroBenefitChips({ highlights }) {
  return (
    <div className={styles.benefitRow}>
      {highlights.map((item) => (
        <div key={`${item.icon}-${item.title}`} className={styles.benefitChip}>
          <span className={styles.benefitIcon}>
            <AppIcon name={item.icon} size={15} />
          </span>
          <div>
            <strong>{item.title}</strong>
            {item.subtitle ? <span>{item.subtitle}</span> : null}
          </div>
        </div>
      ))}
    </div>
  );
}
