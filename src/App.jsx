/**
 * Main Application Shell.
 *
 * Replaces the Next.js RootLayout. Loads site settings on mount,
 * wraps the app in providers, and renders routes via Outlet.
 */

import dynamic from 'next/dynamic';
import { useState, useEffect, Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import ClientProviders from '@/components/ClientProviders';
import ErrorBoundary from '@/components/ErrorBoundary';
import PageTransitionShell from '@/components/PageTransitionShell';
import RouteSuspenseFallback from '@/components/RouteSuspenseFallback';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import { normalizeSiteSettings } from '@/lib/contactChannels';
import { fetchHeaderSnapshot } from '@/services/headerService';

const AiChatbot = dynamic(() => import('@/components/AiChatbot'), {
  loading: () => null,
  ssr: false,
});

/**
 * Root application component that manages global state and layout.
 *
 * @returns {JSX.Element}
 */
export default function App() {
  const [siteSettings, setSiteSettings] = useState(() => normalizeSiteSettings());
  const [dynamicLinks, setDynamicLinks] = useState([]);
  const location = useLocation();
  const errorBoundaryResetKey = `${location.pathname}${location.search}`;

  useEffect(() => {
    let cancelled = false;
    let idleCallbackId = 0;
    let timeoutId = 0;

    async function loadSiteData() {
      try {
        const snapshot = await fetchHeaderSnapshot();

        if (cancelled) return;

        setSiteSettings(snapshot.siteSettings);
        setDynamicLinks(snapshot.dynamicLinks);
      } catch (error) {
        console.error('[APP-500] Failed to load site data:', error);
      }
    }

    function scheduleLoad() {
      void loadSiteData();
    }

    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
      idleCallbackId = window.requestIdleCallback(scheduleLoad, { timeout: 1500 });
    } else {
      timeoutId = window.setTimeout(scheduleLoad, 180);
    }

    return () => {
      cancelled = true;

      if (idleCallbackId && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleCallbackId);
      }

      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <ErrorBoundary resetKey={errorBoundaryResetKey}>
      <div className="font-cairo font-inter">
        <ClientProviders
          initialDynamicLinks={dynamicLinks}
          initialSiteSettings={siteSettings}
        >
          <a href="#main-content" className="skip-link">
            تجاوز إلى المحتوى
          </a>
          <SiteHeader />
          <main id="main-content">
            <PageTransitionShell>
              <Suspense fallback={<RouteSuspenseFallback pathname={location.pathname} />}>
                <Outlet />
              </Suspense>
            </PageTransitionShell>
          </main>
          <SiteFooter siteSettings={siteSettings} />
          <AiChatbot />
        </ClientProviders>
      </div>
    </ErrorBoundary>
  );
}
