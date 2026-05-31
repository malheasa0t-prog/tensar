/**
 * Strict hiding middleware for protected admin shell assets.
 */

import { requireAdminAccess } from "./_lib/adminAccess.js";
import { verifyAdminShellCookie } from "./_lib/adminShellCookie.js";
import { withSecurityHeaders } from "./_lib/securityHeaders.js";

const ADMIN_SHELL_PATHS = new Set(["/__tz-panel.html", "/tz-panel.html"]);
const RETIRED_ADMIN_CONFIG_PATH = "/admin-config.js";
const NOT_FOUND_CACHE_CONTROL = "private, no-store, max-age=0";

/**
 * Builds the generic hidden response for protected admin assets.
 *
 * @returns {Response}
 */
function hiddenNotFoundResponse() {
  const headers = { "Cache-Control": NOT_FOUND_CACHE_CONTROL };
  return withSecurityHeaders(new Response("Not Found", { headers, status: 404 }), headers);
}

/**
 * Checks the short-lived admin shell cookie created by `/api/admin/session`.
 *
 * @param {EventContext} context - Cloudflare Pages middleware context.
 * @returns {Promise<boolean>} True when the signed shell cookie is valid.
 */
async function hasValidAdminShellCookie(context) {
  const verifyShellCookie = context?.data?.verifyAdminShellCookie || verifyAdminShellCookie;

  try {
    return await verifyShellCookie({
      env: context?.env || {},
      request: context.request,
    });
  } catch (error) {
    console.error("[ADM-SHELL-401] Failed to verify admin shell cookie.", error);
    return false;
  }
}

/**
 * Validates the bearer session for first-time admin shell requests.
 *
 * @param {EventContext} context - Cloudflare Pages middleware context.
 * @returns {Promise<{ errorResponse: Response | null, user: Record<string, unknown> | null }>} Access result.
 */
async function verifyBearerAdminAccess(context) {
  const verifyAdminAccess = context?.data?.requireAdminAccess || requireAdminAccess;

  try {
    return await verifyAdminAccess(context.request, context.env || {});
  } catch (error) {
    console.error("[ADM-SHELL-402] Failed to verify bearer admin access.", error);
    return { errorResponse: new Response("Unauthorized", { status: 401 }), user: null };
  }
}

/**
 * Serves the protected shell asset with hardened no-store headers.
 *
 * @param {EventContext} context - Cloudflare Pages middleware context.
 * @returns {Promise<Response>} Protected static asset response.
 */
async function serveAdminShellAsset(context) {
  const response = await context.next();
  return withSecurityHeaders(response, { "Cache-Control": NOT_FOUND_CACHE_CONTROL });
}

/**
 * Validates the bearer session before serving the protected admin shell.
 *
 * @param {EventContext} context - Cloudflare Pages middleware context.
 * @returns {Promise<Response>}
 */
async function handleAdminShellAsset(context) {
  if (await hasValidAdminShellCookie(context)) {
    return serveAdminShellAsset(context);
  }

  const access = await verifyBearerAdminAccess(context);
  if (!access?.errorResponse) {
    return serveAdminShellAsset(context);
  }

  return hiddenNotFoundResponse();
}

/**
 * Routes protected static assets through real admin authorization.
 *
 * @param {EventContext} context - Cloudflare Pages middleware context.
 * @returns {Promise<Response>}
 */
export async function onRequest(context) {
  const url = new URL(context.request.url);

  if (ADMIN_SHELL_PATHS.has(url.pathname)) {
    return handleAdminShellAsset(context);
  }

  if (url.pathname === RETIRED_ADMIN_CONFIG_PATH) {
    return hiddenNotFoundResponse();
  }

  const response = await context.next();
  return withSecurityHeaders(response);
}

export {
  hasValidAdminShellCookie,
  hiddenNotFoundResponse,
  serveAdminShellAsset,
  verifyBearerAdminAccess,
};
