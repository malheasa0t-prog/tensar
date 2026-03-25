export const ACCESSORY_SECTION_NAME = 'منتجات اكسسورات';
export const ACCESSORY_PUBLIC_LABEL = 'إكسسورات';
export const ACCESSORY_MAIN_CATEGORY_ID = 'cat-accessories-direct-root';
export const ACCESSORY_SUBCATEGORY_ID = 'cat-accessories-direct-items';
export const ACCESSORY_MAIN_CATEGORY_SLUG = 'accessories-direct-root';
export const ACCESSORY_SUBCATEGORY_SLUG = 'accessories-direct-items';
export const ACCESSORY_PRODUCTS_SECTION_ID = 'accessories-products';
export const ACCESSORY_PRODUCTS_SECTION_HREF = `/products#${ACCESSORY_PRODUCTS_SECTION_ID}`;

export const ACCESSORY_MAIN_CATEGORY_SEED = {
  id: ACCESSORY_MAIN_CATEGORY_ID,
  name: ACCESSORY_SECTION_NAME,
  slug: ACCESSORY_MAIN_CATEGORY_SLUG,
  parent_id: null,
  status: 'active',
  sort_order: 9991,
  icon: 'keyboard',
  image: null,
  description: 'فئة داخلية مخصصة لنظام منتجات الإكسسوارات المباشر.',
};

export const ACCESSORY_SUBCATEGORY_SEED = {
  id: ACCESSORY_SUBCATEGORY_ID,
  name: 'قسم مباشر',
  slug: ACCESSORY_SUBCATEGORY_SLUG,
  parent_id: ACCESSORY_MAIN_CATEGORY_ID,
  status: 'active',
  sort_order: 9992,
  icon: 'package',
  image: null,
  description: 'فئة فرعية داخلية تحفظ منتجات الإكسسوارات التي تظهر مباشرة في صفحة المنتجات.',
};

export function isAccessoryCatalogCategoryId(categoryId) {
  return categoryId === ACCESSORY_MAIN_CATEGORY_ID || categoryId === ACCESSORY_SUBCATEGORY_ID;
}

export function isAccessoryProductCategoryId(categoryId) {
  return categoryId === ACCESSORY_SUBCATEGORY_ID;
}

export function isAccessoryProduct(product) {
  return product?.product_type === 'accessory' || !product?.category_id || isAccessoryProductCategoryId(product?.category_id);
}
