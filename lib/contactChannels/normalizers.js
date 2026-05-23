import {
  DEFAULT_COMPANY,
  DEFAULT_CUSTOM_BUILD,
  DEFAULT_DELIVERY_METHODS,
  DEFAULT_HERO,
  DEFAULT_MARQUEE_ITEMS,
  DEFAULT_NAVIGATION,
  DEFAULT_PAYMENT_METHODS,
  DEFAULT_PROMO_BANNERS,
  DEFAULT_SERVICE_FEATURES,
  DEFAULT_SERVICE_TYPES,
  DEFAULT_STATS,
  DEFAULT_TRUST_BAR,
} from "./defaults.js";
import {
  cleanValue,
  createDefaultSocialDescriptions,
  createEmptySocialState,
  derivePaymentMethodsFromLegacy,
  normalizeCustomBuild,
  normalizeInfoList,
  normalizeLinkList,
  normalizeOptionList,
  normalizePromoBannerList,
  normalizeStats,
} from "./helpers.js";
import { normalizeSiteContent } from "./content.js";
import { normalizeDepositTransferSettings } from "./depositTransfer.js";
import { normalizeDeliveryMethodList } from "./deliveryMethods.js";

/**
 * Ensures site settings keep the required repair delivery methods available.
 *
 * @param {Array<{ value: string, label: string, fee?: number }>} deliveryMethods
 * @returns {Array<{ value: string, label: string, fee: number }>}
 */
function mergeRequiredDeliveryMethods(deliveryMethods) {
  const requiredMethods = [
    ...DEFAULT_DELIVERY_METHODS,
    { value: 'remote', label: 'صيانة عن بعد', fee: 0 },
  ];
  const mergedMethods = Array.isArray(deliveryMethods)
    ? deliveryMethods.map((method) => ({ ...method }))
    : [];

  requiredMethods.forEach((defaultMethod) => {
    if (!mergedMethods.some((method) => method.value === defaultMethod.value)) {
      mergedMethods.push({ ...defaultMethod });
    }
  });

  return mergedMethods;
}

/**
 * Removes discontinued product storefront links from normalized navigation.
 *
 * @param {Array<{ href?: string }>} links - Normalized navigation links.
 * @returns {Array<{ href?: string }>} Navigation links without product routes.
 */
function removeProductNavigationLinks(links) {
  return links.filter((link) => {
    const href = cleanValue(link?.href).toLowerCase();

    return !href.startsWith('/products') && !href.startsWith('/accessories');
  });
}

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
  const shippingSource = source.shipping && typeof source.shipping === 'object' ? source.shipping : {};
  const socialDescriptionsSource =
    source.socialDescriptions && typeof source.socialDescriptions === 'object'
      ? source.socialDescriptions
      : {};
  const contentSource = source.content && typeof source.content === "object" ? source.content : {};
  const legacyDepositTransferSource =
    source.payments?.bankTransfer && typeof source.payments.bankTransfer === "object"
      ? source.payments.bankTransfer
      : {};
  const depositTransferSource =
    source.depositTransfer && typeof source.depositTransfer === "object"
      ? source.depositTransfer
      : source.bankTransfer && typeof source.bankTransfer === "object"
        ? source.bankTransfer
        : legacyDepositTransferSource;
  const normalizedCompanyName = cleanValue(companySource.name) || DEFAULT_COMPANY.name;

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

  const storedDeliveryMethods = normalizeDeliveryMethodList(source.deliveryMethods, [], shippingSource);
  const deliveryMethods = mergeRequiredDeliveryMethods(
    storedDeliveryMethods.length > 0
      ? storedDeliveryMethods
      : normalizeDeliveryMethodList(source.deliveryModes, DEFAULT_DELIVERY_METHODS, shippingSource)
  );

  return {
    company: {
      name: normalizedCompanyName,
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
      promoBanners: normalizePromoBannerList(
        homepageSource.promoBanners,
        DEFAULT_PROMO_BANNERS
      ),
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
    content: normalizeSiteContent(contentSource),
    paymentMethods,
    depositTransfer: normalizeDepositTransferSettings(
      depositTransferSource,
      normalizedCompanyName
    ),
    walletTransferNumber:
      cleanValue(source.walletTransferNumber) || cleanValue(source.payments?.walletTransferNumber),
    deliveryMethods,
    serviceTypes: normalizeOptionList(source.serviceTypes, DEFAULT_SERVICE_TYPES),
    navigation: {
      headerBefore: removeProductNavigationLinks(
        normalizeLinkList(navigationSource.headerBefore, DEFAULT_NAVIGATION.headerBefore)
      ),
      headerAfter: removeProductNavigationLinks(
        normalizeLinkList(navigationSource.headerAfter, DEFAULT_NAVIGATION.headerAfter)
      ),
      footerQuick: removeProductNavigationLinks(
        normalizeLinkList(navigationSource.footerQuick, DEFAULT_NAVIGATION.footerQuick)
      ),
      footerSupport: removeProductNavigationLinks(
        normalizeLinkList(navigationSource.footerSupport, DEFAULT_NAVIGATION.footerSupport)
      ),
      footerBar: removeProductNavigationLinks(
        normalizeLinkList(navigationSource.footerBar, DEFAULT_NAVIGATION.footerBar)
      ),
      mobilePrimary: removeProductNavigationLinks(
        normalizeLinkList(navigationSource.mobilePrimary, DEFAULT_NAVIGATION.mobilePrimary)
      ),
    },
    categoryNavVisibility:
      source.categoryNavVisibility && typeof source.categoryNavVisibility === 'object'
        ? { ...source.categoryNavVisibility }
        : {},
    raw: source,
  };
}
