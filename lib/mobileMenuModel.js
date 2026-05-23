/**
 * Resolves an icon name for the provided public route.
 *
 * @param {string} href
 * @returns {string}
 */
export function resolveMobileMenuIcon(href) {
  const value = String(href || "").trim().toLowerCase();

  if (value === "/" || value.startsWith("/home")) return "house";
  if (value.startsWith("/products") || value.startsWith("/category")) return "wrench";
  if (value.startsWith("/services")) return "wrench";
  if (value.startsWith("/deposit")) return "wallet";
  if (value.startsWith("/contact")) return "message-circle";
  if (value.startsWith("/compare")) return "compare";
  return "folder-open";
}

/**
 * Builds the quick account links shown in the mobile menu.
 *
 * @param {{
 *   favoriteCount?: number,
 *   hasUser?: boolean,
 *   unreadNotifications?: number,
 * }} input
 * @returns {Array<{ badge: string, href: string, icon: string, label: string }>}
 */
export function buildMobileAccountLinks(input = {}) {
  const favoriteCount = Number(input.favoriteCount || 0);
  const unreadNotifications = Number(input.unreadNotifications || 0);

  if (!input.hasUser) {
    return [
      { href: "/auth/login", label: "تسجيل الدخول", icon: "lock", badge: "" },
      { href: "/auth/register", label: "إنشاء حساب", icon: "user", badge: "" },
    ];
  }

  return [
    { href: "/dashboard", label: "لوحة التحكم", icon: "dashboard", badge: "" },
    { href: "/dashboard/orders", label: "طلباتي", icon: "shopping-bag", badge: "" },
    {
      href: "/dashboard/notifications",
      label: "الإشعارات",
      icon: "bell",
      badge: unreadNotifications > 0 ? String(unreadNotifications > 99 ? "99+" : unreadNotifications) : "",
    },
    {
      href: "/dashboard/favorites",
      label: "المفضلة",
      icon: "heart",
      badge: favoriteCount > 0 ? String(favoriteCount > 99 ? "99+" : favoriteCount) : "",
    },
  ];
}
