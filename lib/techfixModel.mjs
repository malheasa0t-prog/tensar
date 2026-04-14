const ACCESSORY_SUBCATEGORY_ID = "cat-accessories-direct-items";

function isAccessoryItem(product) {
  return (
    product?.product_type === "accessory" ||
    !product?.category_id ||
    product?.category_id === ACCESSORY_SUBCATEGORY_ID
  );
}

/**
 * Returns the main catalog categories sorted for homepage usage.
 *
 * @param {Array<{ id?: string, name?: string, parent_id?: string | null, sort_order?: number }>} categories
 * @param {number} [limit=4]
 * @returns {Array<object>}
 */
export function selectHomepageCategories(categories, limit = 4) {
  if (!Array.isArray(categories) || limit <= 0) {
    return [];
  }

  const categoryIds = new Set(categories.map((category) => category.id));
  const mainCategories = categories
    .filter((category) => !category.parent_id || !categoryIds.has(category.parent_id))
    .sort(
      (first, second) =>
        Number(first.sort_order || 0) - Number(second.sort_order || 0) ||
        String(first.name || "").localeCompare(String(second.name || ""), "ar")
    );

  return mainCategories.slice(0, limit);
}

/**
 * Returns featured non-accessory products sorted by newest first.
 *
 * @param {Array<{ created_at?: string, status?: string }>} products
 * @param {number} [limit=4]
 * @returns {Array<object>}
 */
export function selectFeaturedProducts(products, limit = 4) {
  if (!Array.isArray(products) || limit <= 0) {
    return [];
  }

  const activeProducts = products.filter((product) => (product.status || "active") === "active");
  const nonAccessoryProducts = activeProducts.filter((product) => !isAccessoryItem(product));
  const sourceProducts = nonAccessoryProducts.length > 0 ? nonAccessoryProducts : activeProducts;

  return sourceProducts
    .sort(
      (first, second) =>
        new Date(second.created_at || 0).getTime() - new Date(first.created_at || 0).getTime()
    )
    .slice(0, limit);
}

/**
 * Returns active services sorted alphabetically and clipped to a presentation limit.
 *
 * @param {Array<{ category?: string, name?: string, status?: string }>} services
 * @param {number} [limit=3]
 * @returns {Array<object>}
 */
export function selectFeaturedServices(services, limit = 3) {
  if (!Array.isArray(services) || limit <= 0) {
    return [];
  }

  return services
    .filter((service) => (service.status || "active") === "active")
    .sort(
      (first, second) =>
        String(first.category || "").localeCompare(String(second.category || ""), "ar") ||
        String(first.name || "").localeCompare(String(second.name || ""), "ar")
    )
    .slice(0, limit);
}
