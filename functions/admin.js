/**
 * Cloudflare Pages Function redirect for the `/admin` route.
 */

import { withSecurityHeaders } from "./_lib/securityHeaders.js";

const ADMIN_GATE_PATHNAME = "/admin.html";
const ADMIN_REDIRECT_STATUS = 302;
const ADMIN_REDIRECT_CACHE_CONTROL = "private, no-store, max-age=0";
const ADMIN_ROBOTS_TAG = "noindex, nofollow, noarchive";

/**
 * Builds the hardened redirect headers for admin shell entry requests.
 *
 * @param {URL} url - Current request URL.
 * @returns {Record<string, string>} Redirect and cache headers.
 */
function buildAdminRedirectHeaders(url) {
  const redirectUrl = new URL(ADMIN_GATE_PATHNAME, url);
  redirectUrl.search = url.search;

  return {
    Location: redirectUrl.toString(),
    "Cache-Control": ADMIN_REDIRECT_CACHE_CONTROL,
    "X-Robots-Tag": ADMIN_ROBOTS_TAG,
  };
}

/**
 * Redirects `/admin` to the current admin gate page.
 *
 * @param {EventContext} context - Cloudflare Pages request context.
 * @returns {Response} Hardened redirect response.
 */
export function onRequest(context) {
  const url = new URL(context.request.url);
  const headers = buildAdminRedirectHeaders(url);

  return withSecurityHeaders(new Response(null, { headers, status: ADMIN_REDIRECT_STATUS }), headers);
}

export { buildAdminRedirectHeaders };
