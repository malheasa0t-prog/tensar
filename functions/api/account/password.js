/**
 * Cloudflare Pages Function — Account Password Change (POST).
 *
 * POST /api/account/password → Changes the user's password after
 * verifying the current password.
 */

import { createSupabaseAdmin, createSupabaseClient, extractBearerToken, errorResponse, successResponse } from '../../_lib/supabase.js';
import { handlePreflight, withCors } from '../../_lib/cors.js';

const INVALID_CURRENT_PASSWORD = '[PWD-107] كلمة المرور الحالية غير صحيحة';
const MISSING_CURRENT_PASSWORD = '[PWD-101] أدخل كلمة المرور الحالية';
const PASSWORD_MISMATCH = '[PWD-104] كلمتا المرور غير متطابقتين';
const PASSWORD_REQUIREMENTS = '[PWD-103] كلمة المرور يجب أن تحتوي على أحرف وأرقام';
const PASSWORD_TOO_SHORT = '[PWD-102] كلمة المرور يجب أن تكون 8 أحرف على الأقل';

/**
 * Validates the password change form payload.
 *
 * @param {Record<string, unknown>} form
 * @returns {string | null} Error message or null if valid.
 */
function validatePasswordChangeForm(form) {
  const currentPassword = typeof form?.current_password === 'string' ? form.current_password.trim() : '';
  const newPassword = typeof form?.new_password === 'string' ? form.new_password : '';
  const confirmPassword = typeof form?.confirm_password === 'string' ? form.confirm_password : '';

  if (!currentPassword) return MISSING_CURRENT_PASSWORD;
  if (newPassword.length < 8) return PASSWORD_TOO_SHORT;
  if (!/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) return PASSWORD_REQUIREMENTS;
  if (newPassword !== confirmPassword) return PASSWORD_MISMATCH;
  return null;
}

/**
 * Verifies the user's current password.
 *
 * @param {Record<string, string>} env
 * @param {string} email
 * @param {string} currentPassword
 * @returns {Promise<Response | null>}
 */
async function verifyCurrentPassword(env, email, currentPassword) {
  if (!email) {
    return errorResponse('[PWD-106] تعذر التحقق من الحساب الحالي', 400);
  }

  const supabase = createSupabaseClient(env);
  const { error } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
  if (!error) return null;
  if (Number(error.status) === 400) return errorResponse(INVALID_CURRENT_PASSWORD, 400);
  return errorResponse('[PWD-500] تعذر التحقق من كلمة المرور الحالية', 500);
}

export async function onRequest(context) {
  if (context.request.method === 'OPTIONS') {
    return handlePreflight(context.request);
  }

  if (context.request.method !== 'POST') {
    return errorResponse('[PWD-203] Method not allowed', 405);
  }

  const { env, request } = context;
  const token = extractBearerToken(request);
  if (!token) {
    return errorResponse('[PWD-201] Unauthorized', 401);
  }

  const supabase = createSupabaseClient(env);
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return errorResponse('[PWD-202] Unauthorized', 401);
  }

  let body;
  try {
    body = await request.json();
  } catch (parseError) {
    console.error('[PWD-105] Failed to parse password payload:', parseError);
    return errorResponse('[PWD-105] بيانات الطلب غير صالحة', 400);
  }

  const validationError = validatePasswordChangeForm(body);
  if (validationError) {
    return errorResponse(validationError, 400);
  }

  const verifyResponse = await verifyCurrentPassword(env, user.email, body.current_password.trim());
  if (verifyResponse) {
    return withCors(verifyResponse, request);
  }

  const admin = createSupabaseAdmin(env);
  const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
    password: body.new_password,
  });

  if (updateError) {
    return errorResponse('[PWD-301] تعذر تغيير كلمة المرور', 500);
  }

  return withCors(successResponse({ message: 'تم تغيير كلمة المرور بنجاح' }), request);
}
