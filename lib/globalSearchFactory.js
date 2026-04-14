/**
 * Factory helpers for building unified global search items.
 */

export const DEFAULT_PRODUCT_CATEGORY = "منتجات عامة";
export const DEFAULT_SERVICE_CATEGORY = "خدمات الصيانة";

const SEARCH_TYPE_LABELS = {
  product: "منتج",
  service: "خدمة",
  category: "فئة",
};

/**
 * Normalizes search text for Arabic and English matching.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeSearchText(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/[ؤئ]/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[\u064B-\u065F]/g, "")
    .replace(/\s+/g, " ");
}

/**
 * Builds one normalized search string from multiple fragments.
 *
 * @param {unknown[]} fragments
 * @returns {string}
 */
function buildSearchText(fragments) {
  return fragments.map((fragment) => normalizeSearchText(fragment)).filter(Boolean).join(" ");
}

/**
 * Reads the first valid positive price candidate.
 *
 * @param {unknown[]} candidates
 * @returns {number}
 */
function readPositiveNumber(candidates) {
  for (const candidate of candidates) {
    const value = Number(candidate);
    if (Number.isFinite(value) && value > 0) {
      return value;
    }
  }

  return 0;
}

/**
 * Converts a category label into a stable filter key.
 *
 * @param {unknown} label
 * @returns {string}
 */
function toCategoryKey(label) {
  return normalizeSearchText(label).replace(/\s+/g, "-");
}

/**
 * Creates the public path segment used by service detail pages.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function slugifySearchPathSegment(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\u0600-\u06FFa-z0-9-_]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Returns the visual label used for each global search item type.
 *
 * @param {string} type
 * @returns {string}
 */
export function getGlobalSearchTypeLabel(type) {
  return SEARCH_TYPE_LABELS[normalizeSearchText(type)] || "عنصر";
}

/**
 * Maps one product row into a global search item.
 *
 * @param {{ product: Record<string, unknown>, categoryName?: string }} input
 * @returns {Record<string, unknown>}
 */
export function createGlobalSearchProductItem({ product, categoryName = DEFAULT_PRODUCT_CATEGORY }) {
  const title = String(product?.name || "منتج تقني").trim();
  const price = readPositiveNumber([product?.discount_price, product?.price]);

  return {
    id: `product:${product?.id || title}`,
    type: "product",
    title,
    href: `/products/${product?.id}`,
    description: String(product?.description || "").trim(),
    subtitle: categoryName,
    categoryLabel: categoryName,
    categoryKey: toCategoryKey(categoryName),
    iconName: product?.icon || categoryName || "package",
    metaLabel: price > 0 ? `${price.toFixed(2)} د.أ` : "اطلب السعر",
    priorityScore: Number(product?.sold || product?.review_count || product?.reviews_count || 0),
    searchText: buildSearchText([
      title,
      product?.description,
      product?.brand,
      categoryName,
      product?.product_type,
    ]),
  };
}

/**
 * Maps one repair service row into a global search item.
 *
 * @param {Record<string, unknown>} service
 * @returns {Record<string, unknown>}
 */
export function createGlobalSearchServiceItem(service) {
  const categoryLabel = String(service?.category || DEFAULT_SERVICE_CATEGORY).trim();
  const title = String(service?.name || "خدمة صيانة").trim();
  const price = readPositiveNumber([service?.price]);

  return {
    id: `service:${service?.id || title}`,
    type: "service",
    title,
    href: `/services/${service?.id || slugifySearchPathSegment(title)}`,
    description: String(service?.description || "").trim(),
    subtitle: categoryLabel,
    categoryLabel,
    categoryKey: toCategoryKey(categoryLabel),
    iconName: service?.icon || "wrench",
    metaLabel: price > 0 ? `يبدأ من ${price.toFixed(2)} د.أ` : "احجز الآن",
    priorityScore: 24,
    searchText: buildSearchText([title, service?.description, categoryLabel, service?.duration]),
  };
}

/**
 * Maps one category row into a global search item.
 *
 * @param {Record<string, unknown>} category
 * @returns {Record<string, unknown>}
 */
export function createGlobalSearchCategoryItem(category) {
  const title = String(category?.name || "فئة").trim();
  const subtitle = category?.parent_id ? "فئة فرعية" : "فئة رئيسية";

  return {
    id: `category:${category?.id || title}`,
    type: "category",
    title,
    href: `/category/${category?.slug || category?.id}`,
    description: "",
    subtitle,
    categoryLabel: title,
    categoryKey: toCategoryKey(title),
    iconName: "folder-open",
    metaLabel: subtitle,
    priorityScore: category?.parent_id ? 18 : 28,
    searchText: buildSearchText([title, subtitle]),
  };
}
