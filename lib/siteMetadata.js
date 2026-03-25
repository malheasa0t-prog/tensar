import { getSiteSettings } from "@/lib/siteSettings";

export async function getPageMetadata({ title = "", description = "" } = {}) {
  const siteSettings = await getSiteSettings();
  const brandName = siteSettings.company.name || "TechZone";
  const resolvedDescription =
    description ||
    siteSettings.hero.description ||
    siteSettings.company.slogan ||
    "متجر وصيانة احترافية للأجهزة والخدمات التقنية.";
  const resolvedTitle = title ? `${brandName} | ${title}` : brandName;

  return {
    title: resolvedTitle,
    description: resolvedDescription,
    openGraph: {
      title: resolvedTitle,
      description: resolvedDescription,
      siteName: brandName,
      locale: "ar_JO",
      type: "website",
    },
  };
}
