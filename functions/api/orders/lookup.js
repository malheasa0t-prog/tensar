/**
 * Public order lookup endpoint for repair and delivery requests.
 */

import { handlePreflight, withCors } from "../../_lib/cors.js";
import {
  createSupabaseAdmin,
  errorResponse,
  successResponse,
} from "../../_lib/supabase.js";
import {
  applyApiRateLimit,
  buildRateLimitConfigurationErrorResponse,
  buildRateLimitExceededResponse,
} from "../../_lib/rateLimit.js";
import { lookupPublicOrderByNumber } from "../../../services/orderLookupService.js";

const LOOKUP_NOT_FOUND_ERROR = "[OLK-404] لم نجد طلبًا مطابقًا لهذه البيانات.";
const LOOKUP_PARSE_ERROR = "[OLK-102] تعذر قراءة بيانات الاستعلام.";
const LOOKUP_UNEXPECTED_ERROR = "[OLK-500] تعذر إتمام الاستعلام حاليًا.";

/**
 * Adds CORS and rate-limit headers to an API response.
 *
 * @param {{ extraHeaders?: Record<string, string>, request: Request, response: Response }} input
 * @returns {Response} Response with public API headers.
 */
function finalizeLookupResponse(input) {
  const headers = new Headers(input.response.headers);
  Object.entries(input.extraHeaders || {}).forEach(([name, value]) => {
    headers.set(name, value);
  });

  return withCors(
    new Response(input.response.body, {
      status: input.response.status,
      headers,
    }),
    input.request
  );
}

/**
 * Reads and validates the JSON lookup request body.
 *
 * @param {Request} request - Incoming request.
 * @returns {Promise<Record<string, unknown>>} Parsed request body.
 * @throws {Error} When JSON parsing fails.
 */
async function readLookupBody(request) {
  try {
    return await request.json();
  } catch (error) {
    void error;
    throw new Error(LOOKUP_PARSE_ERROR);
  }
}

/**
 * Creates the POST handler with injectable dependencies for tests.
 *
 * @param {{
 *   applyApiRateLimit?: typeof applyApiRateLimit,
 *   createSupabaseAdmin?: typeof createSupabaseAdmin,
 *   lookupPublicOrderByNumber?: typeof lookupPublicOrderByNumber,
 * }} [dependencies]
 * @returns {(context: EventContext) => Promise<Response>} POST handler.
 */
export function createOrderLookupHandler(dependencies = {}) {
  const rateLimit = dependencies.applyApiRateLimit || applyApiRateLimit;
  const createAdmin = dependencies.createSupabaseAdmin || createSupabaseAdmin;
  const lookupOrder = dependencies.lookupPublicOrderByNumber || lookupPublicOrderByNumber;

  return async function onRequestPost(context) {
    const { env, request } = context;
    const limit = await rateLimit({ env, request });
    if (limit.configurationError) {
      return finalizeLookupResponse({
        extraHeaders: limit.headers,
        request,
        response: buildRateLimitConfigurationErrorResponse(limit.headers),
      });
    }

    if (!limit.allowed) {
      return finalizeLookupResponse({
        extraHeaders: limit.headers,
        request,
        response: buildRateLimitExceededResponse(limit.headers),
      });
    }

    try {
      const body = await readLookupBody(request);
      const result = await lookupOrder({
        adminClient: createAdmin(env),
        contactSuffix: body.contactSuffix,
        lookupType: body.lookupType,
        orderNumber: body.orderNumber,
      });

      return finalizeLookupResponse({
        extraHeaders: limit.headers,
        request,
        response: result ? successResponse(result) : errorResponse(LOOKUP_NOT_FOUND_ERROR, 404),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const isClientError = /^\[[A-Z]{2,4}-\d{3}\]/.test(message);

      if (!isClientError) {
        console.error("[OLK-500] Order lookup failed.", error);
      }

      return finalizeLookupResponse({
        extraHeaders: limit.headers,
        request,
        response: errorResponse(isClientError ? message : LOOKUP_UNEXPECTED_ERROR, isClientError ? 400 : 500),
      });
    }
  };
}

export const onRequestPost = createOrderLookupHandler();

/**
 * Handles CORS preflight requests.
 *
 * @param {EventContext} context
 * @returns {Response} Preflight response.
 */
export function onRequestOptions(context) {
  return handlePreflight(context.request);
}
