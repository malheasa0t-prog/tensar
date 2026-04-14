import { supabase } from "./supabaseClient.js";
import { normalizeSiteSettings } from "./contactChannels.js";

/**
 * Loads site settings through the client SDK and normalizes the result.
 *
 * @param {typeof supabase} [client=supabase]
 * @returns {Promise<ReturnType<typeof normalizeSiteSettings>>}
 */
export async function loadSiteSettingsClient(client = supabase) {
  const { data } = await client.from("settings").select("data").limit(1).maybeSingle();
  return normalizeSiteSettings(data?.data);
}
