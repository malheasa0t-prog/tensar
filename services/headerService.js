import { normalizeSiteSettings } from "../lib/contactChannels.js";
import {
  buildHeaderCategoryLinks,
  resolveHeaderUserLabel,
} from "../lib/headerSnapshotModel.js";
import { buildCardsRootCategories } from "../lib/cardsCatalogModel.js";
import { loadSupabaseClient } from "../lib/loadSupabaseClient.js";
import { loadSiteSettingsClient } from "../lib/siteSettingsClient.js";
import { subscribeToTableChanges } from "../lib/realtimeTableSubscription.js";

const LOGIN_LABEL = "تسجيل الدخول";

export { buildHeaderCategoryLinks, resolveHeaderUserLabel };

/**
 * Resolves the client used by the public header services.
 *
 * @param {Record<string, unknown> | null | undefined} client
 * @returns {Promise<Record<string, unknown>>}
 */
async function resolveHeaderClient(client) {
  return client || loadSupabaseClient();
}

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
 * @param {Record<string, unknown>} [client]
 * @returns {Promise<{ siteSettings: ReturnType<typeof normalizeSiteSettings>, dynamicLinks: Array<{ href: string, label: string, id: string, image: string }> }>}
 */
const HEADER_CACHE_TTL_MS = 300_000;
let headerSnapshotCache = null;
let headerSnapshotCacheTime = 0;

export async function fetchHeaderSnapshot(client) {
  const now = Date.now();

  if (headerSnapshotCache && now - headerSnapshotCacheTime < HEADER_CACHE_TTL_MS) {
    return headerSnapshotCache;
  }

  const resolvedClient = await resolveHeaderClient(client);
  const siteSettings = await loadSiteSettingsClient(resolvedClient).catch(() =>
    normalizeSiteSettings()
  );
  const [categoriesResponse, servicesResponse] = await Promise.all([
    resolvedClient
      .from("categories")
      .select("*")
      .eq("status", "active")
      .is("parent_id", null)
      .order("sort_order", { ascending: true }),
    resolvedClient
      .from("services")
      .select("category_id,subcategory_id")
      .eq("status", "active"),
  ]);

  const categories = categoriesResponse.error || !Array.isArray(categoriesResponse.data) ? [] : categoriesResponse.data;
  const catalogServices = servicesResponse.error || !Array.isArray(servicesResponse.data) ? [] : servicesResponse.data;
  const cardsRootIds = new Set(
    buildCardsRootCategories({ categories, services: catalogServices }).map((category) => category.id)
  );
  const snapshot = {
    siteSettings,
    dynamicLinks: buildHeaderCategoryLinks({
      categories: categories.filter((category) => !cardsRootIds.has(category.id)),
      siteSettings,
    }),
  };

  headerSnapshotCache = snapshot;
  headerSnapshotCacheTime = now;

  return snapshot;
}

/**
 * Drops the cached header snapshot so the next fetch re-reads categories/settings.
 *
 * @returns {void}
 */
export function invalidateHeaderSnapshotCache() {
  headerSnapshotCache = null;
  headerSnapshotCacheTime = 0;
}

/**
 * Subscribes to category/settings changes so header nav links and branding
 * refresh shortly after an admin edit instead of waiting up to 5 minutes.
 *
 * @param {() => void} onChange
 * @param {Record<string, unknown>} [client]
 * @returns {() => void}
 */
export function subscribeToHeaderData(onChange, client) {
  return subscribeToTableChanges({
    channel: "storefront-header",
    tables: ["categories", "settings"],
    client,
    onChange: () => {
      invalidateHeaderSnapshotCache();
      if (typeof onChange === "function") onChange();
    },
  });
}

/**
 * Loads the authenticated user snapshot used by the header CTA.
 *
 * @param {Record<string, unknown>} [client]
 * @returns {Promise<{
 *   unreadNotifications: number,
 *   user: Record<string, unknown> | null,
 *   userLabel: string,
 *   walletBalance: number,
 * }>}
 */
export async function fetchHeaderAuthSnapshot(client) {
  const resolvedClient = await resolveHeaderClient(client);
  const authResponse = await resolvedClient.auth.getUser();
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
      ? resolvedClient
          .from("user_profiles")
          .select("full_name")
          .eq("user_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    resolvedClient
      .from("wallets")
      .select("balance")
      .eq("user_id", user.id)
      .maybeSingle(),
    resolvedClient
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
 * @param {Record<string, unknown>} [client]
 * @returns {() => void}
 */
export function subscribeToHeaderAuthChanges(onChange, client) {
  if (typeof onChange !== "function") {
    return () => {};
  }

  let active = true;
  let unsubscribe = () => {};

  /**
   * Attaches the auth listener once the client becomes available.
   *
   * @returns {Promise<void>}
   */
  async function attachSubscription() {
    const resolvedClient = await resolveHeaderClient(client);

    if (!active) {
      return;
    }

    const {
      data: { subscription },
    } = resolvedClient.auth.onAuthStateChange(() => {
      void onChange();
    });

    unsubscribe = () => {
      subscription?.unsubscribe?.();
    };
  }

  void attachSubscription();

  return () => {
    active = false;
    unsubscribe();
  };
}
