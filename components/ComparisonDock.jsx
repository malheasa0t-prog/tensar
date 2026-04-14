"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AppIcon from "./AppIcon";
import { useComparison } from "./ComparisonProvider";
import styles from "./ComparisonDock.module.css";
import { COMPARISON_MIN_ITEMS } from "@/lib/comparisonModel";

export default function ComparisonDock() {
  const pathname = usePathname();
  const { clearComparison, comparisonCount, comparisonEntries, removeComparison } = useComparison();

  if (
    comparisonCount === 0 ||
    pathname?.startsWith("/admin") ||
    pathname?.startsWith("/auth") ||
    pathname?.startsWith("/compare")
  ) {
    return null;
  }

  return (
    <div className={styles.shell}>
      <div className={styles.panel}>
        <div className={styles.copy}>
          <span className={styles.eyebrow}>
            <AppIcon name="compare" size={14} />
            مقارنة ذكية
          </span>
          <strong>أضفت {comparisonCount} منتجات إلى المقارنة</strong>
          <p>
            {comparisonCount >= COMPARISON_MIN_ITEMS
              ? "الجدول جاهز الآن لعرض الفروقات جنباً إلى جنب."
              : "أضف منتجاً آخر على الأقل لفتح صفحة المقارنة."}
          </p>
        </div>

        <div className={styles.items}>
          {comparisonEntries.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={styles.itemChip}
              onClick={() => removeComparison(entry.id)}
              aria-label={`إزالة ${entry.name} من المقارنة`}
            >
              <span>{entry.name}</span>
              <AppIcon name="x" size={14} />
            </button>
          ))}
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.ghostButton} onClick={clearComparison}>
            مسح الكل
          </button>
          <Link
            href={comparisonCount >= COMPARISON_MIN_ITEMS ? "/compare" : "#"}
            className={`${styles.primaryButton} ${comparisonCount < COMPARISON_MIN_ITEMS ? styles.disabledButton : ""}`}
            aria-disabled={comparisonCount < COMPARISON_MIN_ITEMS}
          >
            <AppIcon name="compare" size={16} />
            فتح المقارنة
          </Link>
        </div>
      </div>
    </div>
  );
}
