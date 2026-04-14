import "./techfix-pages.css";
import "./techfix-home-purple.css";
import HomeHeroSection from "@/components/home/HomeHeroSection";
import HomeShowcaseSections from "@/components/home/HomeShowcaseSections";
import {
  getSocialLinks,
  getWhatsappSupportLink,
} from "@/lib/contactChannels";
import { getPublicSiteSnapshot } from "@/lib/publicSiteSnapshot";

export const revalidate = 60;

export default async function HomePage() {
  const { featuredCategories, siteSettings } = await getPublicSiteSnapshot();

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
