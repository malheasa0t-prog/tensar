/**
 * Site Settings loader — Client-side version.
 *
 * Loads settings from Supabase using the public (anon) client.
 * Replaces the server-side version that used supabaseServer and React cache.
 */

import { supabase } from '@/lib/supabaseClient';
import { normalizeSiteSettings } from '@/lib/contactChannels';

/**
 * Fetches site settings from the database and normalizes them.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} [client]
 * @returns {Promise<ReturnType<typeof normalizeSiteSettings>>}
 */
export async function getSiteSettings(client = supabase) {
  const { data } = await client.from('settings').select('data').limit(1).maybeSingle();
  return normalizeSiteSettings(data?.data);
}
