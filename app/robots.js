import { getSiteOrigin } from "@/lib/seo";

/**
 * Generates crawler rules for public routes only.
 *
 * @returns {{ rules: { userAgent: string, allow: string, disallow: string[] }, sitemap: string[], host: string }}
 */
export default function robots() {
  const siteOrigin = getSiteOrigin();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/admin.html",
        "/auth",
        "/checkout",
        "/dashboard",
        "/deposit",
      ],
    },
    sitemap: [`${siteOrigin}/sitemap.xml`],
    host: siteOrigin,
  };
}
