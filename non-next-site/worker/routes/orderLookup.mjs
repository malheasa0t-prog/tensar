import { lookupPublicOrderByNumber } from "../../../services/orderLookupService.js";

import { createAdminSupabaseClient } from "../lib/env.mjs";
import { errorResponse, jsonResponse, parseJsonBody } from "../lib/http.mjs";

/**
 * Handles public repair and delivery order lookups.
 *
 * @param {Request} request
 * @param {Record<string, unknown>} env
 * @returns {Promise<Response>}
 */
export async function handleOrderLookupRequest(request, env) {
  const body = await parseJsonBody(request);

  if (!body) {
    return errorResponse("تعذر قراءة البيانات المرسلة.", 400);
  }

  try {
    const result = await lookupPublicOrderByNumber({
      adminClient: createAdminSupabaseClient(env),
      lookupType: typeof body.lookupType === "string" ? body.lookupType : "all",
      orderNumber: typeof body.orderNumber === "string" ? body.orderNumber : ""
    });

    if (!result) {
      return errorResponse("لم نعثر على طلب بهذا الرقم. تأكد من الرقم ثم حاول مرة أخرى.", 404);
    }

    return jsonResponse(result, 200);
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "تعذر إتمام الاستعلام حاليا. حاول مرة أخرى بعد قليل.";
    const status = message.includes("أدخل رقم طلب صحيح") ? 400 : 500;

    return errorResponse(message, status);
  }
}
