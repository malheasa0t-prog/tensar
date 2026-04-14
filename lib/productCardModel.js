export const PRODUCT_CARD_DEFAULT_RATING = 4.8;
export const PRODUCT_CARD_DEFAULT_REVIEW_COUNT = 128;
export const PRODUCT_CARD_LOW_STOCK_THRESHOLD = 6;
export const PRODUCT_CARD_TOTAL_STARS = 5;

/**
 * Reads the first usable numeric candidate.
 *
 * @param {...unknown} candidates
 * @returns {number}
 */
function readNumber(...candidates) {
  for (const candidate of candidates) {
    const value = Number(candidate);
    if (Number.isFinite(value) && value >= 0) {
      return value;
    }
  }

  return 0;
}

/**
 * Reads the first usable positive integer candidate.
 *
 * @param {...unknown} candidates
 * @returns {number}
 */
function readInteger(...candidates) {
  const value = Math.trunc(readNumber(...candidates));
  return value > 0 ? value : 0;
}

/**
 * Normalizes a text value for UI output.
 *
 * @param {unknown} value
 * @returns {string}
 */
function readText(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Clamps a number between a minimum and maximum.
 *
 * @param {number} value
 * @param {number} minimum
 * @param {number} maximum
 * @returns {number}
 */
function clampNumber(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

/**
 * Resolves the effective pricing state for a product card.
 *
 * @param {Record<string, unknown> | null | undefined} product
 * @returns {{
 *   finalPrice: number,
 *   originalPrice: number,
 *   hasDiscount: boolean,
 *   discountPercentage: number | null,
 * }}
 */
export function resolveProductCardPricing(product) {
  const originalPrice = readNumber(product?.price);
  const discountPrice = readNumber(product?.discountPrice, product?.discount_price);
  const hasDiscount = discountPrice > 0 && originalPrice > discountPrice;
  const finalPrice = hasDiscount ? discountPrice : originalPrice;
  const discountPercentage = hasDiscount
    ? Math.round(((originalPrice - discountPrice) / originalPrice) * 100)
    : null;

  return {
    finalPrice,
    originalPrice,
    hasDiscount,
    discountPercentage,
  };
}

/**
 * Resolves the rating summary displayed inside the product card.
 *
 * @param {Record<string, unknown> | null | undefined} product
 * @returns {{
 *   ratingValue: number,
 *   reviewCount: number,
 *   filledStars: number,
 * }}
 */
export function resolveProductCardRating(product) {
  const rawRating = readNumber(product?.rating, product?.rating_value, product?.stars);
  const ratingValue = clampNumber(
    rawRating > 0 ? rawRating : PRODUCT_CARD_DEFAULT_RATING,
    0,
    PRODUCT_CARD_TOTAL_STARS
  );
  const reviewCount =
    readInteger(product?.reviewCount, product?.review_count, product?.reviews, product?.sold) ||
    PRODUCT_CARD_DEFAULT_REVIEW_COUNT;
  const filledStars = clampNumber(Math.round(ratingValue), 1, PRODUCT_CARD_TOTAL_STARS);

  return {
    ratingValue,
    reviewCount,
    filledStars,
  };
}

/**
 * Resolves whether the card should show a low-stock urgency label.
 *
 * @param {Record<string, unknown> | null | undefined} product
 * @returns {{
 *   availableQuantity: number,
 *   urgencyLabel: string | null,
 * }}
 */
export function resolveProductCardUrgency(product) {
  const availableQuantity = readInteger(
    product?.quantity,
    product?.stock_quantity,
    product?.stockQuantity,
    product?.stock,
    product?.inventory
  );

  if (!availableQuantity || availableQuantity > PRODUCT_CARD_LOW_STOCK_THRESHOLD) {
    return {
      availableQuantity,
      urgencyLabel: null,
    };
  }

  return {
    availableQuantity,
    urgencyLabel: `متبقي ${availableQuantity} ${availableQuantity === 1 ? "قطعة" : "قطع"} فقط`,
  };
}

/**
 * Builds the complete visual snapshot needed by the product card UI.
 *
 * @param {Record<string, unknown> | null | undefined} product
 * @returns {{
 *   description: string,
 *   previewDescription: string,
 *   previewHighlights: string[],
 *   finalPrice: number,
 *   originalPrice: number,
 *   hasDiscount: boolean,
 *   discountPercentage: number | null,
 *   ratingValue: number,
 *   reviewCount: number,
 *   filledStars: number,
 *   availableQuantity: number,
 *   urgencyLabel: string | null,
 * }}
 */
export function buildProductCardSnapshot(product) {
  const pricing = resolveProductCardPricing(product);
  const rating = resolveProductCardRating(product);
  const urgency = resolveProductCardUrgency(product);
  const description = readText(product?.description);
  const previewHighlights = [readText(product?.badge), readText(product?.category), urgency.urgencyLabel]
    .filter(Boolean)
    .slice(0, 3);

  return {
    description,
    previewDescription: description || "شاهد السعر والتوفر بسرعة قبل فتح صفحة المنتج الكاملة.",
    previewHighlights,
    ...pricing,
    ...rating,
    ...urgency,
  };
}
