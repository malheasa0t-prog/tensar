/**
 * Cloudflare Pages Function for the Serva-S services catalog.
 */

import { requireAdminAccess } from "../../_lib/adminAccess.js";
import { handlePreflight, withCors } from "../../_lib/cors.js";
import { getProviderServices } from "../../_lib/providerApi.js";
import { withSecurityHeaders } from "../../_lib/securityHeaders.js";

const CACHE_CONTROL_HEADER = { "Cache-Control": "no-store, max-age=0" };
const PROVIDER_METHODS = "GET, OPTIONS";

/**
 * Adds the standard security and cache headers to a response.
 *
 * @param {Response} response - Route response.
 * @param {Request} request - Incoming request.
 * @returns {Response} Decorated response.
 */
function finalizeResponse(response, request) {
  return withSecurityHeaders(withCors(response, request, PROVIDER_METHODS), CACHE_CONTROL_HEADER);
}

/**
 * Returns the full Serva-S catalog for authorized admin users.
 *
 * @param {EventContext} context - Cloudflare Pages function context.
 * @returns {Promise<Response>} JSON response with provider catalog.
 */
export async function onRequestGet(context) {
  const access = await requireAdminAccess(context.request, context.env);
  if (access.errorResponse) {
    return finalizeResponse(access.errorResponse, context.request);
  }

  const result = await getProviderServices(context.env);
  if (!result.success) {
    return finalizeResponse(
      Response.json({ success: false, error: result.error }, { status: result.status ?? 502, headers: CACHE_CONTROL_HEADER }),
      context.request
    );
  }

  return finalizeResponse(
    Response.json(
      { success: true, count: result.services.length, services: result.services },
      { headers: CACHE_CONTROL_HEADER }
    ),
    context.request
  );
}

/**
 * Handles CORS preflight requests for the provider services endpoint.
 *
 * @param {EventContext} context - Cloudflare Pages function context.
 * @returns {Response} Preflight response.
 */
export function onRequestOptions(context) {
  return withSecurityHeaders(
    handlePreflight(context.request, PROVIDER_METHODS),
    CACHE_CONTROL_HEADER
  );
}
