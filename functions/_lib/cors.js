/**
 * Shared CORS configuration for Cloudflare Pages Functions.
 *
 * Restricts cross-origin requests to known production domains
 * instead of allowing all origins with '*'.
 *
 * @module functions/_lib/cors
 */

/* ─── Allowed Origins ─── */

const ALLOWED_ORIGINS = [
  'https://tensr.systems',
  'https://tensar.pages.dev',
  'http://localhost:5173',
  'http://localhost:4173',
];

/* ─── Helpers ─── */

/**
 * Determines whether the request origin is in the allow-list.
 *
 * @param {Request} request - The incoming request.
 * @returns {string} The allowed origin or empty string.
 */
function resolveOrigin(request) {
  const origin = request?.headers?.get('Origin') || '';
  return ALLOWED_ORIGINS.includes(origin) ? origin : '';
}

/**
 * Builds CORS headers for the given request.
 *
 * @param {Request} request - The incoming request.
 * @param {string} [methods='POST, OPTIONS'] - Allowed HTTP methods.
 * @returns {Record<string, string>} CORS headers object.
 */
function buildCorsHeaders(request, methods = 'POST, OPTIONS') {
  return {
    'Access-Control-Allow-Origin': resolveOrigin(request),
    'Access-Control-Allow-Methods': methods,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin',
  };
}

/**
 * Returns a 204 preflight response with appropriate CORS headers.
 *
 * @param {Request} request - The incoming request.
 * @param {string} [methods='POST, OPTIONS'] - Allowed HTTP methods.
 * @returns {Response} The preflight response.
 */
function handlePreflight(request, methods = 'POST, OPTIONS') {
  return new Response(null, {
    status: 204,
    headers: buildCorsHeaders(request, methods),
  });
}

/**
 * Attaches CORS headers to an existing response.
 *
 * @param {Response} response - The response to augment.
 * @param {Request} request - The original request (for origin check).
 * @param {string} [methods='POST, OPTIONS'] - Allowed HTTP methods.
 * @returns {Response} A new response with CORS headers applied.
 */
function withCors(response, request, methods = 'POST, OPTIONS') {
  const headers = new Headers(response.headers);
  const cors = buildCorsHeaders(request, methods);
  Object.entries(cors).forEach(([k, v]) => headers.set(k, v));
  return new Response(response.body, { status: response.status, headers });
}

export { ALLOWED_ORIGINS, buildCorsHeaders, handlePreflight, withCors };
