const CACHE_VERSION = '2026-05-25-auth-redirect-v2';
const CACHE_PREFIX = 'techzone-';
const SHELL_CACHE = `${CACHE_PREFIX}shell-${CACHE_VERSION}`;
const ASSET_CACHE = `${CACHE_PREFIX}assets-${CACHE_VERSION}`;
const SHELL_URLS = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg', '/opengraph-image.svg'];
const AUTH_PATH_PATTERN = /^\/auth(?:\/|$)/;

/**
 * Stores the application shell required for offline navigation.
 *
 * @returns {Promise<void>}
 */
async function warmShellCache() {
  const cache = await caches.open(SHELL_CACHE);
  await cache.addAll(SHELL_URLS);
}

/**
 * Deletes old caches after a new service worker version activates.
 *
 * @returns {Promise<void>}
 */
async function clearLegacyCaches() {
  const cacheKeys = await caches.keys();
  const staleKeys = cacheKeys.filter((key) => key.startsWith(CACHE_PREFIX) && ![SHELL_CACHE, ASSET_CACHE].includes(key));
  await Promise.all(staleKeys.map((key) => caches.delete(key)));
}

/**
 * Returns a cached navigation response when the network is unavailable.
 *
 * @returns {Promise<Response>}
 */
async function getOfflineNavigationResponse() {
  const cache = await caches.open(SHELL_CACHE);
  return (await cache.match('/')) || (await cache.match('/index.html')) || Response.error();
}

/**
 * Handles SPA navigations with a network-first strategy.
 *
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function handleNavigationRequest(request) {
  try {
    const response = await fetch(request);
    const requestUrl = new URL(request.url);

    if (!AUTH_PATH_PATTERN.test(requestUrl.pathname)) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(request, response.clone());
    }

    return response;
  } catch {
    return getOfflineNavigationResponse();
  }
}

/**
 * Handles same-origin static assets with stale-while-revalidate caching.
 *
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function handleStaticAssetRequest(request) {
  const cache = await caches.open(ASSET_CACHE);

  try {
    const response = await fetch(request);

    if (response.ok) {
      cache.put(request, response.clone());
    }

    return response;
  } catch {
    return (await cache.match(request)) || Response.error();
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(warmShellCache());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(Promise.all([clearLegacyCaches(), self.clients.claim()]));
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  const requestUrl = new URL(event.request.url);
  const isSameOrigin = requestUrl.origin === self.location.origin;

  if (!isSameOrigin || requestUrl.pathname.startsWith('/api/')) {
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(event.request));
    return;
  }

  const isStaticAsset = requestUrl.pathname.startsWith('/assets/') || ['font', 'image', 'script', 'style', 'worker'].includes(event.request.destination);

  if (isStaticAsset) {
    event.respondWith(handleStaticAssetRequest(event.request));
  }
});
