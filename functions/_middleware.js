/**
 * Strict Hiding Mode Middleware
 * 
 * Intercepts requests at the Cloudflare Edge to protect internal admin panel
 * assets from reconnaissance and direct browser access.
 */
export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);

  // Protected internal assets that should only be loaded via the auth gate or service worker
  if (url.pathname === '/__tz-panel.html' || url.pathname === '/admin-config.js') {
    const dest = request.headers.get('sec-fetch-dest');
    const mode = request.headers.get('sec-fetch-mode');
    const referer = request.headers.get('referer');

    // Detect direct browser navigation (typing the URL directly or clicking a raw link)
    const isDirectNavigation = mode === 'navigate' || dest === 'document';
    
    // Require same-origin referer for non-serviceworker requests
    const isMissingReferer = !referer || !referer.startsWith(url.origin);

    if (isDirectNavigation || (isMissingReferer && dest !== 'serviceworker' && dest !== 'empty' && dest !== 'script')) {
      // Strictly hide existence
      return new Response('Not Found', { status: 404 });
    }
  }

  return next();
}
