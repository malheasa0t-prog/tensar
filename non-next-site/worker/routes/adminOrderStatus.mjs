import { AdminOrderStatusError, updateAdminOrderStatus } from "../../../services/adminOrderStatusService.js";

import { requireAdminRequest } from "../lib/auth.mjs";
import { errorResponse, jsonResponse, parseJsonBody } from "../lib/http.mjs";

/**
 * Handles admin-driven order status updates.
 *
 * @param {Request} request
 * @param {Record<string, unknown>} env
 * @returns {Promise<Response>}
 */
export async function handleAdminOrderStatusRequest(request, env) {
  const { adminClient, errorResponse: authError, user } = await requireAdminRequest(request, env);

  if (authError) {
    return authError;
  }

  const body = await parseJsonBody(request);
  if (!body) {
    return errorResponse("بيانات الطلب غير صالحة.", 400);
  }

  try {
    const result = await updateAdminOrderStatus({
      client: adminClient,
      actor: { email: user?.email || "", id: user?.id || "" },
      payload: body
    });

    return jsonResponse({ success: true, ...result });
  } catch (error) {
    if (error instanceof AdminOrderStatusError) {
      return errorResponse(error.message, error.statusCode);
    }

    return errorResponse("تعذر تحديث حالة الطلب.", 500);
  }
}
