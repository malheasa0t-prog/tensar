import { getUserFromRequest } from "../lib/auth.mjs";
import { createAdminSupabaseClient } from "../lib/env.mjs";
import { errorResponse, jsonResponse, parseJsonBody } from "../lib/http.mjs";
import { validateProfileInput } from "../lib/profile.mjs";

/**
 * Loads the authenticated user profile snapshot.
 *
 * @param {Request} request
 * @param {Record<string, unknown>} env
 * @returns {Promise<Response>}
 */
export async function handleProfileGetRequest(request, env) {
  const { error, user } = await getUserFromRequest(request, env);
  if (error || !user) {
    return errorResponse("Unauthorized", 401);
  }

  const adminClient = createAdminSupabaseClient(env);
  const { data, error: profileError } = await adminClient
    .from("user_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    return errorResponse("Failed to load profile", 500);
  }

  return jsonResponse({
    success: true,
    data: {
      created_at: user.created_at,
      email: user.email,
      last_sign_in_at: user.last_sign_in_at,
      profile: data || null
    }
  });
}

/**
 * Persists profile edits for the authenticated user.
 *
 * @param {Request} request
 * @param {Record<string, unknown>} env
 * @returns {Promise<Response>}
 */
export async function handleProfilePatchRequest(request, env) {
  const { error, user } = await getUserFromRequest(request, env);
  if (error || !user) {
    return errorResponse("Unauthorized", 401);
  }

  const body = await parseJsonBody(request);
  if (!body) {
    return errorResponse("بيانات الطلب غير صالحة", 400);
  }

  const { errors, payload } = validateProfileInput(body);
  if (errors.length > 0) {
    return errorResponse(errors[0], 400);
  }

  const adminClient = createAdminSupabaseClient(env);
  const updateResponse = await adminClient
    .from("user_profiles")
    .update(payload)
    .eq("user_id", user.id)
    .select("user_id")
    .maybeSingle();

  if (updateResponse.error) {
    return errorResponse("Failed to update profile", 500);
  }

  if (!updateResponse.data?.user_id) {
    const { error: upsertError } = await adminClient
      .from("user_profiles")
      .upsert([{ user_id: user.id, ...payload }], { onConflict: "user_id" });

    if (upsertError) {
      return errorResponse("Failed to update profile", 500);
    }
  }

  return jsonResponse({ success: true, message: "تم تحديث الملف الشخصي بنجاح" });
}
