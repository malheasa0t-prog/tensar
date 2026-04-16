import { buildAdminRuntimePayload } from "../lib/env.mjs";
import { errorResponse, jsonResponse } from "../lib/http.mjs";

/**
 * Returns the public runtime config required by the legacy admin shell.
 *
 * @param {Record<string, unknown>} env
 * @returns {Response}
 */
export function handleAdminRuntimeRequest(env) {
  try {
    const payload = buildAdminRuntimePayload(env);

    return jsonResponse({
      success: true,
      supabaseUrl: payload.supabaseUrl,
      supabasePublishableKey: payload.supabasePublishableKey,
      writeEnabled: payload.writeEnabled
    });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Legacy admin runtime config is unavailable.",
      500
    );
  }
}
