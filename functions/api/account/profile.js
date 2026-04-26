/**
 * Cloudflare Pages Function — Account Profile (GET & PATCH).
 *
 * GET  /api/account/profile → Returns user profile data.
 * PATCH /api/account/profile → Updates user profile fields.
 */

import { createSupabaseAdmin, createSupabaseClient, extractBearerToken, errorResponse, successResponse } from '../../_lib/supabase.js';
import { handlePreflight, withCors } from '../../_lib/cors.js';

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
    return { user: null, error: '[PRF-201] Missing bearer token' };
  }

  const supabase = createSupabaseClient(env);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return { user: null, error: '[PRF-202] Unauthorized' };
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
  const payload = {};
  const raw = body || {};

  // Only include fields that were explicitly sent in the request
  if ('full_name' in raw) {
    const fullName = typeof raw.full_name === 'string' ? raw.full_name.trim() : '';
    if (fullName && (fullName.length < 2 || fullName.length > 120)) {
      errors.push('[PRF-101] الاسم يجب أن يكون بين حرفين و120 حرفاً');
    }
    if (fullName) payload.full_name = fullName;
  }

  if ('phone' in raw) {
    const phone = typeof raw.phone === 'string' ? raw.phone.trim() : '';
    if (phone && !/^[+0-9\s()-]{7,20}$/.test(phone)) {
      errors.push('[PRF-102] رقم الهاتف غير صالح');
    }
    if (phone) payload.phone = phone;
  }

  if ('avatar_url' in raw) {
    const avatarUrl = typeof raw.avatar_url === 'string' ? raw.avatar_url.trim() : '';
    if (avatarUrl && avatarUrl.length > 2048) {
      errors.push('[PRF-103] رابط الصورة طويل جداً');
    }
    payload.avatar_url = avatarUrl || null;
  }

  if ('country' in raw) {
    const country = typeof raw.country === 'string' ? raw.country.trim() : '';
    if (country && country.length > 80) {
      errors.push('[PRF-104] اسم الدولة طويل جداً');
    }
    if (country) payload.country = country;
  }

  if ('bio' in raw) {
    const bio = typeof raw.bio === 'string' ? raw.bio.trim() : '';
    if (bio && bio.length > 500) {
      errors.push('[PRF-105] النبذة يجب ألا تتجاوز 500 حرف');
    }
    payload.bio = bio || null;
  }

  if ('preferred_language' in raw) {
    const lang = typeof raw.preferred_language === 'string' ? raw.preferred_language.trim() : '';
    if (lang && lang.length > 12) {
      errors.push('[PRF-106] قيمة اللغة غير صالحة');
    }
    payload.preferred_language = lang || 'ar';
  }

  if ('preferred_currency' in raw) {
    const currency = typeof raw.preferred_currency === 'string' ? raw.preferred_currency.trim() : '';
    if (currency && currency.length > 8) {
      errors.push('[PRF-107] قيمة العملة غير صالحة');
    }
    payload.preferred_currency = currency || 'JOD';
  }

  // Always set updated_at if there's anything to update
  if (Object.keys(payload).length > 0) {
    payload.updated_at = new Date().toISOString();
  }

  return { errors, payload };
}

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
    return errorResponse(error || '[PRF-202] Unauthorized', 401);
  }

  const admin = createSupabaseAdmin(env);
  const { data: profile, error: profileError } = await admin
    .from('user_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (profileError) {
    return errorResponse('[PRF-301] Failed to load profile', 500);
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
    return errorResponse(error || '[PRF-202] Unauthorized', 401);
  }

  let body;
  try {
    body = await request.json();
  } catch (parseError) {
    console.error('[PRF-108] Failed to parse profile payload:', parseError);
    return errorResponse('[PRF-108] بيانات الطلب غير صالحة', 400);
  }

  const { errors, payload } = validateProfileInput(body || {});
  if (errors.length > 0) {
    return errorResponse(errors[0], 400);
  }

  if (Object.keys(payload).length === 0) {
    return errorResponse('[PRF-109] لم يتم إرسال أي بيانات للتحديث', 400);
  }

  const admin = createSupabaseAdmin(env);
  const { error: updateError } = await admin
    .from('user_profiles')
    .update(payload)
    .eq('user_id', user.id);

  if (updateError) {
    return errorResponse('[PRF-302] Failed to update profile', 500);
  }

  return successResponse({ message: 'تم تحديث الملف الشخصي بنجاح' });
}

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
    response = errorResponse('[PRF-203] Method not allowed', 405);
  }

  return withCors(response, context.request, 'GET, PATCH, OPTIONS');
}
