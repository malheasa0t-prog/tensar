/**
 * Shared SEO helpers for canonical URLs, Open Graph media, and JSON-LD payloads.
 */

const DEFAULT_SITE_ORIGIN = "http://localhost:5173";
const DEFAULT_OG_IMAGE_PATH = "/opengraph-image.svg";
const DEFAULT_CURRENCY_CODE = "JOD";
const DEFAULT_PRODUCT_DESCRIPTION = "تفاصيل المنتج والسعر والتوفر لدى TechZone.";
const DEFAULT_SERVICE_DESCRIPTION = "تفاصيل الخدمة والسعر وطريقة الحجز لدى TechZone.";
const DEFAULT_ORGANIZATION_DESCRIPTION =
  "بيع وصيانة أجهزة الكمبيوتر والإكسسوارات والخدمات التقنية ضمن تجربة شراء واضحة.";

/**
 * Normalizes plain text values by trimming and collapsing whitespace.
 *
 * @param {unknown} value
 * @returns {string}
 */
function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

/**
 * Removes empty values from an object.
 *
 * @param {Record<string, unknown>} value
 * @returns {Record<string, unknown>}
 */
function compactObject(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => {
      if (entry === undefined || entry === null || entry === "") return false;
      if (Array.isArray(entry)) return entry.length > 0;
      return true;
    })
  );
}

/**
 * Formats numeric prices for metadata payloads.
 *
 * @param {unknown} value
 * @returns {string | null}
 */
function formatPrice(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue.toFixed(2) : null;
}

/**
 * Converts a single value or an array into a flat image list.
 *
 * @param {unknown} images
 * @returns {string[]}
 */
function normalizeImageList(images) {
  if (Array.isArray(images)) {
    return images.map((image) => cleanText(image)).filter(Boolean);
  }

  const singleImage = cleanText(images);
  return singleImage ? [singleImage] : [];
}

/**
 * Normalizes a site origin string into a full URL.
 *
 * @param {string} [rawOrigin]
 * @returns {string}
 */
export function normalizeSiteOrigin(rawOrigin = "") {
  const candidate = cleanText(rawOrigin).replace(/\/+$/, "");

  if (!candidate) {
    return DEFAULT_SITE_ORIGIN;
  }

  if (/^https?:\/\//i.test(candidate)) {
    return candidate;
  }

  return `https://${candidate}`;
}

/**
 * Resolves the public site origin from runtime or environment values.
 *
 * @returns {string}
 */
export function getSiteOrigin() {
  const browserOrigin =
    typeof window !== "undefined" ? cleanText(window.location?.origin) : "";
  const env =
    typeof process !== "undefined" && process?.env ? process.env : {};
  const candidates = [
    browserOrigin,
    env.NEXT_PUBLIC_SITE_URL,
    env.SITE_URL,
    env.VERCEL_PROJECT_PRODUCTION_URL,
    env.VERCEL_URL,
  ];
  const definedOrigin = candidates.find((candidate) => cleanText(candidate));
  return normalizeSiteOrigin(definedOrigin);
}

/**
 * Builds an absolute URL for internal paths and keeps external URLs unchanged.
 *
 * @param {string} [pathname]
 * @returns {string}
 */
export function buildAbsoluteUrl(pathname = "/") {
  const candidate = cleanText(pathname);

  if (!candidate) {
    return getSiteOrigin();
  }

  if (/^https?:\/\//i.test(candidate)) {
    return candidate;
  }

  const normalizedPath = candidate.startsWith("/") ? candidate : `/${candidate}`;
  return new URL(normalizedPath, `${getSiteOrigin()}/`).toString();
}

/**
 * Determines whether an image URL can be used in metadata and search previews.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isShareableImageUrl(value) {
  const candidate = cleanText(value);
  return Boolean(candidate) && (candidate.startsWith("/") || /^https?:\/\//i.test(candidate));
}

/**
 * Resolves Open Graph image URLs with a guaranteed fallback image.
 *
 * @param {unknown} images
 * @returns {string[]}
 */
export function resolveMetadataImageUrls(images = []) {
  const uniqueImages = new Set();
  const resolvedImages = [];

  [...normalizeImageList(images), DEFAULT_OG_IMAGE_PATH].forEach((image) => {
    if (!isShareableImageUrl(image)) {
      return;
    }

    const absoluteUrl = buildAbsoluteUrl(image);

    if (uniqueImages.has(absoluteUrl)) {
      return;
    }

    uniqueImages.add(absoluteUrl);
    resolvedImages.push(absoluteUrl);
  });

  return resolvedImages;
}

/**
 * Builds Organization JSON-LD for the store identity.
 *
 * @param {{
 *   siteSettings?: Record<string, unknown>,
 *   sameAs?: string[],
 *   logo?: string,
 * }} input
 * @returns {Record<string, unknown>}
 */
export function buildOrganizationStructuredData({
  siteSettings = {},
  sameAs = [],
  logo = DEFAULT_OG_IMAGE_PATH,
} = {}) {
  const company =
    siteSettings?.company && typeof siteSettings.company === "object"
      ? siteSettings.company
      : {};
  const validSameAs = Array.isArray(sameAs)
    ? sameAs.map((url) => cleanText(url)).filter((url) => /^https?:\/\//i.test(url))
    : [];
  const description =
    cleanText(siteSettings?.hero?.description) ||
    cleanText(company?.slogan) ||
    DEFAULT_ORGANIZATION_DESCRIPTION;

  return compactObject({
    "@context": "https://schema.org",
    "@type": "Organization",
    name: cleanText(company?.name) || "TechZone",
    url: buildAbsoluteUrl("/"),
    logo: resolveMetadataImageUrls(logo)[0],
    description,
    email: cleanText(company?.email),
    telephone: cleanText(company?.phone),
    sameAs: validSameAs,
    address: cleanText(company?.address)
      ? {
          "@type": "PostalAddress",
          streetAddress: cleanText(company.address),
        }
      : undefined,
  });
}

/**
 * Builds Product JSON-LD for product detail pages.
 *
 * @param {{ product: Record<string, unknown>, pathname: string, categoryName?: string }} input
 * @returns {Record<string, unknown>}
 * @throws {TypeError}
 */
export function buildProductStructuredData({ product, pathname, categoryName = "" }) {
  const productId = cleanText(product?.id);
  const productName = cleanText(product?.name);

  if (!productId || !productName) {
    throw new TypeError("Product structured data requires an id and a name.");
  }

  const price = formatPrice(product?.discount_price || product?.price);
  const imageUrls = resolveMetadataImageUrls(product?.images);
  const availability =
    Number(product?.quantity || 0) > 0
      ? "https://schema.org/InStock"
      : "https://schema.org/OutOfStock";

  return compactObject({
    "@context": "https://schema.org",
    "@type": "Product",
    name: productName,
    sku: productId,
    description: cleanText(product?.description) || DEFAULT_PRODUCT_DESCRIPTION,
    category: cleanText(categoryName),
    image: imageUrls,
    brand: cleanText(product?.brand)
      ? {
          "@type": "Brand",
          name: cleanText(product.brand),
        }
      : undefined,
    offers: compactObject({
      "@type": "Offer",
      url: buildAbsoluteUrl(pathname),
      price,
      priceCurrency: price ? DEFAULT_CURRENCY_CODE : undefined,
      availability,
      itemCondition: "https://schema.org/NewCondition",
    }),
  });
}

/**
 * Builds Service JSON-LD for service detail pages.
 *
 * @param {{ service: Record<string, unknown>, pathname: string, providerName?: string }} input
 * @returns {Record<string, unknown>}
 * @throws {TypeError}
 */
export function buildServiceStructuredData({ service, pathname, providerName = "TechZone" }) {
  const serviceName = cleanText(service?.name);

  if (!serviceName) {
    throw new TypeError("Service structured data requires a service name.");
  }

  const price = formatPrice(service?.price);
  const imageUrls = resolveMetadataImageUrls(service?.image);

  return compactObject({
    "@context": "https://schema.org",
    "@type": "Service",
    name: serviceName,
    description: cleanText(service?.description) || DEFAULT_SERVICE_DESCRIPTION,
    serviceType: cleanText(service?.category) || "خدمات الصيانة",
    image: imageUrls,
    provider: {
      "@type": "Organization",
      name: cleanText(providerName) || "TechZone",
      url: buildAbsoluteUrl("/"),
    },
    offers: compactObject({
      "@type": "Offer",
      url: buildAbsoluteUrl(pathname),
      price,
      priceCurrency: price ? DEFAULT_CURRENCY_CODE : undefined,
      availability: "https://schema.org/InStock",
    }),
  });
}
