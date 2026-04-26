/**
 * Shared checkout CORS helpers.
 */

import { handlePreflight, withCors } from "../_lib/cors.js";

const CHECKOUT_METHODS = "POST, OPTIONS";

/**
 * Applies the checkout CORS policy to one response.
 *
 * @param {{ request: Request, response: Response }} input
 * @returns {Response} Response with restricted CORS headers.
 */
export function finalizeCheckoutResponse(input) {
  return withCors(input.response, input.request, CHECKOUT_METHODS);
}

/**
 * Handles CORS preflight requests for the checkout endpoint.
 *
 * @param {EventContext} context
 * @returns {Response} Restricted preflight response.
 */
export function onRequestOptions(context) {
  return handlePreflight(context.request, CHECKOUT_METHODS);
}
