"use client";

import { buildRevealClassName, resolveRevealDelay } from "@/lib/scrollRevealModel";
import { useScrollReveal } from "@/hooks/useScrollReveal";

/**
 * Wraps content with a scroll-triggered reveal animation shell.
 *
 * @param {{
 *   children: import("react").ReactNode,
 *   className?: string,
 *   delayMs?: number,
 *   once?: boolean,
 *   rootMargin?: string,
 *   style?: Record<string, unknown>,
 *   threshold?: number,
 *   variant?: string,
 * }} props
 * @returns {JSX.Element}
 */
export default function ScrollReveal({
  children,
  className = "",
  delayMs = 0,
  once = true,
  rootMargin,
  style,
  threshold,
  variant,
  ...restProps
}) {
  const { ref, isVisible } = useScrollReveal({
    once,
    rootMargin,
    threshold,
  });

  return (
    <div
      ref={ref}
      className={buildRevealClassName(className, variant, isVisible)}
      style={{
        ...style,
        "--reveal-delay": resolveRevealDelay(delayMs),
      }}
      {...restProps}
    >
      {children}
    </div>
  );
}
