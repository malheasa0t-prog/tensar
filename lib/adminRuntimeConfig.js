/**
 * Resolves the legacy admin runtime configuration from environment variables.
 *
 * @returns {{
 *   supabaseUrl: string,
 *   supabasePublishableKey: string,
 *   writeEnabled: boolean,
 * }}
 * @throws {Error}
 */
export function getAdminRuntimeConfig() {
  const supabaseUrl = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  const supabasePublishableKey = String(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
      || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      || ''
  ).trim();

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error('Legacy admin runtime config is incomplete.');
  }

  return {
    supabaseUrl,
    supabasePublishableKey,
    writeEnabled: process.env.ENABLE_LEGACY_ADMIN_WRITE === 'true',
  };
}
