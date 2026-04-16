import { canAccessAdminRecord } from "../../../lib/adminRoles.js";

import { createAdminSupabaseClient, createPublicSupabaseClient } from "./env.mjs";
import { errorResponse } from "./http.mjs";

/**
 * Extracts one bearer token from the request headers.
 *
 * @param {Request} request
 * @returns {string}
 */
export function extractBearerToken(request) {
  const header = String(request.headers.get("authorization") || "").trim();
  return header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
}

/**
 * Resolves the authenticated user from the request token.
 *
 * @param {Request} request
 * @param {Record<string, unknown>} env
 * @returns {Promise<{ error: string | null, user: Record<string, unknown> | null }>}
 */
export async function getUserFromRequest(request, env) {
  const token = extractBearerToken(request);

  if (!token) {
    return { error: "Missing bearer token", user: null };
  }

  const publicClient = createPublicSupabaseClient(env);
  const {
    data: { user },
    error
  } = await publicClient.auth.getUser(token);

  return error || !user ? { error: "Unauthorized", user: null } : { error: null, user };
}

/**
 * Resolves whether the current authenticated user may access admin routes.
 *
 * @param {Request} request
 * @param {Record<string, unknown>} env
 * @returns {Promise<{ adminClient?: import("@supabase/supabase-js").SupabaseClient, errorResponse: Response | null, user: Record<string, unknown> | null }>}
 */
export async function requireAdminRequest(request, env) {
  const { error, user } = await getUserFromRequest(request, env);

  if (error || !user) {
    return { errorResponse: errorResponse("Unauthorized", 401), user: null };
  }

  if (String(env?.ADMIN_DEV_BYPASS || "").trim().toLowerCase() === "true") {
    return { adminClient: createAdminSupabaseClient(env), errorResponse: null, user };
  }

  const adminClient = createAdminSupabaseClient(env);
  const [profileResponse, legacyResponse] = await Promise.all([
    adminClient.from("user_profiles").select("*").eq("user_id", user.id).maybeSingle(),
    adminClient.from("app_users").select("id, full_name, email, role, status").ilike("email", user.email || "").maybeSingle()
  ]);

  const canAccessAdmin =
    canAccessAdminRecord(profileResponse.data || null) || canAccessAdminRecord(legacyResponse.data || null);

  if (!canAccessAdmin) {
    return { errorResponse: errorResponse("Forbidden", 403), user };
  }

  return { adminClient, errorResponse: null, user };
}
