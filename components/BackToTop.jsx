"use client";

import { useEffect, useState } from "react";
import AppIcon from "@/components/AppIcon";
import styles from "./BackToTop.module.css";

const PROGRESS_RING_RADIUS = 24;
const PROGRESS_RING_CIRCUMFERENCE = 2 * Math.PI * PROGRESS_RING_RADIUS;

/**
 * Renders a premium back-to-top control with a live progress ring.
 *
 * @returns {JSX.Element}
 */
export default function BackToTop() {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    /**
     * Syncs the button visibility and the reading progress.
     *
     * @returns {void}
     */
    function handleScroll() {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      const nextProgress = totalHeight > 0 ? Math.min(1, window.scrollY / totalHeight) : 0;
      setVisible(window.scrollY > 420);
      setProgress(nextProgress);
    }

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

  /**
   * Scrolls the document back to the top smoothly.
   *
   * @returns {void}
   */
  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <button
      type="button"
      className={`${styles.button} ${visible ? styles.visible : ""}`}
      onClick={scrollToTop}
      aria-label="العودة إلى الأعلى"
    >
      <svg className={styles.ring} viewBox="0 0 56 56" aria-hidden="true">
        <circle className={styles.ringTrack} cx="28" cy="28" r={PROGRESS_RING_RADIUS} />
        <circle
          className={styles.ringProgress}
          cx="28"
          cy="28"
          r={PROGRESS_RING_RADIUS}
          strokeDasharray={PROGRESS_RING_CIRCUMFERENCE}
          strokeDashoffset={PROGRESS_RING_CIRCUMFERENCE * (1 - progress)}
        />
      </svg>

      <span className={styles.icon}>
        <AppIcon name="arrow-up" size={18} />
      </span>
    </button>
  );
}
