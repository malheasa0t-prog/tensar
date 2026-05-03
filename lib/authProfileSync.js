import { canAccessAdminRecord } from '@/lib/adminRoles';
import { loadSupabaseClient } from '@/lib/loadSupabaseClient';

/**
 * Ensures the authenticated user has a profile row synced from auth metadata.
 *
 * @param {{ id?: string, email?: string | null, user_metadata?: Record<string, unknown> }} user
 * @returns {Promise<void>}
 */
export async function syncProfileFromAuthUser(user) {
  if (!user?.id) {
    return;
  }

  const supabase = await loadSupabaseClient();
  const metadata = user.user_metadata || {};
  const payload = {
    user_id: user.id,
    full_name:
      typeof metadata.full_name === 'string' && metadata.full_name.trim()
        ? metadata.full_name.trim()
        : null,
    phone:
      typeof metadata.phone === 'string' && metadata.phone.trim()
        ? metadata.phone.trim()
        : null,
    country:
      typeof metadata.country === 'string' && metadata.country.trim()
        ? metadata.country.trim()
        : null,
    updated_at: new Date().toISOString(),
  };

  await supabase.from('user_profiles').upsert(payload, { onConflict: 'user_id' });
}

/**
 * Resolves the best landing route after authentication.
 *
 * @param {{ id?: string, email?: string | null }} user
 * @returns {Promise<string>}
 */
export async function getPostAuthDestination(user) {
  if (!user?.id) {
    return '/dashboard';
  }

  const supabase = await loadSupabaseClient();
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, status')
    .eq('user_id', user.id)
    .maybeSingle();

  if (canAccessAdminRecord(profile)) {
    return '/admin.html';
  }

  if (user.email) {
    const { data: legacyUser } = await supabase
      .from('app_users')
      .select('role, status')
      .ilike('email', user.email)
      .maybeSingle();

    if (canAccessAdminRecord(legacyUser)) {
      return '/admin.html';
    }
  }

  return '/dashboard';
}
