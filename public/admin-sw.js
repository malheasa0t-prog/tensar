const CACHE_NAME = 'tz-admin-shell-20260417-1';
const SYNC_TAG = 'tz-admin-sync';
const PRECACHE_URLS = [
    '/admin.html',
    '/fonts/fonts.css',
    '/fonts/cairo-arabic-wght-normal.woff2',
    '/fonts/cairo-latin-ext-wght-normal.woff2',
    '/fonts/cairo-latin-wght-normal.woff2',
    '/fonts/inter-latin-ext-wght-normal.woff2',
    '/fonts/inter-latin-wght-normal.woff2',
    '/css/variables.css?v=20260417-1',
    '/css/base.css?v=20260417-1',
    '/css/utilities.css?v=20260417-1',
    '/css/admin/layout.css?v=20260417-1',
    '/css/admin/components.css?v=20260417-1',
    '/css/admin/responsive.css?v=20260417-1',
    '/css/admin/cards.css',
    '/css/admin/dashboard.css',
    '/css/admin/tables.css',
    '/css/admin/modals.css',
    '/css/admin/buttons.css',
    '/css/admin/forms.css',
    '/css/admin/filters.css',
    '/css/admin/search.css',
    '/css/admin/bulk-actions.css',
    '/css/admin/table-enhancements.css',
    '/css/admin/shell-enhancements.css',
    '/css/admin/surfaces.css',
    '/css/admin/inputs.css',
    '/css/admin/responsive-overrides.css',
    '/css/admin/accessories.css',
    '/css/admin/orders.css',
    '/css/admin/notifications.css',
    '/css/admin/chats.css',
    '/admin-config.js?v=20260417-1',
    '/js/admin/bootstrap.js?v=20260417-1',
    '/js/admin/core.js?v=20260417-1',
    '/js/admin/global-search.helpers.js?v=20260417-1',
    '/js/admin/global-search.js?v=20260417-1',
    '/js/admin/bulk-actions.helpers.js?v=20260417-1',
    '/js/admin/bulk-actions.js?v=20260417-1',
    '/js/admin/table-enhancements.helpers.js?v=20260417-1',
    '/js/admin/table-enhancements.js?v=20260417-1',
    '/js/admin/admin-shell.helpers.js?v=20260417-1',
    '/js/admin/admin-shell.js?v=20260417-1',
    '/js/admin/dashboard.js?v=20260417-1',
    '/js/admin/orders.js?v=20260417-1',
    '/js/admin/products.js?v=20260417-1',
    '/js/admin/accessories.js?v=20260417-1',
    '/js/admin/categories.js?v=20260417-1',
    '/js/admin/services.js?v=20260417-1',
    '/js/admin/messages.js?v=20260417-1',
    '/js/admin/notifications.helpers.js?v=20260417-1',
    '/js/admin/notifications.js?v=20260417-1',
    '/js/admin/chats.helpers.js?v=20260417-1',
    '/js/admin/chats.js?v=20260417-1',
    '/js/admin/customers.js?v=20260417-1',
    '/js/admin/coupons.js?v=20260417-1',
    '/js/admin/settings-promo-banners.js?v=20260417-1',
    '/js/admin/settings.js?v=20260417-1',
    '/js/admin/logs.js?v=20260417-1',
    '/js/admin/deposits.js?v=20260417-1',
    '/js/admin/data-engine.js?v=20260417-1',
    '/js/admin/data-engine/core.js',
    '/js/admin/data-engine/users.js',
    '/js/admin/data-engine/products.js',
    '/js/admin/data-engine/orders.js',
    '/js/admin/data-engine/loaders.js',
    '/js/admin/data-engine/realtime.js',
    '/js/admin/data-engine/sync.js',
    '/js/admin/data-engine/offline.js',
    '/api/admin/runtime',
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css'
];

function shouldHandleRequest(requestUrl) {
    return requestUrl.origin === self.location.origin
        && (
            requestUrl.pathname === '/admin.html'
            || requestUrl.pathname === '/admin-config.js'
            || requestUrl.pathname === '/api/admin/runtime'
            || requestUrl.pathname.startsWith('/css/admin/')
            || requestUrl.pathname.startsWith('/css/')
            || requestUrl.pathname.startsWith('/fonts/')
            || requestUrl.pathname.startsWith('/js/admin/')
        );
}

self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);
        await Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url)));
        await self.skipWaiting();
    })());
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const cacheNames = await caches.keys();
        await Promise.all(
            cacheNames
                .filter((cacheName) => cacheName !== CACHE_NAME)
                .map((cacheName) => caches.delete(cacheName))
        );
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') {
        return;
    }

    const requestUrl = new URL(event.request.url);
    if (!shouldHandleRequest(requestUrl)) {
        return;
    }

    const isDocumentRequest = event.request.mode === 'navigate' || event.request.destination === 'document';

    event.respondWith((async () => {
        const cache = await caches.open(CACHE_NAME);
        const cachedResponse = await cache.match(event.request);

        if (!isDocumentRequest && cachedResponse) {
            event.waitUntil(fetch(event.request).then((response) => {
                if (response && response.ok) {
                    return cache.put(event.request, response.clone());
                }
                return null;
            }).catch(() => null));
            return cachedResponse;
        }

        try {
            const networkResponse = await fetch(event.request);
            if (networkResponse && networkResponse.ok) {
                await cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
        } catch (error) {
            if (cachedResponse) {
                return cachedResponse;
            }
            throw error;
        }
    })());
});

self.addEventListener('sync', (event) => {
    if (event.tag !== SYNC_TAG) {
        return;
    }

    event.waitUntil((async () => {
        const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
        clients.forEach((client) => {
            client.postMessage({ type: 'tz-admin-sync-request' });
        });
    })());
});
