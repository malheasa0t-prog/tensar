import {
  DEFAULT_CUSTOM_BUILD,
  PAYMENT_LABELS,
  SOCIAL_CHANNELS,
} from "./defaults.js";

/**
 * Trims a string value safely.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function cleanValue(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Converts a value into a finite number with a fallback.
 *
 * @param {unknown} value
 * @param {number} [fallback]
 * @returns {number}
 */
export function cleanNumber(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

/**
 * Builds an empty social state object keyed by supported channels.
 *
 * @returns {Record<string, string>}
 */
export function createEmptySocialState() {
  return Object.fromEntries(SOCIAL_CHANNELS.map((channel) => [channel.key, '']));
}

/**
 * Normalizes a raw external URL value.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeExternalUrl(value) {
  const trimmed = cleanValue(value);

  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^www\./i.test(trimmed)) return `https://${trimmed}`;

  return `https://${trimmed}`;
}

/**
 * Normalizes a WhatsApp destination from either a URL or a phone number.
 *
 * @param {unknown} value
 * @param {string} [fallbackPhone]
 * @returns {string}
 */
export function normalizeWhatsappUrl(value, fallbackPhone = '') {
  const candidate = cleanValue(value) || cleanValue(fallbackPhone);

  if (!candidate) return '';

  if (
    /^https?:\/\//i.test(candidate) ||
    /wa\.me|whatsapp\.com|api\.whatsapp\.com/i.test(candidate)
  ) {
    return candidate;
  }

  const digits = candidate.replace(/\D/g, '');
  return digits ? `https://wa.me/${digits}` : normalizeExternalUrl(candidate);
}

/**
 * Normalizes a phone href string.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function normalizePhoneHref(value) {
  const trimmed = cleanValue(value);

  if (!trimmed) return '';
  if (/^tel:/i.test(trimmed)) return trimmed;

  return `tel:${trimmed.replace(/\s+/g, '')}`;
}

/**
 * Normalizes an email href string.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeEmailHref(value) {
  const trimmed = cleanValue(value);

  if (!trimmed) return '';
  if (/^mailto:/i.test(trimmed)) return trimmed;

  return `mailto:${trimmed}`;
}

/**
 * Builds a Google Maps search URL from an address string.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeMapHref(value) {
  const trimmed = cleanValue(value);
  return trimmed
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trimmed)}`
    : '';
}

/**
 * Formats a social channel label for UI display.
 *
 * @param {string} channelKey
 * @param {unknown} value
 * @returns {string}
 */
export function formatSocialDisplay(channelKey, value) {
  const trimmed = cleanValue(value);

  if (!trimmed) {
    return channelKey === 'whatsapp' ? 'محادثة مباشرة' : 'افتح الرابط';
  }

  if (channelKey === 'whatsapp') {
    return /^https?:\/\//i.test(trimmed) ? 'محادثة مباشرة' : trimmed;
  }

  return trimmed
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/$/, '');
}

/**
 * Normalizes an array of text strings.
 *
 * @param {unknown} value
 * @param {string[]} [fallback]
 * @returns {string[]}
 */
export function normalizeTextArray(value, fallback = []) {
  if (!Array.isArray(value)) {
    return [...fallback];
  }

  const items = value.map((item) => cleanValue(item)).filter(Boolean);
  return items.length > 0 ? items : [...fallback];
}

/**
 * Normalizes a list of links used by navigation sections.
 *
 * @param {unknown} value
 * @param {Array<{ href: string, label: string }>} fallback
 * @returns {Array<{ href: string, label: string }>}
 */
export function normalizeLinkList(value, fallback) {
  if (!Array.isArray(value)) {
    return fallback.map((item) => ({ ...item }));
  }

  const items = value
    .map((item) => {
      if (typeof item === 'string') {
        const label = cleanValue(item);
        return label ? { href: '#', label } : null;
      }

      if (!item || typeof item !== 'object') {
        return null;
      }

      const href = cleanValue(item.href);
      const label = cleanValue(item.label);

      if (!label || !href) {
        return null;
      }

      return { href, label };
    })
    .filter(Boolean);

  return items.length > 0 ? items : fallback.map((item) => ({ ...item }));
}

/**
 * Normalizes promotional banner items used by the homepage image strip.
 *
 * @param {unknown} value
 * @param {Array<{ image: string, title: string, subtitle?: string, href?: string }>} [fallback]
 * @returns {Array<{ image: string, title: string, subtitle?: string, href: string }>}
 */
export function normalizePromoBannerList(value, fallback = []) {
  if (!Array.isArray(value)) {
    return fallback.map((item) => ({ ...item, href: cleanValue(item.href) || "#" }));
  }

  const items = value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const image = cleanValue(item.image || item.src || item.url);
      const title = cleanValue(item.title || item.label || item.name) || "عرض ترويجي";
      const subtitle = cleanValue(item.subtitle || item.description);
      const href = cleanValue(item.href || item.link) || "#";

      if (!image) {
        return null;
      }

      return {
        image,
        title,
        subtitle,
        href,
      };
    })
    .filter(Boolean);

  return items.length > 0
    ? items
    : fallback.map((item) => ({ ...item, href: cleanValue(item.href) || "#" }));
}

/**
 * Normalizes feature or info card arrays.
 *
 * @param {unknown} value
 * @param {Array<{ icon: string, title: string, subtitle?: string }>} fallback
 * @returns {Array<{ icon: string, title: string, subtitle?: string }>}
 */
export function normalizeInfoList(value, fallback) {
  if (!Array.isArray(value)) {
    return fallback.map((item) => ({ ...item }));
  }

  const items = value
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const title = cleanValue(item.title);
      const subtitle = cleanValue(item.subtitle);
      const icon = cleanValue(item.icon) || 'sparkles';

      if (!title) {
        return null;
      }

      return { icon, title, subtitle };
    })
    .filter(Boolean);

  return items.length > 0 ? items : fallback.map((item) => ({ ...item }));
}

/**
 * Normalizes dashboard statistic cards.
 *
 * @param {unknown} value
 * @param {Array<Record<string, unknown>>} fallback
 * @returns {Array<Record<string, unknown>>}
 */
export function normalizeStats(value, fallback) {
  if (!Array.isArray(value)) {
    return fallback.map((item) => ({ ...item }));
  }

  const items = value
    .map((item, index) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const fallbackItem = fallback[index] || fallback[0];
      const label = cleanValue(item.label);

      if (!label) {
        return null;
      }

      return {
        value: cleanNumber(item.value, fallbackItem?.value || 0),
        suffix: cleanValue(item.suffix),
        label,
        hint: cleanValue(item.hint),
        icon: cleanValue(item.icon) || fallbackItem?.icon || 'sparkles',
        accent: cleanValue(item.accent) || fallbackItem?.accent || '#22c55e',
        glow: cleanValue(item.glow) || fallbackItem?.glow || 'rgba(34,197,94,0.24)',
      };
    })
    .filter(Boolean);

  return items.length > 0 ? items : fallback.map((item) => ({ ...item }));
}

/**
 * Normalizes generic value/label option arrays.
 *
 * @param {unknown} value
 * @param {Array<{ value: string, label: string }>} fallback
 * @returns {Array<{ value: string, label: string }>}
 */
export function normalizeOptionList(value, fallback) {
  if (!Array.isArray(value)) {
    return fallback.map((item) => ({ ...item }));
  }

  const items = value
    .map((item) => {
      if (typeof item === 'string') {
        const label = cleanValue(item);
        return label ? { value: label, label } : null;
      }

      if (!item || typeof item !== 'object') {
        return null;
      }

      const itemValue = cleanValue(item.value || item.id || item.key || item.name);
      const label = cleanValue(item.label || item.name || item.title);

      if (!itemValue || !label) {
        return null;
      }

      return { value: itemValue, label };
    })
    .filter(Boolean);

  return items.length > 0 ? items : fallback.map((item) => ({ ...item }));
}

/**
 * Converts the legacy payments object into the new payment methods array format.
 *
 * @param {Record<string, boolean> | unknown} payments
 * @returns {Array<{ value: string, label: string }>}
 */
export function derivePaymentMethodsFromLegacy(payments) {
  if (!payments || typeof payments !== 'object') {
    return [];
  }

  return Object.entries(PAYMENT_LABELS)
    .filter(([key]) => payments[key] === true)
    .map(([value, label]) => ({ value, label }));
}

/**
 * Normalizes the custom build section payload.
 *
 * @param {unknown} value
 * @param {typeof DEFAULT_CUSTOM_BUILD} fallback
 * @returns {typeof DEFAULT_CUSTOM_BUILD}
 */
export function normalizeCustomBuild(value, fallback) {
  const source = value && typeof value === 'object' ? value : {};

  return {
    badge: cleanValue(source.badge) || fallback.badge,
    title: cleanValue(source.title) || fallback.title,
    titleHighlight: cleanValue(source.titleHighlight) || fallback.titleHighlight,
    description: cleanValue(source.description) || fallback.description,
    features: normalizeTextArray(source.features, fallback.features),
    ctaLabel: cleanValue(source.ctaLabel) || fallback.ctaLabel,
    ctaHref: cleanValue(source.ctaHref) || fallback.ctaHref,
  };
}

/**
 * Builds the default per-channel descriptions object.
 *
 * @returns {Record<string, string>}
 */
export function createDefaultSocialDescriptions() {
  return Object.fromEntries(SOCIAL_CHANNELS.map((channel) => [channel.key, channel.description]));
}
