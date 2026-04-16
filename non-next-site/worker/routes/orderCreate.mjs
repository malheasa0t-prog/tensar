import { createProviderApi } from "../lib/provider.mjs";
import { createAdminSupabaseClient, createPublicSupabaseClient } from "../lib/env.mjs";
import { errorResponse, jsonResponse, parseJsonBody } from "../lib/http.mjs";

/**
 * Determines whether the provided profile status represents a banned account.
 *
 * @param {unknown} status
 * @returns {boolean}
 */
function isProfileBanned(status) {
  return typeof status === "string" && status.trim().toLowerCase() === "banned";
}

/**
 * Converts one value into a positive number when possible.
 *
 * @param {unknown} value
 * @returns {number | null}
 */
function asPositiveNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Extracts the preferred auth token from the request body or headers.
 *
 * @param {Request} request
 * @param {Record<string, unknown> | null} body
 * @returns {string}
 */
function getAuthToken(request, body) {
  const authHeader = request.headers.get("authorization") || "";
  const tokenFromHeader = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";

  return tokenFromHeader || String(body?.user_token || "").trim();
}

/**
 * Creates a digital provider order without Next.js.
 *
 * @param {Request} request
 * @param {Record<string, unknown>} env
 * @returns {Promise<Response>}
 */
export async function handleOrderCreateRequest(request, env) {
  const body = await parseJsonBody(request);
  if (!body) {
    return errorResponse("بيانات الطلب غير صالحة", 400);
  }

  try {
    const serviceId = String(body.service_id || "").trim();
    const quantity = asPositiveNumber(body.quantity);
    const link = String(body.link || "").trim();
    const userToken = getAuthToken(request, body);

    if (!serviceId || !quantity || !userToken) {
      return errorResponse(
        "البيانات غير مكتملة: service_id, quantity, user_token/Bearer token مطلوبة",
        400
      );
    }

    const publicClient = createPublicSupabaseClient(env);
    const {
      data: { user },
      error: authError
    } = await publicClient.auth.getUser(userToken);

    if (authError || !user) {
      return errorResponse("غير مصرح — يجب تسجيل الدخول", 401);
    }

    const adminClient = createAdminSupabaseClient(env);
    const { data: profile } = await adminClient
      .from("user_profiles")
      .select("status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (isProfileBanned(profile?.status)) {
      return errorResponse("حسابك محظور. تواصل مع الإدارة.", 403);
    }

    const { data: service, error: serviceError } = await adminClient
      .from("services")
      .select("*")
      .eq("id", serviceId)
      .single();

    if (serviceError || !service) {
      return errorResponse("الخدمة غير موجودة", 404);
    }

    if (service.status !== "active") {
      return errorResponse("هذه الخدمة غير متوفرة حاليًا", 400);
    }

    if (quantity < service.min_qty || quantity > service.max_qty) {
      return errorResponse(`الكمية يجب أن تكون بين ${service.min_qty} و ${service.max_qty}`, 400);
    }

    const txResponse = await adminClient.rpc("create_service_order_tx", {
      p_link: link || null,
      p_quantity: quantity,
      p_service_id: serviceId,
      p_user_id: user.id
    });

    if (txResponse.error) {
      const message = txResponse.error.message || "تعذر إنشاء الطلب";
      if (message.includes("Insufficient wallet balance")) {
        return errorResponse("رصيدك غير كافٍ. يرجى شحن المحفظة أولاً.", 400);
      }
      if (message.includes("Service not found")) {
        return errorResponse("الخدمة غير موجودة", 404);
      }
      if (message.includes("Service is not active")) {
        return errorResponse("هذه الخدمة غير متوفرة حاليًا", 400);
      }
      if (message.includes("Quantity out of range")) {
        return errorResponse(`الكمية يجب أن تكون بين ${service.min_qty} و ${service.max_qty}`, 400);
      }

      return errorResponse(message, 400);
    }

    const txData = Array.isArray(txResponse.data) ? txResponse.data[0] : txResponse.data;
    const orderId = txData?.order_id;
    const total = Number(txData?.total || 0);
    const newBalance = Number(txData?.new_balance || 0);

    if (!orderId) {
      return errorResponse("فشل إنشاء الطلب", 500);
    }

    await adminClient.from("notifications").insert([
      {
        body: `طلب ${service.name} بكمية ${quantity} — المبلغ: ${total.toFixed(2)} د.أ`,
        reference_id: orderId,
        reference_type: "order",
        title: "تم إنشاء طلبك بنجاح",
        type: "success",
        user_id: user.id
      }
    ]);

    if (service.provider_service_id) {
      const providerApi = createProviderApi(env);
      const providerResult = await providerApi.createOrder(
        service.provider_service_id,
        link || null,
        quantity
      );

      if (providerResult.success && providerResult.orderId) {
        await adminClient
          .from("service_orders")
          .update({
            external_order_id: providerResult.orderId,
            status: "processing"
          })
          .eq("id", orderId);
      } else {
        await adminClient
          .from("service_orders")
          .update({
            metadata: {
              provider_attempted_at: new Date().toISOString(),
              provider_error: providerResult.error || "Unknown provider error"
            }
          })
          .eq("id", orderId);
      }
    }

    return jsonResponse(
      {
        success: true,
        order_id: orderId,
        total,
        new_balance: newBalance,
        message: "تم إنشاء الطلب بنجاح!"
      },
      201
    );
  } catch {
    return errorResponse("حدث خطأ غير متوقع", 500);
  }
}
