export const SCROLL_REVEAL_DEFAULT_VARIANT = "fade-up";
export const SCROLL_REVEAL_DEFAULT_STEP_MS = 90;
export const SCROLL_REVEAL_DEFAULT_THRESHOLD = 0.18;
export const SCROLL_REVEAL_DEFAULT_ROOT_MARGIN = "0px 0px -12% 0px";

const SCROLL_REVEAL_VARIANTS = new Set([
  "fade-up",
  "slide-in-right",
  "zoom-in",
]);

/**
 * Normalizes the requested reveal animation variant.
 *
 * @param {unknown} variant
 * @returns {string}
 */
export function normalizeRevealVariant(variant) {
  const value = String(variant || "").trim().toLowerCase();
  return SCROLL_REVEAL_VARIANTS.has(value) ? value : SCROLL_REVEAL_DEFAULT_VARIANT;
}

/**
 * Converts a reveal delay value into a safe CSS duration string.
 *
 * @param {unknown} delayMs
 * @returns {string}
 */
export function resolveRevealDelay(delayMs) {
  const value = Number(delayMs);
  return `${Number.isFinite(value) && value > 0 ? Math.round(value) : 0}ms`;
}

/**
 * Builds a staggered reveal delay based on item index.
 *
 * @param {unknown} index
 * @param {unknown} stepMs
 * @param {unknown} initialDelayMs
 * @returns {number}
 */
export function getStaggeredRevealDelay(index, stepMs = SCROLL_REVEAL_DEFAULT_STEP_MS, initialDelayMs = 0) {
  const safeIndex = Math.max(0, Math.trunc(Number(index) || 0));
  const safeStep = Math.max(0, Math.trunc(Number(stepMs) || 0));
  const safeInitialDelay = Math.max(0, Math.trunc(Number(initialDelayMs) || 0));
  return safeInitialDelay + safeIndex * safeStep;
}

/**
 * Builds the final reveal class list for an animated element.
 *
 * @param {string | null | undefined} className
 * @param {unknown} variant
 * @param {boolean} isVisible
 * @returns {string}
 */
export function buildRevealClassName(className, variant, isVisible) {
  const resolvedVariant = normalizeRevealVariant(variant);
  return [
    className,
    "scroll-reveal",
    `scroll-reveal--${resolvedVariant}`,
    isVisible ? "is-visible" : "",
  ]
    .filter(Boolean)
    .join(" ");
}
