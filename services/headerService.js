import { normalizeSiteSettings } from "../lib/contactChannels.js";
import {
  buildHeaderCategoryLinks,
  resolveHeaderUserLabel,
} from "../lib/headerSnapshotModel.js";
import { loadSiteSettingsClient } from "../lib/siteSettingsClient.js";
import { supabase } from "../lib/supabaseClient.js";

const LOGIN_LABEL = "تسجيل الدخول";

export { buildHeaderCategoryLinks, resolveHeaderUserLabel };

/**
 * Checks whether auth metadata already provides a usable public display name.
 *
 * @param {Record<string, unknown> | null | undefined} user
 * @returns {boolean}
 */
function hasAuthDisplayName(user) {
  const metadata = user?.user_metadata || {};
  return Boolean(
    String(metadata.full_name || metadata.name || metadata.display_name || "").trim()
  );
}

/**
 * Loads header settings and the visible root categories.
 *
 * @param {typeof supabase} [client=supabase]
 * @returns {Promise<{ siteSettings: ReturnType<typeof normalizeSiteSettings>, dynamicLinks: Array<{ href: string, label: string, id: string, image: string }> }>}
 */
export async function fetchHeaderSnapshot(client = supabase) {
  const siteSettings = await loadSiteSettingsClient(client).catch(() => normalizeSiteSettings());
  const response = await client
    .from("categories")
    .select("*")
    .eq("status", "active")
    .is("parent_id", null)
    .order("sort_order", { ascending: true });

  const categories = response.error || !Array.isArray(response.data) ? [] : response.data;
  return {
    siteSettings,
    dynamicLinks: buildHeaderCategoryLinks({ categories, siteSettings }),
  };
}

/**
 * Loads the authenticated user snapshot used by the header CTA.
 *
 * @param {typeof supabase} [client=supabase]
 * @returns {Promise<{
 *   unreadNotifications: number,
 *   user: Record<string, unknown> | null,
 *   userLabel: string,
 *   walletBalance: number,
 * }>}
 */
export async function fetchHeaderAuthSnapshot(client = supabase) {
  const authResponse = await client.auth.getUser();
  const user = authResponse?.data?.user || null;

  if (!user) {
    return {
      unreadNotifications: 0,
      user: null,
      userLabel: LOGIN_LABEL,
      walletBalance: 0,
    };
  }

  const shouldLoadProfile = !hasAuthDisplayName(user);
  const [profileResponse, walletResponse, notificationsResponse] = await Promise.all([
    shouldLoadProfile
      ? client
          .from("user_profiles")
          .select("full_name")
          .eq("user_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    client
      .from("wallets")
      .select("balance")
      .eq("user_id", user.id)
      .maybeSingle(),
    client
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false),
  ]);

  return {
    unreadNotifications: Number(notificationsResponse?.count || 0),
    user,
    userLabel: resolveHeaderUserLabel({
      user,
      profileFullName: profileResponse?.data?.full_name || "",
    }),
    walletBalance: Number(walletResponse?.data?.balance || 0),
  };
}

/**
 * Subscribes to auth changes relevant to the public header.
 *
 * @param {() => void | Promise<void>} onChange
 * @param {typeof supabase} [client=supabase]
 * @returns {() => void}
 */
export function subscribeToHeaderAuthChanges(onChange, client = supabase) {
  if (typeof onChange !== "function") {
    return () => {};
  }

  const {
    data: { subscription },
  } = client.auth.onAuthStateChange(() => {
    void onChange();
  });

  return () => {
    subscription?.unsubscribe?.();
  };
}
