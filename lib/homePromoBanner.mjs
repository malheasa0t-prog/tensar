const MIN_BANNER_TITLE_LENGTH = 4;
const MIN_BANNER_SUBTITLE_LENGTH = 8;
const DEFAULT_BANNER_LINK = "/";
const MINIMUM_SLIDE_COUNT = 1;

export const DEFAULT_BANNER_ROTATION_INTERVAL_MS = 2000;

/**
 * Checks whether the supplied banner index is valid.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

/**
 * Returns a normalized banner link.
 *
 * @param {unknown} href
 * @returns {string}
 */
function normalizeBannerLink(href) {
  const value = String(href || "").trim();
  return value || DEFAULT_BANNER_LINK;
}

/**
 * Converts raw banner data into a safe presentation model.
 *
 * @param {unknown} banners
 * @returns {Array<{ id: string, image: string, title: string, subtitle: string, href: string }>}
 */
export function sanitizePromoBannerItems(banners) {
  if (!Array.isArray(banners)) {
    return [];
  }

  return banners
    .filter((banner) => banner && typeof banner === "object")
    .map((banner, index) => ({
      id: String(banner.id || `banner-${index}`),
      image: String(banner.image || "").trim(),
      title: String(banner.title || banner.label || "").trim(),
      subtitle: String(banner.subtitle || banner.description || "").trim(),
      href: normalizeBannerLink(banner.href || banner.link),
    }))
    .filter((banner) => banner.image)
    .filter((banner) => banner.title.length >= MIN_BANNER_TITLE_LENGTH)
    .filter((banner) => banner.subtitle.length >= MIN_BANNER_SUBTITLE_LENGTH);
}

/**
 * Chooses the banner list that should be rendered on the homepage.
 *
 * @param {unknown} banners
 * @param {unknown} fallbackBanners
 * @returns {Array<{ id: string, image: string, title: string, subtitle: string, href: string }>}
 */
export function buildPromoBannerSlides(banners, fallbackBanners) {
  const normalizedBanners = sanitizePromoBannerItems(banners);
  if (normalizedBanners.length > 0) {
    return normalizedBanners;
  }

  return sanitizePromoBannerItems(fallbackBanners);
}

/**
 * Returns the closest circular offset between two banner indices.
 *
 * @param {number} index
 * @param {number} currentIndex
 * @param {number} totalSlides
 * @returns {number}
 * @throws {TypeError}
 * @throws {RangeError}
 */
export function getCircularBannerOffset(index, currentIndex, totalSlides) {
  if (!isNonNegativeInteger(index)) {
    throw new TypeError("Banner index must be a non-negative integer.");
  }

  if (!isNonNegativeInteger(currentIndex)) {
    throw new TypeError("Current banner index must be a non-negative integer.");
  }

  if (!Number.isInteger(totalSlides)) {
    throw new TypeError("Total slides must be an integer.");
  }

  if (totalSlides < MINIMUM_SLIDE_COUNT) {
    throw new RangeError("Total slides must be at least 1.");
  }

  if (index >= totalSlides || currentIndex >= totalSlides) {
    throw new RangeError("Banner indices must exist within the slide collection.");
  }

  let relativeOffset = index - currentIndex;
  const midpoint = Math.floor(totalSlides / 2);

  if (relativeOffset > midpoint) {
    relativeOffset -= totalSlides;
  }

  if (relativeOffset < -midpoint) {
    relativeOffset += totalSlides;
  }

  return relativeOffset;
}
