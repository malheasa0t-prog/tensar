/**
 * Dashboard shell presentation helpers.
 */

export const DASHBOARD_SHELL_TIMEOUT_MS = 10000;
export const DASHBOARD_SHELL_TIMEOUT_MESSAGE =
  "تعذر التحقق من جلسة تسجيل الدخول الآن. يمكنك إعادة المحاولة أو تسجيل الدخول من جديد.";

export const BASE_DASHBOARD_NAV_ITEMS = Object.freeze([
  { href: "/dashboard", label: "الملخص", icon: "📊" },
  { href: "/dashboard/orders", label: "طلباتي", icon: "📦" },
  { href: "/dashboard/favorites", label: "المفضلة", icon: "❤️" },
  { href: "/dashboard/notifications", label: "الإشعارات", icon: "🔔" },
  { href: "/dashboard/wallet", label: "محفظتي", icon: "💰" },
  { href: "/dashboard/deposit", label: "شحن الرصيد", icon: "💳" },
  { href: "/dashboard/profile", label: "ملفي الشخصي", icon: "👤" },
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
  const fallbackUsername = user?.email ? String(user.email).split("@")[0] : "مستخدم";
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
