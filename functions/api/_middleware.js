import {
  applyApiRateLimit,
  buildRateLimitExceededResponse,
} from "../_lib/rateLimit.js";
import { withSecurityHeaders } from "../_lib/securityHeaders.js";

/**
 * Applies API rate limiting and dynamic security headers to all API routes.
 *
 * @param {EventContext} context - The Pages Functions request context.
 * @returns {Promise<Response>} The secured response.
 */
export async function onRequest(context) {
  const { env, request } = context;

  if (request.method !== "OPTIONS") {
    const rateLimit = await applyApiRateLimit({ request, env });

    if (!rateLimit.allowed) {
      return withSecurityHeaders(
        buildRateLimitExceededResponse(rateLimit.headers)
      );
    }

    const response = await context.next();
    return withSecurityHeaders(response, rateLimit.headers);
  }

  const response = await context.next();
  return withSecurityHeaders(response);
}
