/**
 * Shared admin access checks for Cloudflare Pages Functions.
 */

import { canAccessAdminRecord, canAccessAdminRole } from "../../lib/adminRoles.js";
import {
  createSupabaseAdmin,
  createSupabaseClient,
  errorResponse,
  extractBearerToken,
} from "./supabase.js";

/**
 * Returns whether admin bypass is enabled for the current environment.
 *
 * @param {Record<string, string | undefined> | undefined} env - Environment bindings.
 * @returns {boolean} True when admin bypass is explicitly enabled.
 */
export function isAdminBypassEnabled(env) {
  return String(env?.ADMIN_DEV_BYPASS ?? "").trim() === "true";
}

/**
 * Returns whether the user metadata already grants admin access.
 *
 * @param {{ app_metadata?: { role?: string }, user_metadata?: { role?: string } } | null | undefined} user - Authenticated user.
 * @returns {boolean} True when user metadata contains an admin-capable role.
 */
export function hasAdminMetadataAccess(user) {
  return [user?.app_metadata?.role, user?.user_metadata?.role].some((role) =>
    canAccessAdminRole(role)
  );
}

/**
 * Loads an active admin-capable profile or legacy record for a user.
 *
 * @param {import("@supabase/supabase-js").SupabaseClient} adminClient - Privileged Supabase client.
 * @param {{ email?: string | null, id?: string | null }} user - Authenticated user.
 * @returns {Promise<boolean>} True when the user is allowed into the admin panel.
 */
export async function hasStoredAdminAccess(adminClient, user) {
  const userId = String(user?.id ?? "").trim();
  const email = String(user?.email ?? "").trim();
  const [profileResult, legacyResult] = await Promise.all([
    adminClient.from("user_profiles").select("role, status").eq("user_id", userId).maybeSingle(),
    email
      ? adminClient.from("app_users").select("role, status").ilike("email", email).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return canAccessAdminRecord(profileResult.data) || canAccessAdminRecord(legacyResult.data);
}

/**
 * Validates that the request belongs to an authenticated admin user.
 *
 * @param {Request} request - Incoming request object.
 * @param {Record<string, string | undefined>} env - Environment bindings.
 * @param {{ adminClient?: import("@supabase/supabase-js").SupabaseClient, publicClient?: import("@supabase/supabase-js").SupabaseClient }} [options={}] - Optional injected clients for tests.
 * @returns {Promise<{ user: Record<string, unknown> | null, errorResponse: Response | null }>} Auth result.
 */
export async function requireAdminAccess(request, env, options = {}) {
  const token = extractBearerToken(request);
  if (!token) {
    return { user: null, errorResponse: errorResponse("[ADM-201] غير مصرح — يجب تسجيل الدخول", 401) };
  }

  const publicClient = options.publicClient ?? createSupabaseClient(env);
  const {
    data: { user },
    error,
  } = await publicClient.auth.getUser(token);

  if (error || !user) {
    return { user: null, errorResponse: errorResponse("[ADM-202] غير مصرح — جلسة غير صالحة", 401) };
  }

  if (isAdminBypassEnabled(env) || hasAdminMetadataAccess(user)) {
    return { user, errorResponse: null };
  }

  const adminClient = options.adminClient ?? createSupabaseAdmin(env);
  const hasAccess = await hasStoredAdminAccess(adminClient, user);
  if (!hasAccess) {
    return { user, errorResponse: errorResponse("[ADM-203] صلاحيات غير كافية", 403) };
  }

  return { user, errorResponse: null };
}
