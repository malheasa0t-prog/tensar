import { supabase } from '@/lib/supabaseClient';
import { slugifyArabic } from '@/lib/categoryPageModel';

/**
 * Loads a category either by its raw id or normalized slug.
 *
 * @param {string} routeValue
 * @returns {Promise<Record<string, unknown> | null>}
 */
async function findCategory(routeValue) {
  let decodedValue = String(routeValue || '').trim();

  try {
    decodedValue = decodeURIComponent(decodedValue).trim();
  } catch {
    decodedValue = String(routeValue || '').trim();
  }

  const normalizedSlug = slugifyArabic(decodedValue);

  let response = await supabase
    .from('categories')
    .select('*')
    .eq('id', decodedValue)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  if (response.error || response.data) {
    return response.data || null;
  }

  response = await supabase
    .from('categories')
    .select('*')
    .eq('slug', normalizedSlug)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  return response.data || null;
}

/**
 * Counts active products for the provided subcategory ids.
 *
 * @param {string[]} subCategoryIds
 * @returns {Promise<Record<string, number>>}
 */
async function loadSubCategoryItemCounts(subCategoryIds) {
  if (!subCategoryIds.length) {
    return {};
  }

  const productsResponse = await supabase
    .from('products')
    .select('category_id')
    .eq('status', 'active')
    .or('product_type.is.null,product_type.eq.physical')
    .in('category_id', subCategoryIds);

  const counts = {};
  for (const item of (productsResponse.data || [])) {
    counts[item.category_id] = (counts[item.category_id] || 0) + 1;
  }

  return counts;
}

/**
 * Loads the full category view model used by the category page.
 *
 * @param {string} routeValue
 * @returns {Promise<{
 *   error: boolean,
 *   category: Record<string, unknown> | null,
 *   mainCategory: Record<string, unknown> | null,
 *   subCategories: Array<Record<string, unknown>>,
 *   products: Array<Record<string, unknown>>,
 *   subCategoryProductsCount: Record<string, number>,
 * }>}
 */
export async function loadCategoryPageSnapshot(routeValue) {
  if (!routeValue) {
    return {
      error: true,
      category: null,
      mainCategory: null,
      subCategories: [],
      products: [],
      subCategoryProductsCount: {},
    };
  }

  const category = await findCategory(routeValue);
  if (!category) {
    return {
      error: true,
      category: null,
      mainCategory: null,
      subCategories: [],
      products: [],
      subCategoryProductsCount: {},
    };
  }

  const rootCategoryId = category.parent_id || category.id;
  const [rootResponse, subCategoriesResponse, productsResponse] = await Promise.all([
    supabase
      .from('categories')
      .select('*')
      .eq('id', rootCategoryId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle(),
    supabase
      .from('categories')
      .select('*')
      .eq('parent_id', rootCategoryId)
      .eq('status', 'active')
      .order('sort_order', { ascending: true }),
    supabase
      .from('products')
      .select('*')
      .eq('status', 'active')
      .or('product_type.is.null,product_type.eq.physical')
      .eq('category_id', category.id)
      .order('created_at', { ascending: false }),
  ]);

  const subCategories = subCategoriesResponse.data || [];
  const subCategoryProductsCount = !category.parent_id
    ? await loadSubCategoryItemCounts(subCategories.map((subCategory) => subCategory.id))
    : {};

  return {
    error: false,
    category,
    mainCategory: rootResponse.data || null,
    subCategories,
    products: productsResponse.data || [],
    subCategoryProductsCount,
  };
}
