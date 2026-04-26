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
const RATE_LIMIT_MESSAGE = '[PWD-429] محاولات كثيرة لتغيير كلمة المرور. حاول مرة أخرى بعد دقيقة.';

const PASSWORD_RATE_LIMIT_MAX = 5;
const PASSWORD_RATE_LIMIT_WINDOW_MS = 60_000;
const passwordRateLimitStore = new Map();

/**
 * Applies a strict per-IP rate limit for password change attempts.
 *
 * @param {Request} request
 * @returns {boolean} True if the request is allowed.
 */
function isPasswordAttemptAllowed(request) {
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const nowMs = Date.now();
  const key = `pwd:${ip}`;
  const bucket = (passwordRateLimitStore.get(key) || [])
    .filter((ts) => ts > nowMs - PASSWORD_RATE_LIMIT_WINDOW_MS);

  if (bucket.length >= PASSWORD_RATE_LIMIT_MAX) {
    passwordRateLimitStore.set(key, bucket);
    return false;
  }

  bucket.push(nowMs);
  passwordRateLimitStore.set(key, bucket);
  return true;
}

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
 * Verifies the user's current password then immediately destroys the
 * temporary session to prevent session leakage.
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

  const tempClient = createSupabaseClient(env);
  const { error } = await tempClient.auth.signInWithPassword({ email, password: currentPassword });

  if (!error) {
    // Immediately destroy the temporary session created by signInWithPassword
    await tempClient.auth.signOut().catch(() => {});
    return null;
  }

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

  // Strict rate limit: 5 attempts per minute per IP
  if (!isPasswordAttemptAllowed(request)) {
    return withCors(errorResponse(RATE_LIMIT_MESSAGE, 429), request);
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

