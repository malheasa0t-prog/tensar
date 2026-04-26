/**
 * Cloudflare Pages Function for validating the current admin session.
 */

import { requireAdminAccess } from "../../_lib/adminAccess.js";
import { handlePreflight, withCors } from "../../_lib/cors.js";
import {
  createSupabaseAdmin,
  errorResponse,
  successResponse,
} from "../../_lib/supabase.js";
import { withSecurityHeaders } from "../../_lib/securityHeaders.js";
import { getAdminDisplayName } from "../../../lib/adminRoles.js";

const ADMIN_SESSION_METHODS = "GET, OPTIONS";
const ADMIN_PROFILE_FIELDS = "user_id,full_name,role,status";
const ADMIN_LEGACY_FIELDS = "id,auth_user_id,full_name,email,role,status";
const ADMIN_SESSION_CACHE_HEADERS = { "Cache-Control": "no-store, max-age=0" };
const ADMIN_SESSION_ERROR_MESSAGE =
  "[ADS-500] \u062A\u0639\u0630\u0631 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u062C\u0644\u0633\u0629 \u0627\u0644\u0623\u062F\u0645\u0646 \u0627\u0644\u062D\u0627\u0644\u064A\u0629.";

/**
 * Finalizes one admin session response with CORS and security headers.
 *
 * @param {Response} response - Raw response.
 * @param {Request} request - Incoming request.
 * @returns {Response} Hardened response.
 */
function finalizeResponse(response, request) {
  return withSecurityHeaders(
    withCors(response, request, ADMIN_SESSION_METHODS),
    ADMIN_SESSION_CACHE_HEADERS
  );
}

/**
 * Loads the stored admin profile rows for one authenticated user.
 *
 * @param {{
 *   adminClient: import("@supabase/supabase-js").SupabaseClient,
 *   user: { email?: string | null, id?: string | null }
 * }} input - Lookup context.
 * @returns {Promise<{ legacyUser: Record<string, unknown> | null, profile: Record<string, unknown> | null }>} Matching rows.
 */
async function loadAdminSessionRows(input) {
  const userId = String(input?.user?.id || "").trim();
  const email = String(input?.user?.email || "").trim();
  const [profileResult, legacyResult] = await Promise.all([
    input.adminClient.from("user_profiles").select(ADMIN_PROFILE_FIELDS).eq("user_id", userId).maybeSingle(),
    email
      ? input.adminClient.from("app_users").select(ADMIN_LEGACY_FIELDS).ilike("email", email).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    legacyUser: legacyResult?.data || null,
    profile: profileResult?.data || null,
  };
}

/**
 * Builds the public admin session payload returned to the browser.
 *
 * @param {{
 *   legacyUser: Record<string, unknown> | null,
 *   profile: Record<string, unknown> | null,
 *   user: { app_metadata?: { role?: string }, email?: string | null, id?: string | null, user_metadata?: { role?: string } }
 * }} input - Authenticated user context.
 * @returns {{ email: string, fullName: string, id: string, role: string, status: string }} Normalized admin payload.
 */
function buildAdminSessionPayload(input) {
  return {
    email: String(input?.user?.email || input?.legacyUser?.email || "").trim(),
    fullName: getAdminDisplayName({
      fallbackEmail: input?.user?.email || null,
      legacyUser: input?.legacyUser,
      profile: input?.profile,
    }),
    id: String(input?.user?.id || input?.profile?.user_id || input?.legacyUser?.auth_user_id || "").trim(),
    role: String(
      input?.profile?.role
      || input?.legacyUser?.role
      || input?.user?.app_metadata?.role
      || input?.user?.user_metadata?.role
      || "user"
    ).trim().toLowerCase(),
    status: String(input?.profile?.status || input?.legacyUser?.status || "active").trim().toLowerCase(),
  };
}

/**
 * Builds request handlers with injectable dependencies for tests.
 *
 * @param {{
 *   createSupabaseAdmin?: typeof createSupabaseAdmin,
 *   errorResponse?: typeof errorResponse,
 *   requireAdminAccess?: typeof requireAdminAccess,
 *   successResponse?: typeof successResponse
 * }} [dependencies={}] - Optional injected dependencies.
 * @returns {{ onRequestGet: (context: EventContext) => Promise<Response>, onRequestOptions: (context: EventContext) => Response }} Admin session handlers.
 */
export function createAdminSessionHandlers(dependencies = {}) {
  const createAdminClient = dependencies.createSupabaseAdmin || createSupabaseAdmin;
  const requireAccess = dependencies.requireAdminAccess || requireAdminAccess;
  const respondWithError = dependencies.errorResponse || errorResponse;
  const respondWithSuccess = dependencies.successResponse || successResponse;

  return {
    async onRequestGet(context) {
      const access = await requireAccess(context.request, context.env);
      if (access.errorResponse) {
        return finalizeResponse(access.errorResponse, context.request);
      }

      try {
        const adminClient = createAdminClient(context.env);
        const sessionRows = await loadAdminSessionRows({ adminClient, user: access.user || {} });
        const payload = buildAdminSessionPayload({ ...sessionRows, user: access.user || {} });

        return finalizeResponse(respondWithSuccess({ user: payload }, 200), context.request);
      } catch (error) {
        console.error("[ADS-500] Failed to resolve admin session.", error);
        return finalizeResponse(respondWithError(ADMIN_SESSION_ERROR_MESSAGE, 500), context.request);
      }
    },

    onRequestOptions(context) {
      return withSecurityHeaders(
        handlePreflight(context.request, ADMIN_SESSION_METHODS),
        ADMIN_SESSION_CACHE_HEADERS
      );
    },
  };
}

const handlers = createAdminSessionHandlers();

export const onRequestGet = handlers.onRequestGet;
export const onRequestOptions = handlers.onRequestOptions;
