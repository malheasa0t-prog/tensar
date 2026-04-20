"use client";

import styles from "@/components/PageTransitionShell.module.css";
import usePageTransitionState from "@/hooks/usePageTransitionState";

/**
 * Wraps the routed page content with a shared transition stage.
 *
 * @param {{ children: import("react").ReactNode }} props
 * @returns {JSX.Element}
 */
export default function PageTransitionShell({ children }) {
  const { phase, routeKey, pendingDestination, prefersReducedMotion } = usePageTransitionState();
  const isTransitionVisible = !prefersReducedMotion && phase !== "idle";
  const isExiting = phase === "exit";
  const statusLabel = isExiting ? "ننتقل بسلاسة إلى الصفحة التالية" : "تم تحميل الصفحة";
  const destinationLabel = pendingDestination ? pendingDestination.replace(/^\//, "") : "واجهة TechZone";

  return (
    <div className={styles.shell} data-phase={phase}>
      {isTransitionVisible ? (
        <div className={styles.ambientBackdrop} aria-hidden="true">
          <span className={styles.glow} />
          <span className={styles.glowAlt} />
          <span className={styles.grid} />
        </div>
      ) : null}

      <div key={routeKey} className={styles.page}>
        {children}
      </div>

      <div className={`${styles.transitionOverlay} ${isTransitionVisible ? styles.overlayVisible : ""}`} aria-hidden="true">
        <div className={styles.transitionPanel}>
          <span className={styles.transitionEyebrow}>انتقال سلس</span>
          <strong className={styles.transitionTitle}>{statusLabel}</strong>
          <span className={styles.transitionCopy}>{isExiting ? destinationLabel : "جاري تجهيز المحتوى بالحركة الجديدة"}</span>
          <span className={styles.transitionBar} />
        </div>
      </div>

      <span className={styles.screenReaderStatus} aria-live="polite">
        {isTransitionVisible ? statusLabel : ""}
      </span>
    </div>
  );
}
