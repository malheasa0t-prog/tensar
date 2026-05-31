/**
 * Shared helpers for category rows that should behave like buyable catalog items.
 */

const CATEGORY_PRICE_PATTERNS = Object.freeze([
  /(\d+(?:[.,]\d+)?)\s*(?:\$|د\.?أ|دينار(?:\s*أردني)?|دولار(?:\s*أمريكي)?|jod|usd|eur|gbp|£|€)\b/iu,
  /(?:\$|د\.?أ|دينار(?:\s*أردني)?|دولار(?:\s*أمريكي)?|jod|usd|eur|gbp|£|€)\s*(\d+(?:[.,]\d+)?)/iu,
]);

/**
 * Returns a normalized text value.
 *
 * @param {unknown} value - Raw text value.
 * @returns {string} Trimmed text.
 */
function normalizeText(value) {
  return String(value ?? '').trim();
}

/**
 * Parses a numeric price candidate.
 *
 * @param {unknown} value - Raw price value.
 * @returns {number | null} Finite non-negative price or null.
 */
function parsePriceCandidate(value) {
  const normalizedValue = normalizeText(value);
  if (!normalizedValue) {
    return null;
  }

  const parsed = Number(normalizedValue.replace(/,/g, '.'));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

/**
 * Returns the leaf-category price, preferring explicit metadata and falling back
 * to the category name or description when it contains a visible currency value.
 *
 * @param {Record<string, unknown> | null | undefined} category - Category row.
 * @returns {number | null} Parsed price or null when the row is not buyable.
 */
export function extractCategoryPurchasePrice(category) {
  const metadata = category && typeof category.metadata === 'object' && category.metadata
    ? category.metadata
    : {};
  const metadataPrice = parsePriceCandidate(metadata.price);
  if (metadataPrice !== null) {
    return metadataPrice;
  }

  for (const candidate of [category?.name, category?.description]) {
    const text = normalizeText(candidate);
    if (!text) continue;

    const dollarMatch = text.match(/(\d+(?:[.,]\d+)?)\s*\$/u);
    if (dollarMatch) {
      const parsed = parsePriceCandidate(dollarMatch[1]);
      if (parsed !== null) {
        return parsed;
      }
    }

    for (const pattern of CATEGORY_PRICE_PATTERNS) {
      const match = text.match(pattern);
      if (!match) continue;

      const parsed = parsePriceCandidate(match[1]);
      if (parsed !== null) {
        return parsed;
      }
    }
  }

  return null;
}

/**
 * Builds a direct-child count map for category rows.
 *
 * @param {Array<Record<string, unknown>>} categories - Active categories.
 * @returns {Record<string, number>} Parent id -> direct child count.
 */
export function buildCategoryChildCountMap(categories) {
  const counts = {};

  for (const category of Array.isArray(categories) ? categories : []) {
    const parentId = normalizeText(category?.parent_id);
    if (!parentId) continue;

    counts[parentId] = Number(counts[parentId] || 0) + 1;
  }

  return counts;
}

/**
 * Checks whether one category row can become a buyable digital item.
 *
 * @param {{ category?: Record<string, unknown> | null, childCountById?: Record<string, number> }} input - Category and child lookup.
 * @returns {boolean} True when the category is an active leaf with a visible price.
 */
export function isCategoryPurchaseable({ category, childCountById = {} }) {
  if (!category || typeof category !== 'object') {
    return false;
  }

  if (normalizeText(category.status).toLowerCase() !== 'active') {
    return false;
  }

  const categoryId = normalizeText(category.id);
  if (!categoryId || Number(childCountById[categoryId] || 0) > 0) {
    return false;
  }

  return extractCategoryPurchasePrice(category) !== null;
}

/**
 * Builds a service-like snapshot for a buyable leaf category.
 *
 * @param {{
 *   category?: Record<string, unknown> | null,
 *   categoryLabel?: unknown,
 *   categorySlug?: unknown,
 *   childCountById?: Record<string, number>,
 * }} input - Category and display context.
 * @returns {Record<string, unknown> | null} Service-shaped catalog row.
 */
export function buildCategoryPurchaseService({
  category,
  categoryLabel = '',
  categorySlug = '',
  childCountById = {},
}) {
  if (!isCategoryPurchaseable({ category, childCountById })) {
    return null;
  }

  const price = extractCategoryPurchasePrice(category);
  const metadata = category && typeof category.metadata === 'object' && category.metadata
    ? category.metadata
    : {};
  const image = normalizeText(category.image);
  const resolvedLabel = normalizeText(categoryLabel) || normalizeText(category.name);
  const resolvedSlug = normalizeText(categorySlug) || normalizeText(category.slug) || normalizeText(category.id);
  const maxQty = parsePriceCandidate(metadata.max_qty);
  const priceSource = parsePriceCandidate(metadata.price) !== null ? 'metadata' : 'name';

  return {
    id: normalizeText(category.id),
    name: normalizeText(category.name),
    slug: normalizeText(category.slug),
    category: resolvedLabel,
    category_id: normalizeText(category.parent_id) || null,
    subcategory_id: normalizeText(category.id),
    provider_service_id: null,
    price,
    cost_price: price,
    min_qty: 1,
    max_qty: maxQty !== null && maxQty > 0 ? maxQty : 9999,
    description: normalizeText(category.description),
    image,
    icon: normalizeText(category.icon) || 'gift',
    status: 'active',
    sort_order: Number(category.sort_order || 0),
    metadata: {
      ...metadata,
      link_required: Boolean(metadata.link_required),
      provider_fields: Array.isArray(metadata.provider_fields) ? metadata.provider_fields : [],
      source_category_id: normalizeText(category.id),
      source_type: 'category-leaf',
      price_source: priceSource,
    },
    product_type: 'digital',
    sourceType: 'catalog-service',
    catalog_source: 'category',
    categoryLabel: resolvedLabel,
    categorySlug: resolvedSlug,
    images: image ? [image] : [],
    quantity: maxQty !== null && maxQty > 0 ? maxQty : 9999,
    brand: null,
    rating: 0,
    sold: 0,
    discount_price: null,
  };
}
