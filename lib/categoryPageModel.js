/**
 * Category page helpers used by the public category explorer.
 */

/**
 * Builds a slug compatible with Arabic and Latin category names.
 *
 * @param {string | null | undefined} text
 * @returns {string}
 */
export function slugifyArabic(text) {
  return (text || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\u0600-\u06FFa-z0-9-_]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Returns the public href used for category links.
 *
 * @param {{ slug?: string | null, id?: string | null }} category
 * @returns {string}
 */
export function getCategoryHref(category) {
  return `/category/${category?.slug || category?.id || ''}`;
}

/**
 * Maps a raw product row to the ProductCard contract.
 *
 * @param {Record<string, unknown>} product
 * @param {string} categoryName
 * @returns {Record<string, unknown>}
 */
export function mapCategoryProductCard(product, categoryName) {
  return {
    id: product.id,
    name: product.name,
    category: categoryName,
    categoryId: product.category_id,
    price: product.price,
    discountPrice: product.discount_price,
    quantity: product.quantity,
    description: product.description,
    badge: product.brand || null,
    rating: product.rating,
    reviewCount: product.review_count || product.reviews_count || product.sold || null,
    images: product.images || [],
    icon: product.icon || categoryName || 'package',
    link: `/products/${product.id}`,
  };
}
