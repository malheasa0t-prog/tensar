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

const ALLOWED_PROFILE_FIELDS = Object.freeze(['avatar_url', 'bio', 'preferred_language']);
const ALLOWED_LANGUAGE_CODES = Object.freeze(['ar', 'en']);
const AVATAR_URL_PATTERN = /^https:\/\/[a-zA-Z0-9.-]+(:\d+)?(\/.*)?$/;
const AVATAR_URL_MAX_LENGTH = 2048;
const BIO_MAX_LENGTH = 500;

/**
 * Returns the trimmed string when input is a string, otherwise an empty string.
 *
 * @param {unknown} value - Untrusted candidate value.
 * @returns {string} Normalized text or empty string.
 */
function normalizeProfileText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Validates the avatar URL against a strict HTTPS allowlist.
 *
 * Rejects non-HTTPS schemes (e.g., `javascript:`, `data:`) that could lead to
 * stored XSS when the URL is later rendered as an `<img src>` or `<a href>`.
 *
 * @param {string} avatarUrl - Trimmed candidate URL.
 * @returns {string} Empty string when valid, error code otherwise.
 */
function validateAvatarUrl(avatarUrl) {
  if (!avatarUrl) return '';
  if (avatarUrl.length > AVATAR_URL_MAX_LENGTH) {
    return '[PRF-103] رابط الصورة طويل جداً';
  }
  if (!AVATAR_URL_PATTERN.test(avatarUrl)) {
    return '[PRF-104] رابط الصورة يجب أن يبدأ بـ https://';
  }
  try {
    const parsed = new URL(avatarUrl);
    if (parsed.protocol !== 'https:') {
      return '[PRF-104] رابط الصورة يجب أن يبدأ بـ https://';
    }
  } catch (parseError) {
    void parseError;
    return '[PRF-104] رابط الصورة يجب أن يبدأ بـ https://';
  }

  return '';
}

/**
 * Validates profile update input and returns a strictly-whitelisted payload.
 *
 * Only the fields in `ALLOWED_PROFILE_FIELDS` are passed through. Any other
 * key (including `role`, `status`, `email`, `full_name`, `phone`, etc.) is
 * silently dropped — users may never escalate via this endpoint.
 *
 * @param {Record<string, unknown>} body - Parsed JSON request body.
 * @returns {{ errors: string[], payload: Record<string, unknown> }} Validation result.
 */
function validateProfileInput(body) {
  const errors = [];
  const payload = {};
  const raw = body && typeof body === 'object' ? body : {};

  if ('avatar_url' in raw) {
    const avatarUrl = normalizeProfileText(raw.avatar_url);
    const avatarError = validateAvatarUrl(avatarUrl);
    if (avatarError) {
      errors.push(avatarError);
    } else {
      payload.avatar_url = avatarUrl || null;
    }
  }

  if ('bio' in raw) {
    const bio = normalizeProfileText(raw.bio);
    if (bio.length > BIO_MAX_LENGTH) {
      errors.push('[PRF-105] النبذة يجب ألا تتجاوز 500 حرف');
    } else {
      payload.bio = bio || null;
    }
  }

  if ('preferred_language' in raw) {
    const lang = normalizeProfileText(raw.preferred_language).toLowerCase();
    if (lang && !ALLOWED_LANGUAGE_CODES.includes(lang)) {
      errors.push('[PRF-106] قيمة اللغة غير صالحة');
    } else {
      payload.preferred_language = lang || 'ar';
    }
  }

  // Final guard: refuse any field that bypassed the allowlist above. The
  // validator builds `payload` from explicit keys only, so this is defensive.
  for (const key of Object.keys(payload)) {
    if (!ALLOWED_PROFILE_FIELDS.includes(key)) {
      delete payload[key];
    }
  }

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
