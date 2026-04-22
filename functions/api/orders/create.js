/**
 * Cloudflare Pages Function for creating digital service orders.
 */

import { createProviderOrder } from "../../_lib/providerApi.js";
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
 * Returns the bearer token from the request or request body.
 *
 * @param {Request} request - Incoming HTTP request.
 * @param {Record<string, unknown>} body - Parsed request body.
 * @returns {string} Auth token or an empty string.
 */
function getAuthToken(request, body) {
  return extractBearerToken(request) || body?.user_token || "";
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
 * @param {EventContext} context - Cloudflare Pages function context.
 * @returns {Promise<Response>} API response.
 */
export async function onRequestPost(context) {
  const { env, request } = context;

  try {
    const body = await request.json();
    const { service_id: serviceId, quantity, link } = body || {};
    const userToken = getAuthToken(request, body);
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

    await admin.from("notifications").insert([
      {
        user_id: user.id,
        title: ORDER_MESSAGES.SUCCESS_TITLE,
        body: buildOrderNotificationBody(service.name, normalizedQuantity, total),
        type: "success",
        reference_type: "order",
        reference_id: orderId,
      },
    ]);

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
        await admin
          .from("service_orders")
          .update({
            metadata: {
              provider_error: providerResult.error,
              provider_attempted_at: new Date().toISOString(),
            },
          })
          .eq("id", orderId);
      }
    }

    return successResponse(
      {
        order_id: orderId,
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
