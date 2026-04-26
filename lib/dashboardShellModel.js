/**
 * Dashboard shell presentation helpers.
 */

export const DASHBOARD_SHELL_TIMEOUT_MS = 10000;
export const DASHBOARD_SHELL_TIMEOUT_MESSAGE =
  "تعذر التحقق من جلسة تسجيل الدخول الآن. يمكنك إعادة المحاولة أو تسجيل الدخول من جديد.";

export const BASE_DASHBOARD_NAV_ITEMS = Object.freeze([
  { href: "/dashboard", label: "Ø§Ù„Ù…Ù„Ø®Øµ", icon: "ðŸ“Š" },
  { href: "/dashboard/orders", label: "Ø·Ù„Ø¨Ø§ØªÙŠ", icon: "ðŸ“¦" },
  { href: "/dashboard/favorites", label: "Ø§Ù„Ù…ÙØ¶Ù„Ø©", icon: "â¤ï¸" },
  { href: "/dashboard/notifications", label: "Ø§Ù„Ø¥Ø´Ø¹Ø§Ø±Ø§Øª", icon: "ðŸ””" },
  { href: "/dashboard/wallet", label: "Ù…Ø­ÙØ¸ØªÙŠ", icon: "ðŸ’°" },
  { href: "/dashboard/deposit", label: "Ø´Ø­Ù† Ø§Ù„Ø±ØµÙŠØ¯", icon: "ðŸ’³" },
  { href: "/dashboard/profile", label: "Ù…Ù„ÙÙŠ Ø§Ù„Ø´Ø®ØµÙŠ", icon: "ðŸ‘¤" },
]);

/**
 * Creates the timeout error shown when dashboard auth takes too long.
 *
 * @returns {Error}
 */
export function createDashboardShellTimeoutError() {
  return new Error(`[DSH-305] ${DASHBOARD_SHELL_TIMEOUT_MESSAGE}`);
}

/**
 * Resolves the display name shown inside the dashboard hero.
 *
 * @param {{ profile: Record<string, unknown> | null, user: { email?: string | null } | null }} input
 * @returns {string}
 */
export function resolveDashboardDisplayName({ profile, user }) {
  const fallbackUsername = user?.email ? String(user.email).split("@")[0] : "Ù…Ø³ØªØ®Ø¯Ù…";
  const fullName = typeof profile?.full_name === "string" ? profile.full_name.trim() : "";
  return fullName || fallbackUsername;
}

/**
 * Builds dashboard navigation items with live badges.
 *
 * @param {{ favoriteCount: number, unreadNotifications: number }} input
 * @returns {Array<{ href: string, label: string, icon: string, badge?: string }>}
 */
export function buildDashboardNavItems({ favoriteCount, unreadNotifications }) {
  return BASE_DASHBOARD_NAV_ITEMS.map((item) => {
    if (item.href === "/dashboard/notifications") {
      return {
        ...item,
        badge: unreadNotifications > 99 ? "99+" : unreadNotifications || "",
      };
    }

    if (item.href === "/dashboard/favorites") {
      return {
        ...item,
        badge: favoriteCount > 99 ? "99+" : favoriteCount || "",
      };
    }

    return item;
  });
}
