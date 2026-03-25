import {
  DEFAULT_COMPANY,
  DEFAULT_CUSTOM_BUILD,
  DEFAULT_DELIVERY_METHODS,
  DEFAULT_HERO,
  DEFAULT_MARQUEE_ITEMS,
  DEFAULT_NAVIGATION,
  DEFAULT_PAYMENT_METHODS,
  DEFAULT_SERVICE_FEATURES,
  DEFAULT_SERVICE_TYPES,
  DEFAULT_STATS,
  DEFAULT_TRUST_BAR,
} from '@/lib/contactChannels/defaults';
import {
  cleanValue,
  createDefaultSocialDescriptions,
  createEmptySocialState,
  derivePaymentMethodsFromLegacy,
  normalizeCustomBuild,
  normalizeInfoList,
  normalizeLinkList,
  normalizeOptionList,
  normalizeStats,
} from '@/lib/contactChannels/helpers';

/**
 * Builds a compact brand mark from the company name.
 *
 * @param {string} [name]
 * @returns {string}
 */
export function getBrandMark(name = '') {
  const trimmed = cleanValue(name);

  if (!trimmed) {
    return 'TZ';
  }

  const capitals = trimmed.match(/[A-Z]/g);
  if (capitals && capitals.length >= 2) {
    return capitals.slice(0, 2).join('');
  }

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return words
      .slice(0, 2)
      .map((word) => word.charAt(0))
      .join('')
      .toUpperCase();
  }

  return trimmed.slice(0, 2).toUpperCase();
}

/**
 * Normalizes the site settings payload from Supabase into a complete shape with defaults.
 *
 * @param {Record<string, unknown>} [data]
 * @returns {Record<string, unknown>}
 */
export function normalizeSiteSettings(data = {}) {
  const source = data && typeof data === 'object' ? data : {};
  const companySource = source.company && typeof source.company === 'object' ? source.company : {};
  const socialSource = source.social && typeof source.social === 'object' ? source.social : {};
  const homepageSource = source.homepage && typeof source.homepage === 'object' ? source.homepage : {};
  const marqueeSource =
    homepageSource.marquee && typeof homepageSource.marquee === 'object'
      ? homepageSource.marquee
      : {};
  const navigationSource =
    source.navigation && typeof source.navigation === 'object' ? source.navigation : {};
  const socialDescriptionsSource =
    source.socialDescriptions && typeof source.socialDescriptions === 'object'
      ? source.socialDescriptions
      : {};

  const marqueeItems = Array.isArray(marqueeSource.items)
    ? marqueeSource.items.map((item) => cleanValue(item)).filter(Boolean)
    : [];

  const paymentMethods =
    normalizeOptionList(source.paymentMethods, []).length > 0
      ? normalizeOptionList(source.paymentMethods, [])
      : normalizeOptionList(
          derivePaymentMethodsFromLegacy(source.payments),
          DEFAULT_PAYMENT_METHODS
        );

  const deliveryMethods =
    normalizeOptionList(source.deliveryMethods, []).length > 0
      ? normalizeOptionList(source.deliveryMethods, [])
      : normalizeOptionList(source.deliveryModes, DEFAULT_DELIVERY_METHODS);

  return {
    company: {
      name: cleanValue(companySource.name) || DEFAULT_COMPANY.name,
      slogan: cleanValue(companySource.slogan) || DEFAULT_COMPANY.slogan,
      phone: cleanValue(companySource.phone) || DEFAULT_COMPANY.phone,
      email: cleanValue(companySource.email) || DEFAULT_COMPANY.email,
      address: cleanValue(companySource.address) || DEFAULT_COMPANY.address,
    },
    social: {
      ...createEmptySocialState(),
      ...Object.fromEntries(
        Object.entries(socialSource).map(([key, value]) => [key, cleanValue(value)])
      ),
    },
    socialDescriptions: {
      ...createDefaultSocialDescriptions(),
      ...Object.fromEntries(
        Object.entries(socialDescriptionsSource).map(([key, value]) => [key, cleanValue(value)])
      ),
    },
    homepage: {
      marquee: {
        enabled: marqueeSource.enabled !== false,
        items: marqueeItems.length > 0 ? marqueeItems : DEFAULT_MARQUEE_ITEMS,
      },
    },
    hero: {
      trustBadge: cleanValue(source.hero?.trustBadge) || DEFAULT_HERO.trustBadge,
      title: cleanValue(source.hero?.title) || DEFAULT_HERO.title,
      titleHighlight: cleanValue(source.hero?.titleHighlight) || DEFAULT_HERO.titleHighlight,
      description: cleanValue(source.hero?.description) || DEFAULT_HERO.description,
    },
    trustBar: normalizeInfoList(source.trustBar, DEFAULT_TRUST_BAR),
    stats: normalizeStats(source.stats, DEFAULT_STATS),
    customBuild: normalizeCustomBuild(source.customBuild, DEFAULT_CUSTOM_BUILD),
    serviceFeatures: normalizeInfoList(source.serviceFeatures, DEFAULT_SERVICE_FEATURES),
    paymentMethods,
    deliveryMethods,
    serviceTypes: normalizeOptionList(source.serviceTypes, DEFAULT_SERVICE_TYPES),
    navigation: {
      headerBefore: normalizeLinkList(navigationSource.headerBefore, DEFAULT_NAVIGATION.headerBefore),
      headerAfter: normalizeLinkList(navigationSource.headerAfter, DEFAULT_NAVIGATION.headerAfter),
      footerQuick: normalizeLinkList(navigationSource.footerQuick, DEFAULT_NAVIGATION.footerQuick),
      footerSupport: normalizeLinkList(
        navigationSource.footerSupport,
        DEFAULT_NAVIGATION.footerSupport
      ),
      footerBar: normalizeLinkList(navigationSource.footerBar, DEFAULT_NAVIGATION.footerBar),
      mobilePrimary: normalizeLinkList(
        navigationSource.mobilePrimary,
        DEFAULT_NAVIGATION.mobilePrimary
      ),
    },
    categoryNavVisibility:
      source.categoryNavVisibility && typeof source.categoryNavVisibility === 'object'
        ? { ...source.categoryNavVisibility }
        : {},
  };
}
