import { normalizeSiteSettings } from "./contactChannels.js";
import { loadSupabaseClient } from "./loadSupabaseClient.js";

/**
 * Resolves the Supabase client used for loading site settings.
 *
 * @param {Record<string, unknown> | null | undefined} client
 * @returns {Promise<Record<string, unknown>>}
 */
async function resolveSiteSettingsClient(client) {
  return client || loadSupabaseClient();
}

/**
 * Loads site settings through the client SDK and normalizes the result.
 *
 * @param {Record<string, unknown>} [client]
 * @returns {Promise<ReturnType<typeof normalizeSiteSettings>>}
 */
export async function loadSiteSettingsClient(client) {
  const resolvedClient = await resolveSiteSettingsClient(client);
  const { data } = await resolvedClient
    .from("settings")
    .select("data")
    .limit(1)
    .maybeSingle();

  return normalizeSiteSettings(data?.data);
}
