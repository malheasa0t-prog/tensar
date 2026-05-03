/**
 * Main application shell.
 *
 * Loads site settings on mount, wraps the app with shared providers,
 * and renders the public layout around the active route tree.
 */

import { lazy, Suspense, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import ClientProviders from '@/components/ClientProviders';
import ErrorBoundary from '@/components/ErrorBoundary';
import PageTransitionShell from '@/components/PageTransitionShell';
import RouteSuspenseFallback from '@/components/RouteSuspenseFallback';
import SiteFooter from '@/components/SiteFooter';
import SiteHeader from '@/components/SiteHeader';
import { normalizeSiteSettings } from '@/lib/contactChannels';
import { fetchHeaderSnapshot } from '@/services/headerService';

const AiChatbot = lazy(() => import('@/components/AiChatbot'));
const SITE_SKIP_LINK_LABEL =
  '\u062A\u062C\u0627\u0648\u0632 \u0625\u0644\u0649 \u0627\u0644\u0645\u062D\u062A\u0648\u0649';
const SITE_DATA_IDLE_TIMEOUT_MS = 500;
const SITE_DATA_FALLBACK_TIMEOUT_MS = 50;
const CHATBOT_IDLE_TIMEOUT_MS = 3000;

/**
 * Enables the chatbot after the first navigation-critical work settles.
 *
 * @returns {boolean}
 */
function useDeferredChatbotEnabled() {
  const [chatbotEnabled, setChatbotEnabled] = useState(false);

  useEffect(() => {
    let idleCallbackId = 0;
    let timeoutId = 0;

    function enableChatbot() {
      setChatbotEnabled(true);
    }

    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
      idleCallbackId = window.requestIdleCallback(enableChatbot, {
        timeout: CHATBOT_IDLE_TIMEOUT_MS,
      });
    } else {
      timeoutId = window.setTimeout(enableChatbot, CHATBOT_IDLE_TIMEOUT_MS);
    }

    return () => {
      if (idleCallbackId && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleCallbackId);
      }

      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, []);

  return chatbotEnabled;
}

/**
 * Root application component that manages global state and layout.
 *
 * @returns {JSX.Element}
 */
export default function App() {
  const [siteSettings, setSiteSettings] = useState(() => normalizeSiteSettings());
  const [dynamicLinks, setDynamicLinks] = useState([]);
  const chatbotEnabled = useDeferredChatbotEnabled();
  const location = useLocation();
  const errorBoundaryResetKey = `${location.pathname}${location.search}`;

  useEffect(() => {
    let cancelled = false;
    let idleCallbackId = 0;
    let timeoutId = 0;

    /**
     * Loads the current site navigation snapshot.
     *
     * @returns {Promise<void>}
     */
    async function loadSiteData() {
      try {
        const snapshot = await fetchHeaderSnapshot();

        if (cancelled) {
          return;
        }

        setSiteSettings(snapshot.siteSettings);
        setDynamicLinks(snapshot.dynamicLinks);
      } catch (error) {
        console.error('[APP-500] Failed to load site data:', error);
      }
    }

    /**
     * Schedules loading once the main thread is idle.
     *
     * @returns {void}
     */
    function scheduleLoad() {
      void loadSiteData();
    }

    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
      idleCallbackId = window.requestIdleCallback(scheduleLoad, {
        timeout: SITE_DATA_IDLE_TIMEOUT_MS,
      });
    } else {
      timeoutId = window.setTimeout(scheduleLoad, SITE_DATA_FALLBACK_TIMEOUT_MS);
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
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  }, [location.pathname]);

  return (
    <ErrorBoundary resetKey={errorBoundaryResetKey}>
      <div className="font-cairo font-inter">
        <ClientProviders
          initialDynamicLinks={dynamicLinks}
          initialSiteSettings={siteSettings}
        >
          <a href="#main-content" className="skip-link">
            {SITE_SKIP_LINK_LABEL}
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
          {chatbotEnabled ? (
            <Suspense fallback={null}>
              <AiChatbot />
            </Suspense>
          ) : null}
        </ClientProviders>
      </div>
    </ErrorBoundary>
  );
}
