export const DIGITAL_SERVICES_CATEGORY_SLUG = "digital-services";

/**
 * Normalizes category-like slugs and product types.
 *
 * @param {unknown} value
 * @returns {string}
 */
function normalizeIdentifier(value) {
  return String(value || "").trim().toLowerCase();
}

/**
 * Resolves category ids that belong to the subscriptions catalog.
 *
 * @param {Array<{ id?: string, slug?: string }> | null | undefined} categories
 * @returns {Set<string>}
 */
export function getSubscriptionsCategoryIds(categories) {
  const categoryIds = new Set();

  for (const category of Array.isArray(categories) ? categories : []) {
    const categoryId = String(category?.id || "").trim();
    if (!categoryId) {
      continue;
    }

    if (normalizeIdentifier(category?.slug) === DIGITAL_SERVICES_CATEGORY_SLUG) {
      categoryIds.add(categoryId);
    }
  }

  return categoryIds;
}

/**
 * Selects subscription products without relying on mutable category names.
 *
 * @param {{
 *   products?: Array<{ category_id?: string, category_slug?: string, product_type?: string }>,
 *   categories?: Array<{ id?: string, slug?: string }>,
 * }} input
 * @returns {Array<object>}
 */
export function selectSubscriptionProducts({ products, categories }) {
  const subscriptionCategoryIds = getSubscriptionsCategoryIds(categories);

  return (Array.isArray(products) ? products : []).filter((product) => {
    const categoryId = String(product?.category_id || product?.categoryId || "").trim();
    const categorySlug = normalizeIdentifier(product?.category_slug || product?.categorySlug);
    const productType = normalizeIdentifier(product?.product_type || product?.productType);

    return (
      productType === "digital" ||
      categorySlug === DIGITAL_SERVICES_CATEGORY_SLUG ||
      (categoryId && subscriptionCategoryIds.has(categoryId))
    );
  });
}
