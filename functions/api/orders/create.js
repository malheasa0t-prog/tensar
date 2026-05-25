/**
 * Cloudflare Pages Function for creating digital service orders.
 */

import { createProviderOrder } from "../../_lib/providerApi.js";
import { withIdempotency } from "../../_lib/idempotency.js";
import {
  applyApiRateLimit,
  buildRateLimitConfigurationErrorResponse,
  buildRateLimitExceededResponse,
} from "../../_lib/rateLimit.js";
import { createSupabaseAdmin, extractBearerToken, errorResponse, successResponse } from "../../_lib/supabase.js";

const ORDER_MESSAGES = Object.freeze({
  BANNED: "حسابك محظور. تواصل مع الإدارة.",
  INACTIVE_SERVICE: "هذه الخدمة غير متوفرة حاليًا",
  INSUFFICIENT_BALANCE: "رصيدك غير كافٍ. يرجى شحن المحفظة أولًا.",
  INVALID_REQUEST: "البيانات غير مكتملة: service_id, quantity, user_token مطلوبة",
  SERVICE_NOT_FOUND: "الخدمة غير موجودة",
  SUCCESS: "تم إنشاء الطلب بنجاح!",
  SUCCESS_TITLE: "تم إنشاء طلبك بنجاح",
  UNAUTHORIZED: "غير مصرح - يجب تسجيل الدخول",
  UNEXPECTED: "حدث خطأ غير متوقع",
});

/**
 * Adds operational headers to one service-order response.
 *
 * @param {Response} response
 * @param {Record<string, string>} headersToApply
 * @returns {Response}
 */
function withOperationalHeaders(response, headersToApply = {}) {
  const headers = new Headers(response.headers);
  Object.entries(headersToApply).forEach(([name, value]) => headers.set(name, value));
  return new Response(response.body, { status: response.status, headers });
}

/**
 * Validates that a value is a positive number.
 *
 * @param {unknown} value - Raw quantity value.
 * @returns {number | null} Normalized number or null for invalid input.
 */
function asPositiveNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : null;
}

/**
 * Returns the bearer token from the request Authorization header.
 *
 * @param {Request} request - Incoming HTTP request.
 * @returns {string} Auth token or an empty string.
 */
function getAuthToken(request) {
  return extractBearerToken(request) || "";
}

/**
 * Builds the localized quantity validation message.
 *
 * @param {number} minQuantity - Minimum allowed quantity.
 * @param {number} maxQuantity - Maximum allowed quantity.
 * @returns {string} Localized quantity-range message.
 */
function buildQuantityRangeMessage(minQuantity, maxQuantity) {
  return `الكمية يجب أن تكون بين ${minQuantity} و ${maxQuantity}`;
}

/**
 * Maps transactional RPC errors to stable public responses.
 *
 * @param {string} message - Raw RPC error message.
 * @param {{ min_qty: number, max_qty: number }} service - Selected service row.
 * @returns {{ error: string, status: number }} Public-safe error details.
 */
function mapTransactionError(message, service) {
  if (message.includes("Insufficient wallet balance")) {
    return { error: ORDER_MESSAGES.INSUFFICIENT_BALANCE, status: 400 };
  }

  if (message.includes("Service not found")) {
    return { error: ORDER_MESSAGES.SERVICE_NOT_FOUND, status: 404 };
  }

  if (message.includes("Service is not active")) {
    return { error: ORDER_MESSAGES.INACTIVE_SERVICE, status: 400 };
  }

  if (message.includes("Quantity out of range")) {
    return {
      error: buildQuantityRangeMessage(service.min_qty, service.max_qty),
      status: 400,
    };
  }

  return { error: message || "تعذر إنشاء الطلب", status: 400 };
}

/**
 * Creates the notification body for a newly created order.
 *
 * @param {string} serviceName - Display name of the ordered service.
 * @param {number} quantity - Ordered quantity.
 * @param {number} total - Charged wallet amount.
 * @returns {string} Human-readable notification body.
 */
function buildOrderNotificationBody(serviceName, quantity, total) {
  return `طلب ${serviceName} بكمية ${quantity} — المبلغ: ${total.toFixed(2)} د.أ`;
}

/**
 * Creates a digital service order and optionally forwards it to Serva-S.
 *
 * Wraps the pipeline in `withIdempotency` so a duplicate POST with the same
 * `Idempotency-Key` header replays the cached response instead of creating a
 * second service_order row + provider request.
 *
 * @param {EventContext} context - Cloudflare Pages function context.
 * @returns {Promise<Response>} API response.
 */
export async function onRequestPost(context) {
  const { env, request } = context;
  const limit = await applyApiRateLimit({ env, request });
  if (limit.configurationError) {
    return buildRateLimitConfigurationErrorResponse(limit.headers);
  }

  if (!limit.allowed) {
    return buildRateLimitExceededResponse(limit.headers);
  }

  let rawBody = "";
  try {
    rawBody = await request.text();
  } catch (readError) {
    console.error("[ORD-501] Failed to read order body.", readError);
    return withOperationalHeaders(
      errorResponse("[ORD-501] تعذر قراءة بيانات الطلب", 400),
      limit.headers
    );
  }

  const response = await withIdempotency({
    env,
    request,
    requestBody: rawBody,
    scope: "service-order",
    handler: () => runServiceOrderPipeline({ env, rawBody, request }),
  });

  return withOperationalHeaders(response, limit.headers);
}

/**
 * Runs the validated service-order creation pipeline.
 *
 * @param {{ env: Record<string, unknown>, rawBody: string, request: Request }} input - Pipeline input.
 * @returns {Promise<Response>} Pipeline response.
 */
async function runServiceOrderPipeline({ env, rawBody, request }) {
  try {
    let body;
    try {
      body = rawBody ? JSON.parse(rawBody) : {};
    } catch (parseError) {
      void parseError;
      return errorResponse(ORDER_MESSAGES.INVALID_REQUEST, 400);
    }

    const { service_id: serviceId, quantity, link } = body || {};
    const userToken = getAuthToken(request);
    const normalizedQuantity = asPositiveNumber(quantity);

    if (!serviceId || !normalizedQuantity || !userToken) {
      return errorResponse(ORDER_MESSAGES.INVALID_REQUEST, 400);
    }

    const admin = createSupabaseAdmin(env);
    const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
    const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
    const { createClient } = await import("@supabase/supabase-js");
    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser(userToken);
    if (authError || !user) {
      return errorResponse(ORDER_MESSAGES.UNAUTHORIZED, 401);
    }

    const { data: profile } = await admin
      .from("user_profiles")
      .select("status")
      .eq("user_id", user.id)
      .single();

    if (profile?.status === "banned") {
      return errorResponse(ORDER_MESSAGES.BANNED, 403);
    }

    const { data: service, error: serviceError } = await admin
      .from("services")
      .select("*")
      .eq("id", serviceId)
      .single();

    if (serviceError || !service) {
      return errorResponse(ORDER_MESSAGES.SERVICE_NOT_FOUND, 404);
    }

    if (service.status !== "active") {
      return errorResponse(ORDER_MESSAGES.INACTIVE_SERVICE, 400);
    }

    if (normalizedQuantity < service.min_qty || normalizedQuantity > service.max_qty) {
      return errorResponse(buildQuantityRangeMessage(service.min_qty, service.max_qty), 400);
    }

    const { data: transactionResult, error: transactionError } = await admin.rpc("create_service_order_tx", {
      p_user_id: user.id,
      p_service_id: serviceId,
      p_quantity: normalizedQuantity,
      p_link: link || null,
    });

    if (transactionError) {
      const transactionFailure = mapTransactionError(transactionError.message || "", service);
      return errorResponse(transactionFailure.error, transactionFailure.status);
    }

    const transactionData = Array.isArray(transactionResult) ? transactionResult[0] : transactionResult;
    const orderId = transactionData?.order_id;
    const total = Number(transactionData?.total || 0);
    const newBalance = Number(transactionData?.new_balance || 0);

    if (!orderId) {
      return errorResponse("فشل إنشاء الطلب", 500);
    }

    const { data: serviceOrderRow } = await admin
      .from("service_orders")
      .select("display_number")
      .eq("id", orderId)
      .maybeSingle();
    const displayNumber = Number(serviceOrderRow?.display_number || 0) || null;

    /* Notification is already created inside the create_service_order_tx RPC */

    if (service.provider_service_id) {
      const providerResult = await createProviderOrder(env, {
        serviceId: service.provider_service_id,
        quantity: normalizedQuantity,
        link: link || null,
      });

      if (providerResult.success && providerResult.orderId) {
        await admin
          .from("service_orders")
          .update({ external_order_id: providerResult.orderId, status: "processing" })
          .eq("id", orderId);
      } else {
        // Provider failed AFTER the wallet was debited inside the RPC.
        // Roll the wallet back and mark the order as failed so the user gets
        // their balance back instead of an indefinitely "pending" order.
        // The release RPC is idempotent — re-running it on a non-pending
        // order is a no-op.
        const { error: rollbackError } = await admin.rpc("release_service_order_wallet", {
          p_order_id: orderId,
          p_reason: providerResult.error || "provider_unreachable",
        });

        if (rollbackError) {
          console.error("[ORD-301] Wallet rollback failed after provider error.", {
            orderId,
            providerError: providerResult.error,
            rollbackError,
          });
        }

        // Merge metadata via RPC to avoid overwriting fields the create RPC
        // already populated (e.g. provider_fields snapshot).
        const { error: metadataError } = await admin.rpc("merge_service_order_metadata", {
          p_order_id: orderId,
          p_metadata: {
            provider_error: String(providerResult.error || "unknown"),
            provider_attempted_at: new Date().toISOString(),
            wallet_rollback_attempted: !rollbackError,
          },
        });

        if (metadataError) {
          console.error("[ORD-302] Failed to merge provider failure metadata.", {
            orderId,
            metadataError,
          });
        }

        return errorResponse(
          rollbackError
            ? "[ORD-303] فشل إنشاء الطلب وتعذر استرجاع الرصيد. تواصل مع الدعم."
            : "[ORD-304] فشل إنشاء الطلب لدى المزود. تم استرجاع الرصيد إلى محفظتك.",
          502
        );
      }
    }

    return successResponse(
      {
        order_id: orderId,
        display_number: displayNumber,
        total,
        new_balance: newBalance,
        message: ORDER_MESSAGES.SUCCESS,
      },
      201
    );
  } catch (error) {
    console.error("Order creation error:", error);
    return errorResponse(ORDER_MESSAGES.UNEXPECTED, 500);
  }
}
