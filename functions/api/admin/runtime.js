/**
 * Cloudflare Pages Function for the legacy admin runtime config.
 */

import { buildErrorPayload, formatErrorMessage } from "../../_lib/errorCodes.js";
import { handlePreflight, withCors } from "../../_lib/cors.js";
import { withSecurityHeaders } from "../../_lib/securityHeaders.js";
import { getAdminRuntimeConfig } from "../../../lib/adminRuntimeConfig.js";

const ADMIN_RUNTIME_METHODS = "GET, OPTIONS";
const NO_STORE_CACHE_CONTROL = "no-store, max-age=0";
const UNAVAILABLE_RUNTIME_MESSAGE = "Admin runtime config is unavailable.";

/**
 * Returns the public legacy admin runtime config for browser bootstrap.
 *
 * @param {EventContext} context - Cloudflare Pages function context.
 * @returns {Response} JSON response containing success state and public config values.
 */
export function onRequestGet(context) {
  const env = context?.env ?? process.env;
  const headers = { "Cache-Control": NO_STORE_CACHE_CONTROL };

  try {
    const config = getAdminRuntimeConfig(env);
    const response = Response.json({ success: true, ...config }, { headers });
    return withSecurityHeaders(withCors(response, context.request, ADMIN_RUNTIME_METHODS), headers);
  } catch (error) {
    const message = error instanceof Error ? error.message : UNAVAILABLE_RUNTIME_MESSAGE;
    const payload = buildErrorPayload(formatErrorMessage("ADR-500", message));
    console.error("[ADR-500] Failed to load admin runtime config:", error);
    const response = Response.json(payload, { status: 503, headers });
    return withSecurityHeaders(withCors(response, context.request, ADMIN_RUNTIME_METHODS), headers);
  }
}

/**
 * Handles preflight requests for the legacy admin runtime endpoint.
 *
 * @param {EventContext} context - Cloudflare Pages function context.
 * @returns {Response} Preflight response with security headers.
 */
export function onRequestOptions(context) {
  return withSecurityHeaders(
    handlePreflight(context.request, ADMIN_RUNTIME_METHODS),
    { "Cache-Control": NO_STORE_CACHE_CONTROL }
  );
}
