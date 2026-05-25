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

const LOCAL_ADMIN_HOST_SUFFIX = ".localhost";
const LOCAL_ADMIN_HOSTS = new Set(["127.0.0.1", "::1", "localhost"]);
const ADMIN_BYPASS_AUDIT_ACTION = "admin_bypass_used";
const ADMIN_LOGIN_REQUIRED_MESSAGE =
  "[ADM-201] \u063A\u064A\u0631 \u0645\u0635\u0631\u062D - \u064A\u062C\u0628 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644";
const ADMIN_INVALID_SESSION_MESSAGE =
  "[ADM-202] \u063A\u064A\u0631 \u0645\u0635\u0631\u062D - \u0627\u0644\u062C\u0644\u0633\u0629 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629";
const ADMIN_FORBIDDEN_MESSAGE =
  "[ADM-203] \u0635\u0644\u0627\u062D\u064A\u0627\u062A \u063A\u064A\u0631 \u0643\u0627\u0641\u064A\u0629";

/**
 * Resolves one request hostname for local-only bypass checks.
 *
 * @param {Request | null | undefined} request - Incoming request object.
 * @returns {string} Normalized hostname or an empty string when unavailable.
 */
function getRequestHostname(request) {
  const requestUrl = String(request?.url || "").trim();
  if (!requestUrl) return "";

  try {
    return new URL(requestUrl).hostname.replace(/^\[|\]$/g, "").trim().toLowerCase();
  } catch (error) {
    if (error instanceof TypeError) return "";
    throw error;
  }
}

/**
 * Returns whether one hostname points to the local development machine.
 *
 * @param {string} hostname - Parsed request hostname.
 * @returns {boolean} True when the hostname is a supported local address.
 */
function isLocalAdminHostname(hostname) {
  const normalizedHostname = String(hostname || "").trim().toLowerCase();
  return LOCAL_ADMIN_HOSTS.has(normalizedHostname)
    || normalizedHostname.endsWith(LOCAL_ADMIN_HOST_SUFFIX);
}

/**
 * Returns whether admin bypass is enabled for the current local request.
 *
 * @param {Record<string, string | undefined> | undefined} env - Environment bindings.
 * @param {Request | null | undefined} request - Incoming request object.
 * @returns {boolean} True when bypass is enabled explicitly for localhost only.
 */
export function isAdminBypassEnabled(env, request) {
  const bypassEnabled = String(env?.ADMIN_DEV_BYPASS ?? "").trim() === "true";
  if (!bypassEnabled) return false;
  return isLocalAdminHostname(getRequestHostname(request));
}

/**
 * Persists one audit log entry whenever the admin bypass is used locally.
 *
 * @param {import("@supabase/supabase-js").SupabaseClient} adminClient - Privileged Supabase client.
 * @param {{ email?: string | null, id?: string | null }} user - Authenticated user.
 * @param {Request} request - Incoming request object.
 * @returns {Promise<void>}
 */
async function recordAdminBypassUsage(adminClient, user, request) {
  const actorId = String(user?.id || "").trim();
  const actorEmail = String(user?.email || "").trim();
  const requestUrl = String(request?.url || "").trim();
  const result = await adminClient.from("audit_logs").insert({
    action: ADMIN_BYPASS_AUDIT_ACTION,
    actor_email: actorEmail || null,
    actor_id: actorId || null,
    details: {
      reason: "local_admin_dev_bypass",
      request_url: requestUrl,
    },
    target_table: "admin_access",
    target_id: actorId || null,
  });

  if (result?.error) {
    console.warn("[ADM-204] Failed to record local admin bypass usage.", result.error);
  }
}

/**
 * Returns whether the user's server-controlled metadata grants admin access.
 *
 * Only `app_metadata.role` is honored. `user_metadata` is user-writable via
 * `supabase.auth.updateUser({ data: { role: "..." } })` and MUST NOT be used
 * for authorization decisions. See SECURITY-AUDIT-2026-05-23 (CRIT-001).
 *
 * @param {{ app_metadata?: { role?: string } } | null | undefined} user - Authenticated user.
 * @returns {boolean} True when app metadata contains an admin-capable role.
 */
export function hasAdminMetadataAccess(user) {
  return canAccessAdminRole(user?.app_metadata?.role);
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
    return { user: null, errorResponse: errorResponse(ADMIN_LOGIN_REQUIRED_MESSAGE, 401) };
  }

  const publicClient = options.publicClient ?? createSupabaseClient(env);
  const {
    data: { user },
    error,
  } = await publicClient.auth.getUser(token);

  if (error || !user) {
    return { user: null, errorResponse: errorResponse(ADMIN_INVALID_SESSION_MESSAGE, 401) };
  }

  if (isAdminBypassEnabled(env, request)) {
    const adminClient = options.adminClient ?? createSupabaseAdmin(env);
    await recordAdminBypassUsage(adminClient, user, request);
    return { user, errorResponse: null };
  }

  if (hasAdminMetadataAccess(user)) {
    return { user, errorResponse: null };
  }

  const adminClient = options.adminClient ?? createSupabaseAdmin(env);
  const hasAccess = await hasStoredAdminAccess(adminClient, user);
  if (!hasAccess) {
    return { user, errorResponse: errorResponse(ADMIN_FORBIDDEN_MESSAGE, 403) };
  }

  return { user, errorResponse: null };
}
