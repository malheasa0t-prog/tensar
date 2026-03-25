import SiteFooterClient from "./SiteFooterClient";
import { getSiteSettings } from "@/lib/siteSettings";

export default async function SiteFooter() {
  const siteSettings = await getSiteSettings();
  return <SiteFooterClient siteSettings={siteSettings} />;
}
