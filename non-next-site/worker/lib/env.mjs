import { createClient } from "@supabase/supabase-js";

/**
 * Reads one runtime environment variable.
 *
 * @param {Record<string, unknown>} env
 * @param {string[]} names
 * @returns {string}
 * @throws {Error}
 */
export function readRequiredEnvValue(env, names) {
  const value = names.map((name) => String(env?.[name] || "").trim()).find(Boolean);

  if (!value) {
    throw new Error(`Missing required environment value: ${names.join(" or ")}`);
  }

  return value;
}

/**
 * Resolves the public Supabase key for browser-compatible access.
 *
 * @param {Record<string, unknown>} env
 * @returns {string}
 */
export function resolvePublicSupabaseKey(env) {
  return readRequiredEnvValue(env, [
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  ]);
}

/**
 * Builds the admin runtime payload for public bootstrap consumers.
 *
 * @param {Record<string, unknown>} env
 * @returns {{ supabasePublishableKey: string, supabaseUrl: string, writeEnabled: boolean }}
 */
export function buildAdminRuntimePayload(env) {
  return {
    supabasePublishableKey: resolvePublicSupabaseKey(env),
    supabaseUrl: readRequiredEnvValue(env, ["NEXT_PUBLIC_SUPABASE_URL"]),
    writeEnabled: String(env?.ENABLE_LEGACY_ADMIN_WRITE || "").trim().toLowerCase() === "true"
  };
}

/**
 * Creates the public Supabase client used for auth and safe reads.
 *
 * @param {Record<string, unknown>} env
 * @returns {import("@supabase/supabase-js").SupabaseClient}
 */
export function createPublicSupabaseClient(env) {
  return createClient(
    readRequiredEnvValue(env, ["NEXT_PUBLIC_SUPABASE_URL"]),
    resolvePublicSupabaseKey(env),
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/**
 * Creates the privileged Supabase client used for secure mutations.
 *
 * @param {Record<string, unknown>} env
 * @returns {import("@supabase/supabase-js").SupabaseClient}
 */
export function createAdminSupabaseClient(env) {
  return createClient(
    readRequiredEnvValue(env, ["NEXT_PUBLIC_SUPABASE_URL"]),
    readRequiredEnvValue(env, ["SUPABASE_SERVICE_ROLE_KEY"]),
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
