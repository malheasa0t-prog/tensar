import {
  INVALID_CURRENT_PASSWORD_MESSAGE,
  validatePasswordChangeForm
} from "../../../lib/profilePasswordModel.js";

import { getUserFromRequest } from "../lib/auth.mjs";
import { createAdminSupabaseClient, createPublicSupabaseClient } from "../lib/env.mjs";
import { errorResponse, jsonResponse, parseJsonBody } from "../lib/http.mjs";

/**
 * Confirms that the submitted current password matches the signed-in user.
 *
 * @param {{ email?: string | null }} user
 * @param {string} currentPassword
 * @param {Record<string, unknown>} env
 * @returns {Promise<Response | null>}
 */
async function verifyCurrentPassword(user, currentPassword, env) {
  if (!user?.email) {
    return errorResponse("تعذر التحقق من الحساب الحالي", 400);
  }

  const authClient = createPublicSupabaseClient(env);
  const { error } = await authClient.auth.signInWithPassword({
    email: user.email,
    password: currentPassword
  });

  if (!error) {
    return null;
  }

  if (Number(error.status) === 400) {
    return errorResponse(INVALID_CURRENT_PASSWORD_MESSAGE, 400);
  }

  return errorResponse("تعذر التحقق من كلمة المرور الحالية", 500);
}

/**
 * Changes the authenticated user's password.
 *
 * @param {Request} request
 * @param {Record<string, unknown>} env
 * @returns {Promise<Response>}
 */
export async function handlePasswordRequest(request, env) {
  const { error, user } = await getUserFromRequest(request, env);
  if (error || !user) {
    return errorResponse("Unauthorized", 401);
  }

  const body = await parseJsonBody(request);
  if (!body) {
    return errorResponse("بيانات الطلب غير صالحة", 400);
  }

  const validationError = validatePasswordChangeForm(body);
  if (validationError) {
    return errorResponse(validationError, 400);
  }

  const verifyResponse = await verifyCurrentPassword(user, body.current_password, env);
  if (verifyResponse) {
    return verifyResponse;
  }

  const adminClient = createAdminSupabaseClient(env);
  const { error: updateError } = await adminClient.auth.admin.updateUserById(user.id, {
    password: body.new_password
  });

  if (updateError) {
    return errorResponse("تعذر تغيير كلمة المرور", 500);
  }

  return jsonResponse({ success: true, message: "تم تغيير كلمة المرور بنجاح" });
}
