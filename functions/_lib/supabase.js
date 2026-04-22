/**
 * Shared Supabase Client Factory for Cloudflare Pages Functions.
 *
 * Creates Supabase clients using environment variables from context.env.
 * Files prefixed with _ in /functions are not exposed as routes.
 */

import { createClient } from '@supabase/supabase-js';
import { buildErrorPayload } from './errorCodes.js';

/**
 * Creates a public (anon) Supabase client.
 *
 * @param {Record<string, string>} env - Cloudflare environment bindings
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
export function createSupabaseClient(env) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('[SUP-500] Missing Supabase URL or Anon Key in environment');
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Creates a privileged (service_role) Supabase client.
 *
 * @param {Record<string, string>} env - Cloudflare environment bindings
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
export function createSupabaseAdmin(env) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('[SUP-501] Missing Supabase URL or Service Role Key in environment');
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Extracts a Bearer token from the Authorization header.
 *
 * @param {Request} request
 * @returns {string}
 */
export function extractBearerToken(request) {
  const auth = request.headers.get('authorization') || '';
  return auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
}

/**
 * Creates a standard JSON error response.
 *
 * @param {string} error
 * @param {number} status
 * @returns {Response}
 */
export function errorResponse(error, status = 400) {
  return Response.json(buildErrorPayload(error), { status });
}

/**
 * Creates a standard JSON success response.
 *
 * @param {Record<string, unknown>} data
 * @param {number} status
 * @returns {Response}
 */
export function successResponse(data, status = 200) {
  return Response.json({ success: true, ...data }, { status });
}
