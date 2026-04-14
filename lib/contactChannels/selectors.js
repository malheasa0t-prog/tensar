import { SOCIAL_CHANNELS } from "./defaults.js";
import {
  formatSocialDisplay,
  normalizeEmailHref,
  normalizeExternalUrl,
  normalizeMapHref,
  normalizePhoneHref,
  normalizeWhatsappUrl,
} from "./helpers.js";
import { normalizeSiteSettings } from "./normalizers.js";

/**
 * Builds the normalized social links list used across public pages.
 *
 * @param {Record<string, unknown>} [data]
 * @returns {Array<Record<string, unknown>>}
 */
export function getSocialLinks(data = {}) {
  const { company, social, socialDescriptions } = normalizeSiteSettings(data);

  return SOCIAL_CHANNELS.map((channel) => {
    const rawValue = social[channel.key];
    const href =
      channel.key === 'whatsapp'
        ? normalizeWhatsappUrl(rawValue, company.phone)
        : normalizeExternalUrl(rawValue);

    if (!href) {
      return null;
    }

    return {
      ...channel,
      description: socialDescriptions[channel.key] || channel.description,
      href,
      displayValue: formatSocialDisplay(channel.key, rawValue || href),
    };
  }).filter(Boolean);
}

/**
 * Returns the preferred WhatsApp support link from settings.
 *
 * @param {Record<string, unknown>} [data]
 * @returns {string}
 */
export function getWhatsappSupportLink(data = {}) {
  const { company, social } = normalizeSiteSettings(data);
  return normalizeWhatsappUrl(social.whatsapp, company.phone);
}

/**
 * Builds the primary contact methods list shown in the header, footer, and contact page.
 *
 * @param {Record<string, unknown>} [data]
 * @returns {Array<Record<string, unknown>>}
 */
export function getContactMethods(data = {}) {
  const { company } = normalizeSiteSettings(data);
  const whatsappHref = getWhatsappSupportLink(data);

  return [
    company.phone
      ? {
          key: 'phone',
          label: 'اتصال مباشر',
          value: company.phone,
          href: normalizePhoneHref(company.phone),
          icon: 'phone',
          external: false,
        }
      : null,
    company.email
      ? {
          key: 'email',
          label: 'البريد الإلكتروني',
          value: company.email,
          href: normalizeEmailHref(company.email),
          icon: 'mail',
          external: false,
        }
      : null,
    whatsappHref
      ? {
          key: 'whatsapp',
          label: 'واتساب',
          value: 'محادثة مباشرة مع فريق المتجر',
          href: whatsappHref,
          icon: 'whatsapp',
          external: true,
        }
      : null,
    company.address
      ? {
          key: 'address',
          label: 'العنوان',
          value: company.address,
          href: normalizeMapHref(company.address),
          icon: 'map-pin',
          external: true,
        }
      : null,
  ].filter(Boolean);
}
