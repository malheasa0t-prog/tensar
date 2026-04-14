import { cache } from "react";
import { buildHeaderCategoryLinks } from "@/lib/headerSnapshotModel";
import { selectHomepageCategories } from "@/lib/techfixModel";
import { getSiteSettings } from "@/lib/siteSettings";
import { supabaseServer } from "@/lib/supabaseServer";

/**
 * Loads the shared public-site snapshot used by the layout and client providers.
 *
 * @returns {Promise<{
 *   dynamicLinks: Array<{ href: string, label: string, id: string, image: string }>,
 *   featuredCategories: Array<Record<string, unknown>>,
 *   siteSettings: Awaited<ReturnType<typeof getSiteSettings>>,
 * }>}
 */
export const getPublicSiteSnapshot = cache(async function getPublicSiteSnapshot() {
  const [siteSettings, categoriesResult] = await Promise.all([
    getSiteSettings(),
    supabaseServer
      .from("categories")
      .select("*")
      .eq("status", "active")
      .is("parent_id", null)
      .order("sort_order", { ascending: true }),
  ]);

  const categories =
    categoriesResult.error || !Array.isArray(categoriesResult.data)
      ? []
      : categoriesResult.data;

  return {
    siteSettings,
    dynamicLinks: buildHeaderCategoryLinks({ categories, siteSettings }),
    featuredCategories: selectHomepageCategories(categories, 4),
  };
});
