const DEFAULT_MAGNETIC_MAX_OFFSET = 12;

/**
 * Restrains a numeric value to the provided range.
 *
 * @param {number} value
 * @param {number} minimum
 * @param {number} maximum
 * @returns {number}
 */
export function clampInteractiveValue(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

/**
 * Builds the magnetic hover translation for a button-like element.
 *
 * @param {{
 *   clientX: number,
 *   clientY: number,
 *   rect: Pick<DOMRect, "height" | "left" | "top" | "width">,
 *   maxOffset?: number,
 * }} input
 * @returns {{ x: number, y: number }}
 */
export function buildMagneticOffset(input) {
  const maxOffset = Number(input?.maxOffset) > 0 ? Number(input.maxOffset) : DEFAULT_MAGNETIC_MAX_OFFSET;
  const width = Number(input?.rect?.width) || 1;
  const height = Number(input?.rect?.height) || 1;
  const offsetX = ((Number(input?.clientX) - Number(input?.rect?.left) - width / 2) / width) * maxOffset * 2;
  const offsetY = ((Number(input?.clientY) - Number(input?.rect?.top) - height / 2) / height) * maxOffset * 2;

  return {
    x: clampInteractiveValue(offsetX, -maxOffset, maxOffset),
    y: clampInteractiveValue(offsetY, -maxOffset, maxOffset),
  };
}

/**
 * Returns CSS-friendly pointer coordinates inside a hovered surface.
 *
 * @param {{
 *   clientX: number,
 *   clientY: number,
 *   rect: Pick<DOMRect, "left" | "top">
 * }} input
 * @returns {{ x: string, y: string }}
 */
export function buildPointerGlowPosition(input) {
  return {
    x: `${Math.round(Number(input?.clientX) - Number(input?.rect?.left || 0))}px`,
    y: `${Math.round(Number(input?.clientY) - Number(input?.rect?.top || 0))}px`,
  };
}

/**
 * Builds a subtle vertical parallax offset from the current scroll position.
 *
 * @param {{ multiplier?: number, scrollY?: number }} input
 * @returns {number}
 */
export function buildParallaxOffset(input) {
  const scrollY = Number(input?.scrollY || 0);
  const multiplier = Number(input?.multiplier || 0);
  return Number((scrollY * multiplier).toFixed(2));
}
