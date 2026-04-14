/**
 * Small helpers used by the dynamic favicon generator.
 */

const BADGE_LIMIT = 99;

/**
 * Normalizes the visual state used by the favicon badge.
 *
 * @param {{ cartCount?: unknown, unreadCount?: unknown }} counts
 * @returns {{ badgeText: string, hasNotificationDot: boolean }}
 */
export function buildDynamicFaviconState(counts = {}) {
  const cartCount = Math.max(0, Number(counts.cartCount || 0));
  const unreadCount = Math.max(0, Number(counts.unreadCount || 0));
  const badgeText = cartCount > BADGE_LIMIT ? `${BADGE_LIMIT}+` : cartCount > 0 ? String(cartCount) : "";

  return {
    badgeText,
    hasNotificationDot: unreadCount > 0,
  };
}
