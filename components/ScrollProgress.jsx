"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./ScrollProgress.module.css";

/**
 * Displays a thin scroll progress bar across the top of the page.
 *
 * @returns {JSX.Element}
 */
export default function ScrollProgress() {
  const [progress, setProgress] = useState(0);
  const animationFrameRef = useRef(0);
  const progressRef = useRef(0);

  useEffect(() => {
    /**
     * Calculates the next visible scroll ratio and updates state only when needed.
     *
     * @returns {void}
     */
    function syncProgress() {
      animationFrameRef.current = 0;
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      const nextProgress = totalHeight > 0 ? window.scrollY / totalHeight : 0;

      if (Math.abs(progressRef.current - nextProgress) < 0.001) {
        return;
      }

      progressRef.current = nextProgress;
      setProgress(nextProgress);
    }

    /**
     * Schedules one animation-frame update for the progress indicator.
     *
     * @returns {void}
     */
    function scheduleProgressSync() {
      if (animationFrameRef.current) {
        return;
      }

      animationFrameRef.current = window.requestAnimationFrame(syncProgress);
    }

    syncProgress();
    window.addEventListener("scroll", scheduleProgressSync, { passive: true });
    window.addEventListener("resize", scheduleProgressSync);

    return () => {
      if (animationFrameRef.current) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }

      window.removeEventListener("scroll", scheduleProgressSync);
      window.removeEventListener("resize", scheduleProgressSync);
    };
  }, []);

  return (
    <div className={styles.track} aria-hidden="true">
      <span className={styles.bar} style={{ transform: `scaleX(${progress})` }} />
    </div>
  );
}
