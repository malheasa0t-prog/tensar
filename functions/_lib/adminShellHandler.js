/**
 * Shared request handler for the legacy admin shell routes.
 *
 * @module functions/_lib/adminShellHandler
 */

import { evaluateAdminShellAccess } from "./adminShellGate.js";
import { withSecurityHeaders } from "./securityHeaders.js";

const ADMIN_SHELL_CACHE_CONTROL = "no-store, max-age=0";
const ADMIN_SHELL_DENIED_BODY = "Not found";
const ADMIN_SHELL_DENIED_STATUS = 404;
const ADMIN_SHELL_ROBOTS_TAG = "noindex, nofollow, noarchive";

/**
 * Builds the shared response headers for admin shell responses.
 *
 * @returns {Record<string, string>} Cache and crawler directives.
 */
function buildAdminShellHeaders() {
  return {
    "Cache-Control": ADMIN_SHELL_CACHE_CONTROL,
    "X-Robots-Tag": ADMIN_SHELL_ROBOTS_TAG,
  };
}

/**
 * Creates one generic deny response for anonymous admin shell requests.
 *
 * @returns {Response} Not-found response with hardened headers.
 */
function buildDeniedAdminShellResponse() {
  const headers = buildAdminShellHeaders();
  return withSecurityHeaders(
    new Response(ADMIN_SHELL_DENIED_BODY, { headers, status: ADMIN_SHELL_DENIED_STATUS }),
    headers
  );
}

/**
 * Applies the admin shell gate before serving the legacy HTML shell.
 *
 * @param {EventContext} context - Cloudflare Pages request context.
 * @returns {Promise<Response>} Guarded response for the admin shell route.
 */
async function handleAdminShellRequest(context) {
  const access = evaluateAdminShellAccess({
    env: context?.env,
    request: context?.request,
  });
  if (!access.allowed) {
    return buildDeniedAdminShellResponse();
  }

  const headers = buildAdminShellHeaders();
  const response = await context.next();
  return withSecurityHeaders(response, headers);
}

export {
  buildAdminShellHeaders,
  buildDeniedAdminShellResponse,
  handleAdminShellRequest,
};
