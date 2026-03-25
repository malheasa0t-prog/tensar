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
 * Returns the Next.js href used for category links.
 *
 * @param {{ slug?: string | null, id?: string | null }} category
 * @returns {string}
 */
export function getCategoryHref(category) {
  return `/category/${category?.slug || category?.id || ''}`;
}

/**
 * Sums the product counts of nested subcategories.
 *
 * @param {Record<string, number>} counts
 * @returns {number}
 */
export function getTotalNestedProducts(counts) {
  return Object.values(counts || {}).reduce((sum, count) => sum + count, 0);
}

/**
 * Builds the hero stat cards for the category page.
 *
 * @param {{
 *   hasSubCategories: boolean,
 *   subCategories: Array<Record<string, unknown>>,
 *   totalNestedProducts: number,
 *   products: Array<Record<string, unknown>>,
 *   mainCategory: Record<string, unknown> | null,
 *   category: Record<string, unknown> | null,
 * }} params
 * @returns {Array<{ label: string, value: string | number, tone?: string }>}
 */
export function buildCategoryHeroStats({
  hasSubCategories,
  subCategories,
  totalNestedProducts,
  products,
  mainCategory,
  category,
}) {
  if (hasSubCategories) {
    return [
      { label: 'فئة فرعية', value: subCategories.length, tone: 'success' },
      { label: 'منتج داخلها', value: totalNestedProducts },
      { label: 'نوع العرض', value: 'بالفئات', tone: 'accent' },
    ];
  }

  return [
    { label: 'منتج متاح', value: products.length, tone: 'success' },
    { label: 'الفئة الأم', value: mainCategory?.name || category?.name || 'غير متاح' },
    { label: 'الانتقال', value: 'مباشر', tone: 'accent' },
  ];
}

/**
 * Returns the fallback hero description for a category.
 *
 * @param {{ description?: string | null }} category
 * @param {boolean} hasSubCategories
 * @returns {string}
 */
export function getCategoryHeroDescription(category, hasSubCategories) {
  if (category?.description) {
    return category.description;
  }

  return hasSubCategories
    ? 'هذه فئة رئيسية تقود إلى أقسام فرعية مرتبة قبل الوصول إلى المنتجات الخاصة بكل قسم.'
    : 'هذه الصفحة تعرض المنتجات المرتبطة بهذه الفئة مباشرة داخل بطاقات أوضح وأسهل للتصفح.';
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
    description: product.description,
    badge: product.brand || null,
    images: product.images || [],
    icon: product.icon || categoryName || 'package',
    link: `/products/${product.id}`,
  };
}
