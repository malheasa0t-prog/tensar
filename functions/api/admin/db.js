/**
 * Cloudflare Pages Function for secured admin database operations.
 */

import { requireAdminAccess } from "../../_lib/adminAccess.js";
import { handlePreflight, withCors } from "../../_lib/cors.js";
import {
  createSupabaseAdmin,
  errorResponse,
  successResponse,
} from "../../_lib/supabase.js";
import { withSecurityHeaders } from "../../_lib/securityHeaders.js";
import {
  executeAdminOperation,
  parseAdminDbBody,
} from "./dbOperations.js";

const ADMIN_DB_METHODS = "POST, OPTIONS";
const CACHE_CONTROL_HEADER = { "Cache-Control": "no-store, max-age=0" };

/**
 * Finalizes one admin DB response with cache, security, and CORS headers.
 *
 * @param {Response} response
 * @param {Request} request
 * @returns {Response}
 */
function finalizeResponse(response, request) {
  return withSecurityHeaders(
    withCors(response, request, ADMIN_DB_METHODS),
    CACHE_CONTROL_HEADER,
  );
}

/**
 * Builds the request handlers with injectable dependencies for tests.
 *
 * @param {{
 *   createSupabaseAdmin?: typeof createSupabaseAdmin,
 *   errorResponse?: typeof errorResponse,
 *   requireAdminAccess?: typeof requireAdminAccess,
 *   successResponse?: typeof successResponse
 * }} [dependencies={}]
 * @returns {{ onRequestOptions: (context: EventContext) => Response, onRequestPost: (context: EventContext) => Promise<Response> }}
 */
export function createAdminDbHandlers(dependencies = {}) {
  const createAdminClient = dependencies.createSupabaseAdmin || createSupabaseAdmin;
  const requireAccess = dependencies.requireAdminAccess || requireAdminAccess;
  const respondWithError = dependencies.errorResponse || errorResponse;
  const respondWithSuccess = dependencies.successResponse || successResponse;

  return {
    async onRequestPost(context) {
      const access = await requireAccess(context.request, context.env);
      if (access.errorResponse) {
        return finalizeResponse(access.errorResponse, context.request);
      }

      try {
        const operation = await parseAdminDbBody(context.request);
        const enforcement = access.context
          ? { ...access.context, userId: String(access.user?.id || "") }
          : null;
        const result = await executeAdminOperation(createAdminClient(context.env), operation, enforcement);
        const status = result.error ? 400 : 200;
        const response = result.error
          ? respondWithError(result.error.message, status)
          : respondWithSuccess({ count: result.count, data: result.data }, status);

        return finalizeResponse(response, context.request);
      } catch (error) {
        const status = Number(error?.statusCode) || 500;
        const message = status >= 500
          ? "[ADB-500] حدث خطأ غير متوقع أثناء تنفيذ عملية الأدمن."
          : String(error?.message || "[ADB-109] تعذر تنفيذ عملية الأدمن المطلوبة.");

        console.error(message, error);
        return finalizeResponse(respondWithError(message, status), context.request);
      }
    },

    onRequestOptions(context) {
      return withSecurityHeaders(
        handlePreflight(context.request, ADMIN_DB_METHODS),
        CACHE_CONTROL_HEADER,
      );
    },
  };
}

const handlers = createAdminDbHandlers();

export const onRequestPost = handlers.onRequestPost;
export const onRequestOptions = handlers.onRequestOptions;
