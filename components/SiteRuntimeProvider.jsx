"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { normalizeSiteSettings } from "@/lib/contactChannels";

const DEFAULT_SITE_SETTINGS = normalizeSiteSettings();
const DEFAULT_AUTH_SNAPSHOT = {
  unreadNotifications: 0,
  user: null,
  userLabel: "تسجيل الدخول",
  walletBalance: 0,
};

const SiteRuntimeContext = createContext({
  authLoading: true,
  dynamicLinks: [],
  siteSettings: DEFAULT_SITE_SETTINGS,
  ...DEFAULT_AUTH_SNAPSHOT,
});

/**
 * Returns the shared public-site runtime snapshot for client components.
 *
 * @returns {{
 *   authLoading: boolean,
 *   dynamicLinks: Array<{ href: string, label: string, id: string, image: string }>,
 *   siteSettings: ReturnType<typeof normalizeSiteSettings>,
 *   unreadNotifications: number,
 *   user: Record<string, unknown> | null,
 *   userLabel: string,
 *   walletBalance: number,
 * }}
 */
export function useSiteRuntime() {
  return useContext(SiteRuntimeContext);
}

/**
 * Shares site settings and the current auth snapshot across public widgets.
 *
 * @param {{
 *   children: import("react").ReactNode,
 *   initialDynamicLinks?: Array<{ href: string, label: string, id: string, image: string }>,
 *   initialSiteSettings?: ReturnType<typeof normalizeSiteSettings>,
 * }} props
 * @returns {JSX.Element}
 */
export default function SiteRuntimeProvider({
  children,
  initialDynamicLinks = [],
  initialSiteSettings = DEFAULT_SITE_SETTINGS,
}) {
  const [authLoading, setAuthLoading] = useState(true);
  const [authSnapshot, setAuthSnapshot] = useState(DEFAULT_AUTH_SNAPSHOT);
  const [headerData, setHeaderData] = useState({
    dynamicLinks: Array.isArray(initialDynamicLinks) ? initialDynamicLinks : [],
    siteSettings:
      initialSiteSettings && typeof initialSiteSettings === "object"
        ? initialSiteSettings
        : DEFAULT_SITE_SETTINGS,
  });

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};

    /**
     * Refreshes header nav links + branding when categories/settings change.
     *
     * @returns {Promise<void>}
     */
    async function refreshHeaderData() {
      const { fetchHeaderSnapshot } = await import("@/services/headerService");
      const snapshot = await fetchHeaderSnapshot().catch(() => null);
      if (!active || !snapshot) {
        return;
      }
      setHeaderData({
        dynamicLinks: Array.isArray(snapshot.dynamicLinks) ? snapshot.dynamicLinks : [],
        siteSettings: snapshot.siteSettings || DEFAULT_SITE_SETTINGS,
      });
    }

    async function subscribeToHeaderDataChanges() {
      const { subscribeToHeaderData } = await import("@/services/headerService");
      if (!active) {
        return;
      }
      unsubscribe = subscribeToHeaderData(() => refreshHeaderData());
    }

    void subscribeToHeaderDataChanges();

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};

    /**
     * Refreshes the auth-dependent header snapshot once for all consumers.
     *
     * @returns {Promise<void>}
     */
    async function refreshAuthSnapshot() {
      const { fetchHeaderAuthSnapshot } = await import("@/services/headerService");
      const snapshot = await fetchHeaderAuthSnapshot().catch(() => DEFAULT_AUTH_SNAPSHOT);

      if (!active) {
        return;
      }

      setAuthSnapshot(snapshot);
      setAuthLoading(false);
    }

    /**
     * Attaches the auth subscription after the Supabase-backed service is needed.
     *
     * @returns {Promise<void>}
     */
    async function subscribeToAuthSnapshotChanges() {
      const { subscribeToHeaderAuthChanges } = await import("@/services/headerService");

      if (!active) {
        return;
      }

      unsubscribe = subscribeToHeaderAuthChanges(() => refreshAuthSnapshot());
    }

    void refreshAuthSnapshot();
    void subscribeToAuthSnapshotChanges();
    window.addEventListener("tz-notifications-updated", refreshAuthSnapshot);

    return () => {
      active = false;
      unsubscribe();
      window.removeEventListener("tz-notifications-updated", refreshAuthSnapshot);
    };
  }, []);

  const value = useMemo(
    () => ({
      authLoading,
      dynamicLinks: headerData.dynamicLinks,
      siteSettings: headerData.siteSettings,
      ...authSnapshot,
    }),
    [authLoading, authSnapshot, headerData]
  );

  return <SiteRuntimeContext.Provider value={value}>{children}</SiteRuntimeContext.Provider>;
}
