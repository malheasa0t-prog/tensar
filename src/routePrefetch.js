/**
 * Shared lazy route loaders and hover prefetch helpers.
 */

import {
  createCachedRouteModuleLoader,
  matchRoutePrefetchKey,
  normalizeRoutePrefetchPath,
} from "@/lib/routePrefetchModel";

const uncachedRouteModuleLoaders = Object.freeze({
  home: () => import("@/app/page"),
  services: () => import("@/app/services/page"),
  "service-detail": () => import("@/app/services/[slug]/page"),
  category: () => import("@/app/category/[id]/page"),
  contact: () => import("@/app/contact/page"),
  checkout: () => import("@/app/checkout/page"),
  compare: () => import("@/app/compare/page"),
  "favorites-shared": () => import("@/app/favorites/shared/page"),
  deposit: () => import("@/app/deposit/page"),
  track: () => import("@/app/track/page"),
  "auth-login": () => import("@/app/auth/login/page"),
  "auth-register": () => import("@/app/auth/register/page"),
  "auth-recover": () => import("@/app/auth/recover/page"),
  "auth-callback": () => import("@/app/auth/callback/page"),
  dashboard: () => import("@/app/dashboard/page"),
  "dashboard-orders": () => import("@/app/dashboard/orders/page"),
  "dashboard-favorites": () => import("@/app/dashboard/favorites/page"),
  "dashboard-profile": () => import("@/app/dashboard/profile/page"),
  "dashboard-notifications": () => import("@/app/dashboard/notifications/page"),
  "dashboard-deposit": () => import("@/app/dashboard/deposit/page"),
  "dashboard-wallet": () => import("@/app/dashboard/wallet/page"),
});

export const routeModuleLoaders = Object.freeze(
  Object.fromEntries(
    Object.entries(uncachedRouteModuleLoaders).map(([routeKey, loadModule]) => [
      routeKey,
      createCachedRouteModuleLoader(loadModule),
    ])
  )
);

const pendingRoutePrefetches = new Map();
const pendingRouteDataPrefetches = new Map();

/**
 * Returns whether the provided href maps to a lazy route module.
 *
 * @param {string} href
 * @returns {boolean}
 */
export function shouldPrefetchRoute(href) {
  return Boolean(matchRoutePrefetchKey(href));
}

/**
 * Loads the matching route module once and reuses the same promise afterwards.
 *
 * @param {string} href
 * @param {{ includeData?: boolean }} [options]
 * @returns {Promise<unknown>}
 */
export function prefetchRouteModule(href, options = {}) {
  const normalizedPath = normalizeRoutePrefetchPath(href);
  const routeKey = matchRoutePrefetchKey(normalizedPath);

  if (!routeKey || !routeModuleLoaders[routeKey]) {
    return Promise.resolve(null);
  }

  if (options.includeData !== false) {
    prefetchRouteData({ href: normalizedPath, routeKey });
  }

  if (pendingRoutePrefetches.has(routeKey)) {
    return pendingRoutePrefetches.get(routeKey);
  }

  const pendingPromise = routeModuleLoaders[routeKey]().catch((error) => {
    pendingRoutePrefetches.delete(routeKey);
    throw error;
  });

  pendingRoutePrefetches.set(routeKey, pendingPromise);
  return pendingPromise;
}

/**
 * Starts a route-aware data prefetch for data-heavy storefront pages.
 *
 * @param {{ href: string, routeKey: string }} input
 * @returns {void}
 */
function prefetchRouteData(input) {
  const prefetchKey = `${input.routeKey}:${input.href}`;

  if (pendingRouteDataPrefetches.has(prefetchKey)) {
    return;
  }

  const pendingPromise = loadRouteData(input)
    .catch(() => null)
    .finally(() => pendingRouteDataPrefetches.delete(prefetchKey));

  pendingRouteDataPrefetches.set(prefetchKey, pendingPromise);
}

/**
 * Loads the data snapshot that matches a prefetched route.
 *
 * @param {{ href: string, routeKey: string }} input
 * @returns {Promise<unknown>}
 */
async function loadRouteData(input) {
  if (input.routeKey === "category") {
    const module = await import("@/services/categoryPageService");
    return module.prefetchCategoryPageSnapshot(getLastPathSegment(input.href));
  }

  return null;
}

/**
 * Extracts the route parameter at the end of a pathname.
 *
 * @param {string} pathname
 * @returns {string}
 */
function getLastPathSegment(pathname) {
  const segments = String(pathname || "").split("/").filter(Boolean);
  return segments.at(-1) || "";
}
