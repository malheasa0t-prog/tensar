export const EMPTY_ADMIN_PRODUCT_FORM = {
  main_category_id: '',
  category_id: '',
  name: '',
  brand: '',
  price: '',
  discount_price: '',
  quantity: '',
  status: 'active',
  description: '',
  low_stock_alert: '5',
};

/**
 * Formats product prices for the admin dashboard.
 *
 * @param {number | string | null | undefined} value
 * @returns {string}
 */
export function formatAdminProductMoney(value) {
  return `${Number(value || 0).toFixed(2)} د.أ`;
}

/**
 * Returns the sorted list of main categories.
 *
 * @param {Array<Record<string, unknown>>} categories
 * @returns {Array<Record<string, unknown>>}
 */
export function getAdminMainCategories(categories = []) {
  return categories
    .filter((category) => !category.parent_id)
    .sort((first, second) => Number(first.sort_order || 0) - Number(second.sort_order || 0));
}

/**
 * Returns the sorted list of subcategories, optionally scoped to a main category.
 *
 * @param {Array<Record<string, unknown>>} categories
 * @param {string} [mainCategoryId]
 * @returns {Array<Record<string, unknown>>}
 */
export function getAdminSubcategories(categories = [], mainCategoryId = '') {
  return categories
    .filter(
      (category) => category.parent_id && (!mainCategoryId || category.parent_id === mainCategoryId)
    )
    .sort((first, second) => Number(first.sort_order || 0) - Number(second.sort_order || 0));
}

/**
 * Builds the default creation form from the available category tree.
 *
 * @param {Array<Record<string, unknown>>} categories
 * @returns {typeof EMPTY_ADMIN_PRODUCT_FORM}
 */
export function buildInitialAdminProductForm(categories = []) {
  const mainCategories = getAdminMainCategories(categories);
  const defaultMainCategoryId = mainCategories[0]?.id || '';
  const defaultSubcategoryId = getAdminSubcategories(categories, defaultMainCategoryId)[0]?.id || '';

  return {
    ...EMPTY_ADMIN_PRODUCT_FORM,
    main_category_id: defaultMainCategoryId,
    category_id: defaultSubcategoryId,
  };
}

/**
 * Converts an API row into an editable local draft.
 *
 * @param {Record<string, unknown>} product
 * @returns {typeof EMPTY_ADMIN_PRODUCT_FORM}
 */
export function buildAdminProductDraft(product = {}) {
  return {
    main_category_id: product.main_category_id || '',
    category_id: product.category_id || '',
    name: product.name || '',
    brand: product.brand || '',
    price: String(product.price ?? ''),
    discount_price: String(product.discount_price ?? ''),
    quantity: String(product.quantity ?? ''),
    status: product.status || 'active',
    description: product.description || '',
    low_stock_alert: String(product.low_stock_alert ?? 5),
  };
}

/**
 * Creates a draft map keyed by product id for inline editing.
 *
 * @param {Array<Record<string, unknown>>} products
 * @returns {Record<string, typeof EMPTY_ADMIN_PRODUCT_FORM>}
 */
export function buildAdminProductDraftMap(products = []) {
  return products.reduce((accumulator, product) => {
    accumulator[product.id] = buildAdminProductDraft(product);
    return accumulator;
  }, {});
}

/**
 * Applies a single field mutation and keeps the subcategory in sync with the selected main category.
 *
 * @param {typeof EMPTY_ADMIN_PRODUCT_FORM} currentState
 * @param {string} field
 * @param {string} value
 * @param {Array<Record<string, unknown>>} categories
 * @returns {typeof EMPTY_ADMIN_PRODUCT_FORM}
 */
export function applyAdminProductFieldChange(currentState, field, value, categories = []) {
  if (field === 'main_category_id') {
    const nextSubcategoryId = getAdminSubcategories(categories, value)[0]?.id || '';

    return {
      ...currentState,
      main_category_id: value,
      category_id: nextSubcategoryId,
    };
  }

  return {
    ...currentState,
    [field]: value,
  };
}

/**
 * Filters products by free-text search and category selections.
 *
 * @param {Array<Record<string, unknown>>} products
 * @param {string} search
 * @param {string} mainFilter
 * @param {string} subFilter
 * @returns {Array<Record<string, unknown>>}
 */
export function filterAdminProducts(products = [], search = '', mainFilter = '', subFilter = '') {
  const query = search.trim().toLowerCase();

  return products.filter((product) => {
    const haystack = [
      product.name,
      product.brand,
      product.id,
      product.main_category_name,
      product.subcategory_name,
    ]
      .join(' ')
      .toLowerCase();

    const matchesQuery = !query || haystack.includes(query);
    const matchesMain = !mainFilter || product.main_category_id === mainFilter;
    const matchesSub = !subFilter || product.category_id === subFilter;

    return matchesQuery && matchesMain && matchesSub;
  });
}

/**
 * Counts products that reached their configured low-stock threshold.
 *
 * @param {Array<Record<string, unknown>>} products
 * @returns {number}
 */
export function countLowStockAdminProducts(products = []) {
  return products.filter(
    (product) => Number(product.quantity || 0) <= Number(product.low_stock_alert || 0)
  ).length;
}

/**
 * Builds a readable subcategory label for mixed filter dropdowns.
 *
 * @param {Record<string, unknown>} category
 * @param {Array<Record<string, unknown>>} categories
 * @returns {string}
 */
export function getAdminSubcategoryFilterLabel(category, categories = []) {
  const parentName = categories.find((item) => item.id === category.parent_id)?.name || '';

  return parentName ? `${parentName} / ${category.name}` : category.name || '';
}
