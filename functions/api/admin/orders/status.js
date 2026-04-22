/**
 * Cloudflare Pages Function for admin order-status updates.
 */

import { requireAdminAccess } from '../../../_lib/adminAccess.js';
import { handlePreflight, withCors } from '../../../_lib/cors.js';
import {
  createSupabaseAdmin,
  errorResponse,
  successResponse,
} from '../../../_lib/supabase.js';
import {
  extractErrorCode,
  formatErrorMessage,
} from '../../../_lib/errorCodes.js';
import { withSecurityHeaders } from '../../../_lib/securityHeaders.js';
import {
  AdminOrderStatusError,
  updateAdminOrderStatus,
} from '../../../../services/adminOrderStatusService.js';

const ADMIN_ORDER_STATUS_METHODS = 'POST, OPTIONS';
const CACHE_CONTROL_HEADER = { 'Cache-Control': 'no-store, max-age=0' };
const INVALID_BODY_ERROR = formatErrorMessage('ORM-106', 'بيانات طلب تحديث الحالة غير صالحة.');
const UNEXPECTED_ERROR = formatErrorMessage('ORM-500', 'حدث خطأ غير متوقع أثناء تحديث حالة الطلب.');

/**
 * Adds the standard cache, CORS, and security headers to a response.
 *
 * @param {Response} response
 * @param {Request} request
 * @returns {Response}
 */
function finalizeResponse(response, request) {
  return withSecurityHeaders(
    withCors(response, request, ADMIN_ORDER_STATUS_METHODS),
    CACHE_CONTROL_HEADER
  );
}

/**
 * Parses the incoming JSON payload for the admin mutation request.
 *
 * @param {Request} request
 * @returns {Promise<Record<string, unknown>>}
 * @throws {AdminOrderStatusError}
 */
async function parseAdminOrderStatusBody(request) {
  try {
    return await request.json();
  } catch (error) {
    void error;
    throw new AdminOrderStatusError(INVALID_BODY_ERROR, 400);
  }
}

/**
 * Shapes the success payload returned to the admin UI.
 *
 * @param {Record<string, unknown>} result
 * @returns {Record<string, unknown>}
 */
function buildSuccessPayload(result) {
  return {
    orderId: result.orderId,
    targetType: result.targetType,
    status: result.status,
    refundAmount: Number(result.refundAmount || 0),
    auditError: result.auditError || null,
    notificationError: result.notificationError || null,
  };
}

/**
 * Resolves the best coded error message and HTTP status for a thrown error.
 *
 * @param {unknown} error
 * @returns {{ error: string, status: number }}
 */
function normalizeFailure(error) {
  const message = String(error?.message || '').trim();
  const hasCode = extractErrorCode(message);

  if (error instanceof AdminOrderStatusError || hasCode) {
    return {
      error: message || UNEXPECTED_ERROR,
      status: Number(error?.statusCode) || 400,
    };
  }

  return {
    error: UNEXPECTED_ERROR,
    status: 500,
  };
}

/**
 * Builds the request handlers with injectable dependencies for tests.
 *
 * @param {{
 *   requireAdminAccess?: typeof requireAdminAccess,
 *   createSupabaseAdmin?: typeof createSupabaseAdmin,
 *   errorResponse?: typeof errorResponse,
 *   successResponse?: typeof successResponse,
 *   updateAdminOrderStatus?: typeof updateAdminOrderStatus,
 * }} [dependencies={}]
 * @returns {{ onRequestPost: (context: EventContext) => Promise<Response>, onRequestOptions: (context: EventContext) => Response }}
 */
export function createAdminOrderStatusHandlers(dependencies = {}) {
  const requireAccess = dependencies.requireAdminAccess || requireAdminAccess;
  const createAdminClient = dependencies.createSupabaseAdmin || createSupabaseAdmin;
  const respondWithError = dependencies.errorResponse || errorResponse;
  const respondWithSuccess = dependencies.successResponse || successResponse;
  const applyAdminOrderStatus = dependencies.updateAdminOrderStatus || updateAdminOrderStatus;

  return {
    async onRequestPost(context) {
      const access = await requireAccess(context.request, context.env);
      if (access.errorResponse) {
        return finalizeResponse(access.errorResponse, context.request);
      }

      try {
        const payload = await parseAdminOrderStatusBody(context.request);
        const result = await applyAdminOrderStatus({
          client: createAdminClient(context.env),
          actor: {
            id: access.user?.id || null,
            email: access.user?.email || null,
          },
          payload,
        });

        return finalizeResponse(
          respondWithSuccess(buildSuccessPayload(result), 200),
          context.request
        );
      } catch (error) {
        const failure = normalizeFailure(error);
        console.error(failure.error, error);
        return finalizeResponse(
          respondWithError(failure.error, failure.status),
          context.request
        );
      }
    },

    onRequestOptions(context) {
      return withSecurityHeaders(
        handlePreflight(context.request, ADMIN_ORDER_STATUS_METHODS),
        CACHE_CONTROL_HEADER
      );
    },
  };
}

const handlers = createAdminOrderStatusHandlers();

export const onRequestPost = handlers.onRequestPost;
export const onRequestOptions = handlers.onRequestOptions;
