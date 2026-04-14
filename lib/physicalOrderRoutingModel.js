import {
  ACCESSORY_MAIN_CATEGORY_SLUG,
  ACCESSORY_SUBCATEGORY_SLUG,
} from "./accessoryCatalog.js";

const LEGACY_ACCESSORY_CATEGORY_SLUG = "accessories";
const ACCESSORY_CATEGORY_SLUGS = new Set([
  LEGACY_ACCESSORY_CATEGORY_SLUG,
  ACCESSORY_MAIN_CATEGORY_SLUG,
  ACCESSORY_SUBCATEGORY_SLUG,
]);

export const PRODUCT_ORDER_KIND = "products";
export const ACCESSORY_ORDER_KIND = "accessories";
export const PRODUCT_ORDERS_SECTION_ID = "product-orders";
export const ACCESSORY_ORDERS_SECTION_ID = "accessory-orders";

/**
 * Normalizes category-like slugs for stable comparisons.
 *
 * @param {unknown} value
 * @returns {string}
 */
function normalizeCategorySlug(value) {
  return String(value || "").trim().toLowerCase();
}

/**
 * Resolves the normalized category identifier from a product-like object.
 *
 * @param {Record<string, any> | null | undefined} product
 * @returns {string}
 */
function getProductCategoryId(product) {
  return String(product?.category_id || product?.categoryId || "").trim();
}

/**
 * Creates a category lookup keyed by category id.
 *
 * @param {Array<Record<string, any>> | Map<string, Record<string, any>> | null | undefined} categories
 * @returns {Map<string, Record<string, any>>}
 */
function resolveCategoryLookup(categories) {
  if (categories instanceof Map) {
    return categories;
  }

  const lookup = new Map();
  for (const category of Array.isArray(categories) ? categories : []) {
    const categoryId = String(category?.id || "").trim();
    if (categoryId) {
      lookup.set(categoryId, category);
    }
  }

  return lookup;
}

/**
 * Resolves the best available category slug for a product.
 *
 * @param {Record<string, any> | null | undefined} product
 * @param {Map<string, Record<string, any>>} categoryLookup
 * @returns {string}
 */
function resolveProductCategorySlug(product, categoryLookup) {
  const inlineSlug = normalizeCategorySlug(product?.category_slug || product?.categorySlug);
  if (inlineSlug) {
    return inlineSlug;
  }

  const categoryId = getProductCategoryId(product);
  if (!categoryId) {
    return "";
  }

  return normalizeCategorySlug(categoryLookup.get(categoryId)?.slug);
}

/**
 * Checks whether a slug belongs to the accessories catalog.
 *
 * @param {unknown} slug
 * @returns {boolean}
 */
function isAccessoryCategorySlug(slug) {
  return ACCESSORY_CATEGORY_SLUGS.has(normalizeCategorySlug(slug));
}

/**
 * Detects whether a product belongs to the accessories catalog.
 *
 * @param {Record<string, any> | null | undefined} product
 * @param {{ categories?: Array<Record<string, any>> | Map<string, Record<string, any>> }} [options]
 * @returns {boolean}
 */
export function isAccessoryPhysicalProduct(product, options = {}) {
  if (!product || typeof product !== "object") {
    return false;
  }

  const productType = normalizeCategorySlug(product.product_type || product.productType);
  if (productType === "accessory") {
    return true;
  }

  const categoryId = getProductCategoryId(product);
  if (!categoryId) {
    return true;
  }

  const categoryLookup = resolveCategoryLookup(options.categories);
  return isAccessoryCategorySlug(resolveProductCategorySlug(product, categoryLookup));
}

/**
 * Classifies a physical order based on the products included in it.
 * Mixed carts are treated as main product orders to keep them visible
 * in the broader operational queue.
 *
 * @param {Array<Record<string, any>> | null | undefined} products
 * @param {{ categories?: Array<Record<string, any>> | Map<string, Record<string, any>> }} [options]
 * @returns {"products" | "accessories"}
 */
export function getPhysicalOrderKindFromProducts(products, options = {}) {
  if (!Array.isArray(products) || products.length === 0) {
    return PRODUCT_ORDER_KIND;
  }

  const hasMainCatalogProduct = products.some(
    (product) => !isAccessoryPhysicalProduct(product, options)
  );
  return hasMainCatalogProduct ? PRODUCT_ORDER_KIND : ACCESSORY_ORDER_KIND;
}

/**
 * Maps an order kind to its admin section identifier.
 *
 * @param {string | null | undefined} kind
 * @returns {"product-orders" | "accessory-orders"}
 */
export function getPhysicalOrderSectionId(kind) {
  return kind === ACCESSORY_ORDER_KIND
    ? ACCESSORY_ORDERS_SECTION_ID
    : PRODUCT_ORDERS_SECTION_ID;
}
