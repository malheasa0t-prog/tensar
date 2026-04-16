/**
 * Cloudflare Pages Function — Account Password Change (POST).
 *
 * POST /api/account/password → Changes the user's password after
 * verifying the current password.
 */

import { createSupabaseAdmin, createSupabaseClient, extractBearerToken, errorResponse, successResponse } from '../../_lib/supabase.js';

/* ─── Constants ─── */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const INVALID_CURRENT_PASSWORD = 'كلمة المرور الحالية غير صحيحة';
const MISSING_CURRENT_PASSWORD = 'أدخل كلمة المرور الحالية';
const PASSWORD_MISMATCH = 'كلمتا المرور غير متطابقتين';
const PASSWORD_REQUIREMENTS = 'كلمة المرور يجب أن تحتوي على أحرف وأرقام';
const PASSWORD_TOO_SHORT = 'كلمة المرور يجب أن تكون 8 أحرف على الأقل';

/* ─── Helpers ─── */

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
    return errorResponse('تعذر التحقق من الحساب الحالي', 400);
  }

  const supabase = createSupabaseClient(env);
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  });

  if (!error) return null;

  if (Number(error.status) === 400) {
    return errorResponse(INVALID_CURRENT_PASSWORD, 400);
  }

  return errorResponse('تعذر التحقق من كلمة المرور الحالية', 500);
}

/* ─── Handler ─── */

export async function onRequest(context) {
  if (context.request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (context.request.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  const { env, request } = context;

  /* Authenticate */
  const token = extractBearerToken(request);
  if (!token) {
    return errorResponse('Unauthorized', 401);
  }

  const supabase = createSupabaseClient(env);
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return errorResponse('Unauthorized', 401);
  }

  /* Parse body */
  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse('بيانات الطلب غير صالحة', 400);
  }

  /* Validate */
  const validationError = validatePasswordChangeForm(body);
  if (validationError) {
    return errorResponse(validationError, 400);
  }

  /* Verify current password */
  const verifyResponse = await verifyCurrentPassword(env, user.email, body.current_password.trim());
  if (verifyResponse) {
    const headers = new Headers(verifyResponse.headers);
    Object.entries(CORS_HEADERS).forEach(([k, v]) => headers.set(k, v));
    return new Response(verifyResponse.body, { status: verifyResponse.status, headers });
  }

  /* Update password */
  const admin = createSupabaseAdmin(env);
  const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
    password: body.new_password,
  });

  if (updateError) {
    return errorResponse('تعذر تغيير كلمة المرور', 500);
  }

  const response = successResponse({ message: 'تم تغيير كلمة المرور بنجاح' });
  const headers = new Headers(response.headers);
  Object.entries(CORS_HEADERS).forEach(([k, v]) => headers.set(k, v));

  return new Response(response.body, { status: response.status, headers });
}
