/**
 * Home Page — Client-side version.
 *
 * Loads featured categories and site settings on mount,
 * then renders the Hero and Showcase sections.
 */

'use client';

import { useState, useEffect } from 'react';
import '@/app/techfix-pages.css';
import '@/app/techfix-home-purple.css';
import HomeHeroSection from '@/components/home/HomeHeroSection';
import HomeShowcaseSections from '@/components/home/HomeShowcaseSections';
import HomePageSkeleton from '@/components/HomePageSkeleton';
import { getSocialLinks, getWhatsappSupportLink } from '@/lib/contactChannels';
import { getPublicSiteSnapshot } from '@/lib/publicSiteSnapshot';

/**
 * Renders the TechZone home page with dynamic hero and showcase sections.
 *
 * @returns {JSX.Element}
 */
export default function HomePage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        const snapshot = await getPublicSiteSnapshot();
        if (!cancelled) setData(snapshot);
      } catch (error) {
        console.error('HomePage: failed to load data', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();
    return () => { cancelled = true; };
  }, []);

  if (loading || !data) {
    return <HomePageSkeleton />;
  }

  const { featuredCategories, siteSettings } = data;

  return (
    <div className="home-purple">
      <HomeHeroSection
        featuredCategories={featuredCategories}
        hero={siteSettings.hero}
        promoBanners={siteSettings.homepage?.promoBanners}
        trustBar={siteSettings.trustBar}
      />
      <HomeShowcaseSections
        socialLinks={getSocialLinks(siteSettings).slice(0, 4)}
        whatsappSupportLink={getWhatsappSupportLink(siteSettings)}
      />
    </div>
  );
}
