import { getSiteSettings } from "@/lib/siteSettings";
import { getSiteOrigin, resolveMetadataImageUrls } from "@/lib/seo";

const DEFAULT_DESCRIPTION = "متجر وصيانة احترافية للأجهزة والخدمات التقنية.";

/**
 * Builds normalized metadata for public pages.
 *
 * @param {{
 *   title?: string,
 *   description?: string,
 *   pathname?: string,
 *   images?: unknown,
 *   type?: string
 * }} options
 * @returns {Promise<Record<string, unknown>>}
 */
export async function getPageMetadata({
  title = "",
  description = "",
  pathname = "/",
  images = [],
  type = "website",
  ...rest
} = {}) {
  const siteSettings = await getSiteSettings();
  const brandName = siteSettings.company.name || "TechZone";
  const resolvedDescription =
    description || siteSettings.hero.description || siteSettings.company.slogan || DEFAULT_DESCRIPTION;
  const resolvedTitle = title ? `${brandName} | ${title}` : brandName;
  const openGraphImages = resolveMetadataImageUrls(images);

  return {
    metadataBase: new URL(getSiteOrigin()),
    title: resolvedTitle,
    description: resolvedDescription,
    alternates: {
      canonical: pathname,
    },
    openGraph: {
      title: resolvedTitle,
      description: resolvedDescription,
      siteName: brandName,
      locale: "ar_JO",
      type,
      url: pathname,
      images: openGraphImages,
    },
    twitter: {
      card: "summary_large_image",
      title: resolvedTitle,
      description: resolvedDescription,
      images: openGraphImages,
    },
    ...rest,
  };
}
