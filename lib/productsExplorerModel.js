/**
 * Product explorer helpers used by the public products page.
 */

export const PRODUCTS_EXPLORER_DEFAULT_SORT = "newest";
export const PRODUCTS_EXPLORER_DEFAULT_VIEW = "grid";
export const PRODUCTS_EXPLORER_LOW_STOCK_LIMIT = 6;

export const PRODUCT_TYPE_LABELS = {
  physical: "منتجات فعلية",
  service: "خدمات",
};

export const PRODUCTS_SORT_OPTIONS = [
  { value: PRODUCTS_EXPLORER_DEFAULT_SORT, label: "الأحدث" },
  { value: "price_asc", label: "الأقل سعرًا" },
  { value: "best_selling", label: "الأكثر مبيعًا" },
];

export const PRODUCT_AVAILABILITY_OPTIONS = [
  { value: "in_stock", label: "متوفر" },
  { value: "low_stock", label: "شبه نافد" },
  { value: "out_of_stock", label: "غير متوفر" },
];

const ON_DEMAND_PRODUCT_TYPES = new Set(["service"]);

/**
 * Normalizes any value into a searchable lowercase string.
 *
 * @param {unknown} value
 * @returns {string}
 */
function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

/**
 * Reads the first valid non-negative number candidate.
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
 * Reads the first valid non-negative integer candidate.
 *
 * @param {...unknown} candidates
 * @returns {number}
 */
function readInteger(...candidates) {
  return Math.trunc(readNumber(...candidates));
}

/**
 * Maps a raw product row to the public product explorer contract.
 *
 * @param {Record<string, unknown>} product
 * @param {string} categoryName
 * @returns {Record<string, unknown>}
 */
export function mapProductsExplorerProduct(product, categoryName) {
  return {
    id: product.id,
    name: product.name,
    category: categoryName,
    categoryId: product.category_id || "",
    productType: product.product_type || "physical",
    price: product.price,
    discountPrice: product.discount_price,
    quantity: product.quantity,
    description: product.description,
    badge: product.brand || null,
    rating: product.rating,
    sold: product.sold,
    reviewCount: product.review_count || product.reviews_count || product.sold || null,
    images: Array.isArray(product.images) ? product.images : [],
    icon: product.icon || categoryName || "package",
    status: product.status,
    createdAt: product.created_at,
    link: `/products/${product.id}`,
  };
}

/**
 * Resolves the effective display price for explorer sorting and filtering.
 *
 * @param {Record<string, unknown> | null | undefined} product
 * @returns {number}
 */
export function getProductsExplorerPrice(product) {
  return readNumber(product?.discountPrice, product?.discount_price, product?.price);
}

/**
 * Resolves the public product type identifier.
 *
 * @param {Record<string, unknown> | null | undefined} product
 * @returns {string}
 */
export function getProductsExplorerType(product) {
  return normalizeText(product?.productType || product?.product_type) || "physical";
}

/**
 * Returns the human label for a product type.
 *
 * @param {string} productType
 * @returns {string}
 */
export function getProductsExplorerTypeLabel(productType) {
  return PRODUCT_TYPE_LABELS[normalizeText(productType)] || "أخرى";
}

/**
 * Resolves the product availability state used by the public filters.
 *
 * @param {Record<string, unknown> | null | undefined} product
 * @returns {"in_stock" | "low_stock" | "out_of_stock"}
 */
export function getProductsExplorerAvailability(product) {
  const status = normalizeText(product?.status);
  const productType = getProductsExplorerType(product);

  if (status === "out_of_stock") {
    return "out_of_stock";
  }

  if (ON_DEMAND_PRODUCT_TYPES.has(productType)) {
    return "in_stock";
  }

  const quantity = readInteger(product?.quantity, product?.stock_quantity, product?.inventory);
  if (quantity <= 0) {
    return "out_of_stock";
  }

  return quantity <= PRODUCTS_EXPLORER_LOW_STOCK_LIMIT ? "low_stock" : "in_stock";
}

/**
 * Returns the public label for an availability state.
 *
 * @param {string} availability
 * @returns {string}
 */
export function getProductsExplorerAvailabilityLabel(availability) {
  return PRODUCT_AVAILABILITY_OPTIONS.find((option) => option.value === availability)?.label || "غير محدد";
}

/**
 * Checks whether a product matches the current search query.
 *
 * @param {Record<string, unknown>} product
 * @param {string} query
 * @returns {boolean}
 */
export function matchesProductsExplorerSearch(product, query) {
  if (!query) {
    return true;
  }

  return [product?.name, product?.description, product?.badge, product?.category].some((value) =>
    normalizeText(value).includes(query)
  );
}

/**
 * Filters products according to the active public explorer controls.
 *
 * @param {{
 *   products: Array<Record<string, unknown>>,
 *   searchQuery?: string,
 *   categoryId?: string,
 *   productType?: string,
 *   availability?: string,
 *   minPrice?: string | number,
 *   maxPrice?: string | number,
 * }} options
 * @returns {Array<Record<string, unknown>>}
 */
export function filterProductsExplorerProducts(options) {
  const query = normalizeText(options?.searchQuery);
  const selectedCategoryId = normalizeText(options?.categoryId);
  const selectedType = normalizeText(options?.productType);
  const selectedAvailability = normalizeText(options?.availability);
  const minimumPrice = readNumber(options?.minPrice);
  const maximumPrice = readNumber(options?.maxPrice);

  return (Array.isArray(options?.products) ? options.products : []).filter((product) => {
    const price = getProductsExplorerPrice(product);
    const hasMinimumPrice = minimumPrice > 0;
    const hasMaximumPrice = maximumPrice > 0;

    if (!matchesProductsExplorerSearch(product, query)) return false;
    if (selectedCategoryId && normalizeText(product?.categoryId) !== selectedCategoryId) return false;
    if (selectedType && getProductsExplorerType(product) !== selectedType) return false;
    if (selectedAvailability && getProductsExplorerAvailability(product) !== selectedAvailability) return false;
    if (hasMinimumPrice && price < minimumPrice) return false;
    if (hasMaximumPrice && price > maximumPrice) return false;
    return true;
  });
}

/**
 * Sorts explorer products according to the selected strategy.
 *
 * @param {{
 *   products: Array<Record<string, unknown>>,
 *   sortOption?: string,
 * }} options
 * @returns {Array<Record<string, unknown>>}
 */
export function sortProductsExplorerProducts(options) {
  const sortOption = normalizeText(options?.sortOption) || PRODUCTS_EXPLORER_DEFAULT_SORT;
  const products = [...(Array.isArray(options?.products) ? options.products : [])];

  if (sortOption === "price_asc") {
    return products.sort((first, second) => getProductsExplorerPrice(first) - getProductsExplorerPrice(second));
  }

  if (sortOption === "best_selling") {
    return products.sort(
      (first, second) => readInteger(second?.sold, second?.reviewCount) - readInteger(first?.sold, first?.reviewCount)
    );
  }

  return products.sort(
    (first, second) =>
      new Date(second?.createdAt || second?.created_at || 0).getTime() -
      new Date(first?.createdAt || first?.created_at || 0).getTime()
  );
}

/**
 * Builds the user-facing labels shown for the active explorer filters.
 *
 * @param {{
 *   searchQuery?: string,
 *   categoryName?: string,
 *   productTypeLabel?: string,
 *   availabilityLabel?: string,
 *   minPrice?: string | number,
 *   maxPrice?: string | number,
 *   sortLabel?: string,
 *   sortOption?: string,
 * }} options
 * @returns {string[]}
 */
export function buildProductsExplorerActiveFilters(options) {
  const labels = [];
  const minimumPrice = readNumber(options?.minPrice);
  const maximumPrice = readNumber(options?.maxPrice);

  if (normalizeText(options?.searchQuery)) labels.push(`بحث: ${String(options.searchQuery).trim()}`);
  if (normalizeText(options?.categoryName)) labels.push(`الفئة: ${options.categoryName}`);
  if (normalizeText(options?.productTypeLabel)) labels.push(`النوع: ${options.productTypeLabel}`);
  if (normalizeText(options?.availabilityLabel)) labels.push(`التوفر: ${options.availabilityLabel}`);

  if (minimumPrice > 0 && maximumPrice > 0) {
    labels.push(`السعر: من ${minimumPrice} إلى ${maximumPrice} د.أ`);
  } else if (minimumPrice > 0) {
    labels.push(`السعر: يبدأ من ${minimumPrice} د.أ`);
  } else if (maximumPrice > 0) {
    labels.push(`السعر: حتى ${maximumPrice} د.أ`);
  }

  if (normalizeText(options?.sortOption) && options.sortOption !== PRODUCTS_EXPLORER_DEFAULT_SORT) {
    labels.push(`الترتيب: ${options.sortLabel}`);
  }

  return labels;
}
