/**
 * Cloudflare Pages Function for the Serva-S account balance.
 */

import { requireAdminAccess } from "../../_lib/adminAccess.js";
import { handlePreflight, withCors } from "../../_lib/cors.js";
import { getProviderBalance } from "../../_lib/providerApi.js";
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
 * Returns the provider balance for authorized admin users.
 *
 * @param {EventContext} context - Cloudflare Pages function context.
 * @returns {Promise<Response>} JSON response with provider balance.
 */
export async function onRequestGet(context) {
  const access = await requireAdminAccess(context.request, context.env);
  if (access.errorResponse) {
    return finalizeResponse(access.errorResponse, context.request);
  }

  const result = await getProviderBalance(context.env);
  if (!result.success) {
    return finalizeResponse(
      Response.json({ success: false, error: result.error }, { status: result.status ?? 502, headers: CACHE_CONTROL_HEADER }),
      context.request
    );
  }

  return finalizeResponse(
    Response.json(
      { success: true, balance: result.balance, currency: result.currency },
      { headers: CACHE_CONTROL_HEADER }
    ),
    context.request
  );
}

/**
 * Handles CORS preflight requests for the provider balance endpoint.
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
