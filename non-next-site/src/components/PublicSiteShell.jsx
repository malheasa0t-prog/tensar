import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import AiChatbot from "@/components/AiChatbot";
import ClientProviders from "@/components/ClientProviders";
import PageTransitionShell from "@/components/PageTransitionShell";
import SiteFooterClient from "@/components/SiteFooterClient";
import SiteHeader from "@/components/SiteHeader";
import { normalizeSiteSettings } from "@/lib/contactChannels";
import { fetchHeaderSnapshot } from "@/services/headerService";

const FALLBACK_SNAPSHOT = {
  dynamicLinks: [],
  siteSettings: normalizeSiteSettings()
};

/**
 * Shared shell for the parallel non-Next site copy.
 *
 * @returns {JSX.Element}
 */
export default function PublicSiteShell() {
  const [snapshot, setSnapshot] = useState(FALLBACK_SNAPSHOT);

  useEffect(() => {
    let active = true;

    /**
     * Hydrates the shared shell with the latest site settings and dynamic links.
     *
     * @returns {Promise<void>}
     */
    async function hydrateShell() {
      const nextSnapshot = await fetchHeaderSnapshot().catch(() => FALLBACK_SNAPSHOT);
      if (!active) {
        return;
      }

      setSnapshot({
        dynamicLinks: Array.isArray(nextSnapshot.dynamicLinks) ? nextSnapshot.dynamicLinks : [],
        siteSettings:
          nextSnapshot.siteSettings && typeof nextSnapshot.siteSettings === "object"
            ? nextSnapshot.siteSettings
            : FALLBACK_SNAPSHOT.siteSettings
      });
    }

    void hydrateShell();

    return () => {
      active = false;
    };
  }, []);

  return (
    <ClientProviders
      initialDynamicLinks={snapshot.dynamicLinks}
      initialSiteSettings={snapshot.siteSettings}
    >
      <a href="#main-content" className="skip-link">
        تجاوز إلى المحتوى
      </a>
      <SiteHeader />
      <PageTransitionShell>
        <div id="main-content">
          <Outlet />
        </div>
      </PageTransitionShell>
      <SiteFooterClient siteSettings={snapshot.siteSettings} />
      <AiChatbot />
    </ClientProviders>
  );
}
