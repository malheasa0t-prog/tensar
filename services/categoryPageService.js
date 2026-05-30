import { slugifyArabic } from '@/lib/categoryPageModel';
import { loadSupabaseClient } from '@/lib/loadSupabaseClient';
import { subscribeToTableChanges } from '@/lib/realtimeTableSubscription';

const CATEGORY_PAGE_CACHE_TTL_MS = 60_000;
const categoryPageSnapshotCache = new Map();
const pendingCategoryPageSnapshots = new Map();

/**
 * Normalizes category route values for cache keys.
 *
 * @param {unknown} routeValue - Raw category id or slug from the route.
 * @returns {string} Trimmed cache key.
 */
function normalizeCategoryPageCacheKey(routeValue) {
  return String(routeValue || '').trim();
}

/**
 * Normalizes category/service labels for text matching.
 *
 * @param {unknown} value - Raw label value.
 * @returns {string} Search-safe label.
 */
function normalizeCategoryLabel(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('ar');
}

/**
 * Returns the standard category-not-found snapshot.
 *
 * @returns {{
 *   error: boolean,
 *   category: null,
 *   mainCategory: null,
 *   subCategories: Array<Record<string, unknown>>,
 *   repairServices: Array<Record<string, unknown>>,
 *   products: Array<Record<string, unknown>>,
 *   subCategoryServiceCounts: Record<string, number>,
 *   subCategoryProductsCount: Record<string, number>,
 * }}
 */
function createEmptyCategoryPageSnapshot() {
  return {
    error: true,
    category: null,
    mainCategory: null,
    subCategories: [],
    repairServices: [],
    products: [],
    subCategoryServiceCounts: {},
    subCategoryProductsCount: {},
  };
}

/**
 * Checks whether a cached category snapshot can still be reused.
 *
 * @param {{ cached?: { timestamp: number }, now: number }} input - Cache metadata.
 * @returns {boolean} True when the cached value is still fresh.
 */
function isFreshCategoryPageSnapshot(input) {
  return Boolean(
    input.cached && input.now - input.cached.timestamp < CATEGORY_PAGE_CACHE_TTL_MS
  );
}

/**
 * Loads a category either by its raw id or normalized slug.
 *
 * @param {string} routeValue - Category id or slug from the URL.
 * @param {Record<string, unknown>} supabase - Supabase client instance.
 * @returns {Promise<Record<string, unknown> | null>} Active category row.
 */
async function findCategory(routeValue, supabase) {
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
 * Builds a category lookup keyed by id.
 *
 * @param {Array<Record<string, unknown>>} categories - Active category rows.
 * @returns {Map<string, Record<string, unknown>>} Lookup map.
 */
function buildCategoryById(categories) {
  return new Map(categories.map((category) => [String(category.id), category]));
}

/**
 * Returns direct children for a category.
 *
 * @param {Array<Record<string, unknown>>} categories - Active category rows.
 * @param {unknown} parentId - Parent category id.
 * @returns {Array<Record<string, unknown>>} Ordered direct children.
 */
function getDirectSubCategories(categories, parentId) {
  const parentKey = String(parentId || '');

  return categories
    .filter((category) => String(category.parent_id || '') === parentKey)
    .sort((first, second) => Number(first.sort_order || 0) - Number(second.sort_order || 0));
}

/**
 * Recursively collects all descendants for a category.
 *
 * @param {Array<Record<string, unknown>>} categories - Active category rows.
 * @param {unknown} parentId - Parent category id.
 * @returns {Array<Record<string, unknown>>} Descendant categories.
 */
function collectDescendantCategories(categories, parentId) {
  const directChildren = getDirectSubCategories(categories, parentId);
  const descendants = [...directChildren];

  for (const child of directChildren) {
    descendants.push(...collectDescendantCategories(categories, child.id));
  }

  return descendants;
}

/**
 * Finds the top-level parent category.
 *
 * @param {Record<string, unknown>} category - Current category.
 * @param {Map<string, Record<string, unknown>>} categoryById - Category lookup.
 * @returns {Record<string, unknown>} Root category.
 */
function findRootCategory(category, categoryById) {
  let current = category;
  const visitedIds = new Set();

  while (current?.parent_id && !visitedIds.has(String(current.id))) {
    visitedIds.add(String(current.id));
    current = categoryById.get(String(current.parent_id)) || current;
    if (!current?.parent_id) break;
  }

  return current || category;
}

/**
 * Builds a label-to-category map for services visible under a category.
 *
 * @param {Array<Record<string, unknown>>} categories - Category rows.
 * @returns {Map<string, Record<string, unknown>>} Normalized label lookup.
 */
function buildCategoryLabelMap(categories) {
  const labelMap = new Map();

  for (const category of categories) {
    const key = normalizeCategoryLabel(category.name);
    if (key) labelMap.set(key, category);
  }

  return labelMap;
}

/**
 * Returns whether a repair service belongs to a visible category.
 *
 * @param {Record<string, unknown>} service - Repair service row.
 * @param {Map<string, Record<string, unknown>>} categoryLabelMap - Label lookup.
 * @returns {Record<string, unknown> | null} Matched category row.
 */
function matchServiceCategory(service, categoryLabelMap) {
  const serviceCategoryKey = normalizeCategoryLabel(service.category);

  return categoryLabelMap.get(serviceCategoryKey) || null;
}

/**
 * Returns the visible category linked to a catalog service row.
 *
 * @param {{
 *   categoryById: Map<string, Record<string, unknown>>,
 *   service: Record<string, unknown>,
 *   visibleCategoryIds: Set<string>,
 * }} input - Service/category lookup input.
 * @returns {Record<string, unknown> | null} Matched category row.
 */
function matchCatalogServiceCategory(input) {
  const categoryId = String(input.service.category_id || '');

  if (!categoryId || !input.visibleCategoryIds.has(categoryId)) {
    return null;
  }

  return input.categoryById.get(categoryId) || null;
}

/**
 * Adds category display metadata to a repair service.
 *
 * @param {{
 *   service: Record<string, unknown>,
 *   matchedCategory: Record<string, unknown>,
 *   currentCategory: Record<string, unknown>,
 * }} input - Service and matched category context.
 * @returns {Record<string, unknown>} Enriched repair service.
 */
function mapVisibleRepairService(input) {
  const isFromChildCategory = String(input.matchedCategory.id) !== String(input.currentCategory.id);

  return {
    ...input.service,
    category_id: input.matchedCategory.id,
    categoryLabel: input.matchedCategory.name || input.service.category || '',
    categorySlug: input.matchedCategory.slug || input.matchedCategory.id,
    isSubCategoryService: Boolean(isFromChildCategory),
  };
}

/**
 * Adds display metadata to a catalog service row.
 *
 * @param {{
 *   service: Record<string, unknown>,
 *   matchedCategory: Record<string, unknown>,
 *   currentCategory: Record<string, unknown>,
 * }} input - Service and matched category context.
 * @returns {Record<string, unknown>} Enriched catalog service.
 */
function mapVisibleCatalogService(input) {
  const isFromChildCategory = String(input.matchedCategory.id) !== String(input.currentCategory.id);

  return {
    ...input.service,
    sourceType: 'catalog-service',
    categoryLabel: input.matchedCategory.name || '',
    categorySlug: input.matchedCategory.slug || input.matchedCategory.id,
    isSubCategoryService: Boolean(isFromChildCategory),
  };
}

/**
 * Counts services for each direct subcategory including deeper descendants.
 *
 * @param {{
 *   subCategories: Array<Record<string, unknown>>,
 *   allCategories: Array<Record<string, unknown>>,
 *   catalogServices: Array<Record<string, unknown>>,
 *   repairServices: Array<Record<string, unknown>>,
 * }} input - Category/service rows.
 * @returns {Record<string, number>} Counts keyed by subcategory id.
 */
function countServicesForSubCategories(input) {
  const counts = {};

  for (const subCategory of input.subCategories) {
    const visibleCategories = [
      subCategory,
      ...collectDescendantCategories(input.allCategories, subCategory.id),
    ];
    const categoryLabels = new Set(
      visibleCategories
        .map((category) => normalizeCategoryLabel(category.name))
        .filter(Boolean)
    );
    const categoryIds = new Set(visibleCategories.map((category) => String(category.id)));
    const repairCount = input.repairServices.filter((service) =>
      categoryLabels.has(normalizeCategoryLabel(service.category))
    ).length;
    const catalogCount = input.catalogServices.filter((service) =>
      categoryIds.has(String(service.category_id || ''))
    ).length;

    counts[subCategory.id] = repairCount + catalogCount;
  }

  return counts;
}

/**
 * Loads the full category view model used by the category page.
 *
 * @param {string} routeValue - Category id or slug.
 * @returns {Promise<{
 *   error: boolean,
 *   category: Record<string, unknown> | null,
 *   mainCategory: Record<string, unknown> | null,
 *   subCategories: Array<Record<string, unknown>>,
 *   repairServices: Array<Record<string, unknown>>,
 *   products: Array<Record<string, unknown>>,
 *   subCategoryServiceCounts: Record<string, number>,
 *   subCategoryProductsCount: Record<string, number>,
 * }>} Category page snapshot.
 */
export async function loadCategoryPageSnapshot(routeValue) {
  const cacheKey = normalizeCategoryPageCacheKey(routeValue);
  const now = Date.now();
  const cached = categoryPageSnapshotCache.get(cacheKey);

  if (!cacheKey) return createEmptyCategoryPageSnapshot();
  if (isFreshCategoryPageSnapshot({ cached, now })) return cached.snapshot;
  if (pendingCategoryPageSnapshots.has(cacheKey)) {
    return pendingCategoryPageSnapshots.get(cacheKey);
  }

  const pendingSnapshot = loadFreshCategoryPageSnapshot(cacheKey, now)
    .catch((error) => {
      if (cached?.snapshot) return cached.snapshot;
      throw error;
    })
    .finally(() => pendingCategoryPageSnapshots.delete(cacheKey));

  pendingCategoryPageSnapshots.set(cacheKey, pendingSnapshot);
  return pendingSnapshot;
}

/**
 * Warms a category page snapshot without surfacing background errors.
 *
 * @param {string} routeValue - Category id or slug.
 * @returns {Promise<unknown>} Prefetch result.
 */
export function prefetchCategoryPageSnapshot(routeValue) {
  return loadCategoryPageSnapshot(routeValue).catch(() => null);
}

/**
 * Clears every cached category snapshot so the next load re-reads from Supabase.
 *
 * @returns {void}
 */
export function invalidateCategoryPageCache() {
  categoryPageSnapshotCache.clear();
}

/**
 * Subscribes to the tables behind category pages (categories + the service
 * catalogs) so the page refreshes within moments of an admin edit instead of
 * waiting for the 60s cache TTL.
 *
 * @param {() => void} onChange
 * @param {Record<string, unknown>} [client]
 * @returns {() => void}
 */
export function subscribeToCategoryPage(onChange, client) {
  return subscribeToTableChanges({
    channel: 'storefront-category',
    tables: ['categories', 'repair_services', 'services'],
    client,
    onChange: () => {
      invalidateCategoryPageCache();
      if (typeof onChange === 'function') onChange();
    },
  });
}

/**
 * Loads a fresh category page snapshot from Supabase.
 *
 * @param {string} routeValue - Category id or slug.
 * @param {number} now - Snapshot timestamp.
 * @returns {ReturnType<typeof loadCategoryPageSnapshot>} Fresh snapshot.
 */
async function loadFreshCategoryPageSnapshot(routeValue, now) {
  const supabase = await loadSupabaseClient();
  const category = await findCategory(routeValue, supabase);
  if (!category) {
    return createEmptyCategoryPageSnapshot();
  }

  const [categoriesResponse, repairServicesResponse, catalogServicesResponse] = await Promise.all([
    supabase
      .from('categories')
      .select('*')
      .eq('status', 'active')
      .order('sort_order', { ascending: true }),
    supabase
      .from('repair_services')
      .select('*')
      .eq('status', 'active')
      .order('sort_order', { ascending: true }),
    supabase
      .from('services')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false }),
  ]);

  const allCategories = categoriesResponse.data || [];
  const activeCategory = allCategories.find((item) => String(item.id) === String(category.id)) || category;
  const categoryById = buildCategoryById(allCategories);
  const subCategories = getDirectSubCategories(allCategories, activeCategory.id);
  const visibleCategories = [
    activeCategory,
    ...collectDescendantCategories(allCategories, activeCategory.id),
  ];
  const visibleCategoryLabels = buildCategoryLabelMap(visibleCategories);
  const visibleCategoryIds = new Set(visibleCategories.map((item) => String(item.id)));
  const catalogServices = (catalogServicesResponse.data || [])
    .map((service) => {
      const matchedCategory = matchCatalogServiceCategory({
        categoryById,
        service,
        visibleCategoryIds,
      });
      if (!matchedCategory) return null;

      return mapVisibleCatalogService({
        service,
        matchedCategory,
        currentCategory: activeCategory,
      });
    })
    .filter(Boolean);
  const repairServices = (repairServicesResponse.data || [])
    .map((service) => {
      const matchedCategory = matchServiceCategory(service, visibleCategoryLabels);
      if (!matchedCategory) return null;

      return mapVisibleRepairService({
        service,
        matchedCategory,
        currentCategory: activeCategory,
      });
    })
    .filter(Boolean);
  const subCategoryServiceCounts = countServicesForSubCategories({
    subCategories,
    allCategories,
    catalogServices: catalogServicesResponse.data || [],
    repairServices: repairServicesResponse.data || [],
  });
  const visibleServices = [...catalogServices, ...repairServices];

  const snapshot = {
    error: false,
    category: activeCategory,
    mainCategory: findRootCategory(activeCategory, categoryById),
    subCategories,
    repairServices: visibleServices,
    products: [],
    subCategoryServiceCounts,
    subCategoryProductsCount: subCategoryServiceCounts,
  };

  categoryPageSnapshotCache.set(routeValue, { snapshot, timestamp: now });
  return snapshot;
}
