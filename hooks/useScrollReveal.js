"use client";

import { useEffect, useRef, useState } from "react";
import {
  SCROLL_REVEAL_DEFAULT_ROOT_MARGIN,
  SCROLL_REVEAL_DEFAULT_THRESHOLD,
} from "@/lib/scrollRevealModel";

/**
 * Tracks whether an element is visible in the viewport for reveal animations.
 *
 * @param {{
 *   once?: boolean,
 *   rootMargin?: string,
 *   threshold?: number,
 * }} options
 * @returns {{ ref: import("react").MutableRefObject<HTMLElement | null>, isVisible: boolean }}
 */
export function useScrollReveal({
  once = true,
  rootMargin = SCROLL_REVEAL_DEFAULT_ROOT_MARGIN,
  threshold = SCROLL_REVEAL_DEFAULT_THRESHOLD,
} = {}) {
  const ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return undefined;
    }

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion || typeof IntersectionObserver === "undefined") {
      setIsVisible(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (once) {
            observer.unobserve(entry.target);
          }
          return;
        }

        if (!once) {
          setIsVisible(false);
        }
      },
      { rootMargin, threshold }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [once, rootMargin, threshold]);

  return { ref, isVisible };
}
