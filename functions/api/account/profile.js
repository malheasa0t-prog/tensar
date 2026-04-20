/**
 * Cloudflare Pages Function — Account Profile (GET & PATCH).
 *
 * GET  /api/account/profile → Returns user profile data.
 * PATCH /api/account/profile → Updates user profile fields.
 */

import { createSupabaseAdmin, createSupabaseClient, extractBearerToken, errorResponse, successResponse } from '../../_lib/supabase.js';
import { handlePreflight, withCors } from '../../_lib/cors.js';

/* ─── Constants ─── */

/* CORS handled by shared _lib/cors.js module */

/* ─── Helpers ─── */

/**
 * Authenticates the request and returns the user object.
 *
 * @param {Request} request
 * @param {Record<string, string>} env
 * @returns {Promise<{ user: object | null, error: string | null }>}
 */
async function getUserFromRequest(request, env) {
  const token = extractBearerToken(request);
  if (!token) {
    return { user: null, error: 'Missing bearer token' };
  }

  const supabase = createSupabaseClient(env);
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return { user: null, error: 'Unauthorized' };
  }

  return { user, error: null };
}

/**
 * Validates profile update input and returns sanitized payload.
 *
 * @param {Record<string, unknown>} body
 * @returns {{ errors: string[], payload: Record<string, unknown> }}
 */
function validateProfileInput(body) {
  const errors = [];

  const fullName = typeof body.full_name === 'string' ? body.full_name.trim() : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const avatarUrl = typeof body.avatar_url === 'string' ? body.avatar_url.trim() : '';
  const country = typeof body.country === 'string' ? body.country.trim() : '';
  const bio = typeof body.bio === 'string' ? body.bio.trim() : '';
  const preferredLanguage = typeof body.preferred_language === 'string' ? body.preferred_language.trim() : '';
  const preferredCurrency = typeof body.preferred_currency === 'string' ? body.preferred_currency.trim() : '';

  if (fullName && (fullName.length < 2 || fullName.length > 120)) {
    errors.push('الاسم يجب أن يكون بين حرفين و120 حرفاً');
  }
  if (phone && !/^[+0-9\s()-]{7,20}$/.test(phone)) {
    errors.push('رقم الهاتف غير صالح');
  }
  if (avatarUrl && avatarUrl.length > 2048) {
    errors.push('رابط الصورة طويل جداً');
  }
  if (country && country.length > 80) {
    errors.push('اسم الدولة طويل جداً');
  }
  if (bio && bio.length > 500) {
    errors.push('النبذة يجب ألا تتجاوز 500 حرف');
  }
  if (preferredLanguage && preferredLanguage.length > 12) {
    errors.push('قيمة اللغة غير صالحة');
  }
  if (preferredCurrency && preferredCurrency.length > 8) {
    errors.push('قيمة العملة غير صالحة');
  }

  return {
    errors,
    payload: {
      full_name: fullName || null,
      phone: phone || null,
      avatar_url: avatarUrl || null,
      country: country || null,
      bio: bio || null,
      preferred_language: preferredLanguage || 'ar',
      preferred_currency: preferredCurrency || 'JOD',
      updated_at: new Date().toISOString(),
    },
  };
}

/* ─── Handlers ─── */

/**
 * GET handler — returns the authenticated user's profile.
 *
 * @param {Request} request
 * @param {Record<string, string>} env
 * @returns {Promise<Response>}
 */
async function handleGet(request, env) {
  const { user, error } = await getUserFromRequest(request, env);
  if (error || !user) {
    return errorResponse('Unauthorized', 401);
  }

  const admin = createSupabaseAdmin(env);
  const { data: profile, error: profileError } = await admin
    .from('user_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (profileError) {
    return errorResponse('Failed to load profile', 500);
  }

  return successResponse({
    data: {
      email: user.email,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at,
      profile: profile || null,
    },
  });
}

/**
 * PATCH handler — updates the authenticated user's profile.
 *
 * @param {Request} request
 * @param {Record<string, string>} env
 * @returns {Promise<Response>}
 */
async function handlePatch(request, env) {
  const { user, error } = await getUserFromRequest(request, env);
  if (error || !user) {
    return errorResponse('Unauthorized', 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse('بيانات الطلب غير صالحة', 400);
  }

  const { errors, payload } = validateProfileInput(body || {});
  if (errors.length > 0) {
    return errorResponse(errors[0], 400);
  }

  const admin = createSupabaseAdmin(env);
  const { error: updateError } = await admin
    .from('user_profiles')
    .update(payload)
    .eq('user_id', user.id);

  if (updateError) {
    return errorResponse('Failed to update profile', 500);
  }

  return successResponse({ message: 'تم تحديث الملف الشخصي بنجاح' });
}

/* ─── Entry Point ─── */

export async function onRequest(context) {
  if (context.request.method === 'OPTIONS') {
    return handlePreflight(context.request, 'GET, PATCH, OPTIONS');
  }

  const method = context.request.method.toUpperCase();
  let response;

  if (method === 'GET') {
    response = await handleGet(context.request, context.env);
  } else if (method === 'PATCH') {
    response = await handlePatch(context.request, context.env);
  } else {
    response = errorResponse('Method not allowed', 405);
  }

  return withCors(response, context.request, 'GET, PATCH, OPTIONS');
}
