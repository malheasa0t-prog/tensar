import HomeShowcaseSections from "@/components/home/HomeShowcaseSections";
import HomeHeroSection from "../components/home/HomeHeroSection.jsx";
import { useAsyncPageData } from "../hooks/useAsyncPageData.js";
import { loadHomePageSnapshot } from "../data/publicPageData.js";

const EMPTY_HOME_DATA = {
  featuredCategories: [],
  siteSettings: null,
  socialLinks: [],
  whatsappSupportLink: ""
};

/**
 * Renders the homepage in the non-Next copy.
 *
 * @returns {JSX.Element}
 */
export default function HomeRoute() {
  const { data } = useAsyncPageData(loadHomePageSnapshot, [], EMPTY_HOME_DATA);

  return (
    <div className="home-purple">
      <HomeHeroSection
        featuredCategories={data.featuredCategories}
        hero={data.siteSettings?.hero}
        promoBanners={data.siteSettings?.homepage?.promoBanners}
        trustBar={data.siteSettings?.trustBar}
      />
      <HomeShowcaseSections
        socialLinks={data.socialLinks.slice(0, 4)}
        whatsappSupportLink={data.whatsappSupportLink}
      />
    </div>
  );
}
