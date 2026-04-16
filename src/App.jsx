/**
 * Main Application Shell.
 *
 * Replaces the Next.js RootLayout. Loads site settings on mount,
 * wraps the app in providers, and renders routes via Outlet.
 */

import { useState, useEffect, Suspense } from 'react';
import { Outlet, useLocation, ScrollRestoration } from 'react-router-dom';
import ClientProviders from '@/components/ClientProviders';
import SiteHeader from '@/components/SiteHeader';
import SiteFooter from '@/components/SiteFooter';
import AiChatbot from '@/components/AiChatbot';
import RouteLoadingScreen from '@/components/RouteLoadingScreen';
import { supabase } from '@/lib/supabaseClient';
import { normalizeSiteSettings } from '@/lib/contactChannels';
import { buildHeaderCategoryLinks } from '@/lib/headerSnapshotModel';
import { selectHomepageCategories } from '@/lib/techfixModel';

/**
 * Root application component that manages global state and layout.
 *
 * @returns {JSX.Element}
 */
export default function App() {
  const [siteSettings, setSiteSettings] = useState(() => normalizeSiteSettings());
  const [dynamicLinks, setDynamicLinks] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;

    async function loadSiteData() {
      try {
        const [settingsResult, categoriesResult] = await Promise.all([
          supabase.from('settings').select('data').limit(1).maybeSingle(),
          supabase
            .from('categories')
            .select('*')
            .eq('status', 'active')
            .is('parent_id', null)
            .order('sort_order', { ascending: true }),
        ]);

        if (cancelled) return;

        const settings = normalizeSiteSettings(settingsResult.data?.data);
        const categories =
          categoriesResult.error || !Array.isArray(categoriesResult.data)
            ? []
            : categoriesResult.data;

        setSiteSettings(settings);
        setDynamicLinks(buildHeaderCategoryLinks({ categories, siteSettings: settings }));
      } catch (error) {
        console.error('Failed to load site data:', error);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }

    loadSiteData();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="font-cairo font-inter">
      <ClientProviders
        initialDynamicLinks={dynamicLinks}
        initialSiteSettings={siteSettings}
      >
        <a href="#main-content" className="skip-link">
          تجاوز إلى المحتوى
        </a>
        <SiteHeader />
        <div id="main-content">
          <Suspense fallback={<RouteLoadingScreen />}>
            <Outlet />
          </Suspense>
        </div>
        <SiteFooter siteSettings={siteSettings} />
        <AiChatbot />
      </ClientProviders>
    </div>
  );
}
