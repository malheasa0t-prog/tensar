/**
 * Pure helpers for client-side route prefetch matching.
 */

const ROOT_PATH = "/";
const ROUTE_PREFETCH_RULES = Object.freeze([
  [/^\/$/, "home"],
  [/^\/products$/, "products"],
  [/^\/products\/[^/]+$/, "product-detail"],
  [/^\/services$/, "services"],
  [/^\/services\/[^/]+$/, "service-detail"],
  [/^\/category\/[^/]+$/, "category"],
  [/^\/contact$/, "contact"],
  [/^\/checkout$/, "checkout"],
  [/^\/compare$/, "compare"],
  [/^\/favorites\/shared$/, "favorites-shared"],
  [/^\/deposit$/, "deposit"],
  [/^\/auth\/login$/, "auth-login"],
  [/^\/auth\/register$/, "auth-register"],
  [/^\/auth\/recover$/, "auth-recover"],
  [/^\/auth\/callback$/, "auth-callback"],
  [/^\/dashboard$/, "dashboard"],
  [/^\/dashboard\/orders$/, "dashboard-orders"],
  [/^\/dashboard\/favorites$/, "dashboard-favorites"],
  [/^\/dashboard\/profile$/, "dashboard-profile"],
  [/^\/dashboard\/notifications$/, "dashboard-notifications"],
  [/^\/dashboard\/deposit$/, "dashboard-deposit"],
  [/^\/dashboard\/wallet$/, "dashboard-wallet"],
]);

/**
 * Removes a trailing slash while keeping the root path intact.
 *
 * @param {string} pathname
 * @returns {string}
 */
function trimTrailingSlash(pathname) {
  if (!pathname || pathname === ROOT_PATH) {
    return ROOT_PATH;
  }

  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

/**
 * Normalizes a route href into a pathname suitable for module prefetching.
 *
 * @param {string} href
 * @returns {string}
 */
export function normalizeRoutePrefetchPath(href) {
  if (typeof href !== "string" || !href.trim() || href.startsWith("#")) {
    return "";
  }

  try {
    const url = new URL(href, "https://prefetch.techzone");
    return trimTrailingSlash(url.pathname || ROOT_PATH);
  } catch {
    return "";
  }
}

/**
 * Resolves the route key associated with a pathname.
 *
 * @param {string} pathname
 * @returns {string}
 */
export function matchRoutePrefetchKey(pathname) {
  const normalizedPath = normalizeRoutePrefetchPath(pathname);
  const matchedRule = ROUTE_PREFETCH_RULES.find(([pattern]) => pattern.test(normalizedPath));
  return matchedRule ? matchedRule[1] : "";
}
