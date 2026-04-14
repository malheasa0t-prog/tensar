"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { normalizeSiteSettings } from "@/lib/contactChannels";
import {
  fetchHeaderAuthSnapshot,
  subscribeToHeaderAuthChanges,
} from "@/services/headerService";

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

  useEffect(() => {
    let active = true;

    /**
     * Refreshes the auth-dependent header snapshot once for all consumers.
     *
     * @returns {Promise<void>}
     */
    async function refreshAuthSnapshot() {
      const snapshot = await fetchHeaderAuthSnapshot().catch(() => DEFAULT_AUTH_SNAPSHOT);

      if (!active) {
        return;
      }

      setAuthSnapshot(snapshot);
      setAuthLoading(false);
    }

    void refreshAuthSnapshot();
    const unsubscribe = subscribeToHeaderAuthChanges(() => refreshAuthSnapshot());
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
      dynamicLinks: Array.isArray(initialDynamicLinks) ? initialDynamicLinks : [],
      siteSettings:
        initialSiteSettings && typeof initialSiteSettings === "object"
          ? initialSiteSettings
          : DEFAULT_SITE_SETTINGS,
      ...authSnapshot,
    }),
    [authLoading, authSnapshot, initialDynamicLinks, initialSiteSettings]
  );

  return <SiteRuntimeContext.Provider value={value}>{children}</SiteRuntimeContext.Provider>;
}
