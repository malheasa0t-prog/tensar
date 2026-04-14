import SiteFooterClient from "./SiteFooterClient";
import { getSiteSettings } from "@/lib/siteSettings";

export default async function SiteFooter({ siteSettings: initialSiteSettings = null }) {
  const siteSettings = initialSiteSettings || (await getSiteSettings());
  return <SiteFooterClient siteSettings={siteSettings} />;
}
