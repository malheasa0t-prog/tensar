/**
 * Site Footer — Client-side wrapper.
 *
 * Renders the SiteFooterClient with the provided site settings.
 * No longer async since settings are provided by the App shell.
 */

import SiteFooterClient from './SiteFooterClient';

/**
 * @param {{ siteSettings: Record<string, unknown> }} props
 * @returns {JSX.Element}
 */
export default function SiteFooter({ siteSettings }) {
  if (!siteSettings) return null;
  return <SiteFooterClient siteSettings={siteSettings} />;
}
