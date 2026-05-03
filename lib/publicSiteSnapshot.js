/**
 * Public Site Snapshot — Client-side version.
 *
 * Loads the shared public-site snapshot used by the layout and client providers.
 * Replaces the server-side version that used supabaseServer and React cache.
 */

import { buildHeaderCategoryLinks } from '@/lib/headerSnapshotModel';
import { selectHomepageCategories } from '@/lib/techfixModel';
import { getSiteSettings } from '@/lib/siteSettings';
import { loadSupabaseClient } from '@/lib/loadSupabaseClient';

/**
 * Loads site settings, categories, and dynamic links.
 *
 * @returns {Promise<{
 *   dynamicLinks: Array<{ href: string, label: string, id: string, image: string }>,
 *   featuredCategories: Array<Record<string, unknown>>,
 *   siteSettings: Awaited<ReturnType<typeof getSiteSettings>>,
 * }>}
 */
export async function getPublicSiteSnapshot() {
  const supabase = await loadSupabaseClient();
  const [siteSettings, categoriesResult] = await Promise.all([
    getSiteSettings(supabase),
    supabase
      .from('categories')
      .select('*')
      .eq('status', 'active')
      .is('parent_id', null)
      .order('sort_order', { ascending: true }),
  ]);

  const categories =
    categoriesResult.error || !Array.isArray(categoriesResult.data)
      ? []
      : categoriesResult.data;

  return {
    siteSettings,
    dynamicLinks: buildHeaderCategoryLinks({ categories, siteSettings }),
    featuredCategories: selectHomepageCategories(categories, 6),
  };
}
