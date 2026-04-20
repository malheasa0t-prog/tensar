/**
 * Shared lazy route loaders and hover prefetch helpers.
 */

import {
  matchRoutePrefetchKey,
  normalizeRoutePrefetchPath,
} from "@/lib/routePrefetchModel";

export const routeModuleLoaders = Object.freeze({
  home: () => import("@/app/page"),
  products: () => import("@/app/products/page"),
  "product-detail": () => import("@/app/products/[id]/page"),
  services: () => import("@/app/services/page"),
  "service-detail": () => import("@/app/services/[slug]/page"),
  category: () => import("@/app/category/[id]/page"),
  contact: () => import("@/app/contact/page"),
  checkout: () => import("@/app/checkout/page"),
  compare: () => import("@/app/compare/page"),
  "favorites-shared": () => import("@/app/favorites/shared/page"),
  accessories: () => import("@/app/accessories/page"),
  subscriptions: () => import("@/app/subscriptions/page"),
  deposit: () => import("@/app/deposit/page"),
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

const pendingRoutePrefetches = new Map();

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
 * @returns {Promise<unknown>}
 */
export function prefetchRouteModule(href) {
  const routeKey = matchRoutePrefetchKey(normalizeRoutePrefetchPath(href));

  if (!routeKey || !routeModuleLoaders[routeKey]) {
    return Promise.resolve(null);
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
