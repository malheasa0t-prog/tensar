/**
 * Shared security headers for Cloudflare Pages Functions responses.
 *
 * @module functions/_lib/securityHeaders
 */

const BASE_SECURITY_HEADERS = Object.freeze({
  "Permissions-Policy": "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
});

/**
 * Builds the shared security headers for dynamic responses.
 *
 * @param {Record<string, string>} [extraHeaders={}] - Additional headers to append.
 * @returns {Record<string, string>} The merged security headers.
 */
function buildSecurityHeaders(extraHeaders = {}) {
  return {
    ...BASE_SECURITY_HEADERS,
    ...extraHeaders,
  };
}

/**
 * Attaches the shared security headers to an existing response.
 *
 * @param {Response} response - The response to augment.
 * @param {Record<string, string>} [extraHeaders={}] - Additional headers to append.
 * @returns {Response} A cloned response with merged security headers.
 */
function withSecurityHeaders(response, extraHeaders = {}) {
  const headers = new Headers(response.headers);
  const securityHeaders = buildSecurityHeaders(extraHeaders);

  Object.entries(securityHeaders).forEach(([name, value]) => {
    headers.set(name, value);
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export { BASE_SECURITY_HEADERS, buildSecurityHeaders, withSecurityHeaders };
