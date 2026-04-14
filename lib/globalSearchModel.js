/**
 * Filtering and suggestion helpers for the global site search.
 */

import {
  DEFAULT_PRODUCT_CATEGORY,
  createGlobalSearchCategoryItem,
  createGlobalSearchProductItem,
  createGlobalSearchServiceItem,
  getGlobalSearchTypeLabel,
  normalizeSearchText,
  slugifySearchPathSegment,
} from "./globalSearchFactory.js";

export { getGlobalSearchTypeLabel, slugifySearchPathSegment };

export const GLOBAL_SEARCH_DEFAULT_CATEGORY = "all";
export const GLOBAL_SEARCH_RESULT_LIMIT = 8;
export const GLOBAL_SEARCH_QUICK_FILTER_LIMIT = 7;
export const GLOBAL_SEARCH_SUGGESTION_LIMIT = 6;

const MINIMUM_SUGGESTION_LENGTH = 2;
const FALLBACK_SUGGESTIONS = ["لابتوب", "صيانة لابتوب", "ترقية جهاز", "بطاقات", "ألعاب", "إكسسوارات"];

const SEARCH_SCORE = {
  titleExact: 120,
  titlePrefix: 72,
  titleIncludes: 52,
  categoryIncludes: 28,
  textIncludes: 18,
  tokenMatch: 12,
};

const SEARCH_TYPE_WEIGHT = {
  product: 12,
  service: 9,
  category: 6,
};

/**
 * Builds the unified list of searchable items across the public catalog.
 *
 * @param {{
 *   categories?: Array<Record<string, unknown>>,
 *   products?: Array<Record<string, unknown>>,
 *   services?: Array<Record<string, unknown>>,
 * }} input
 * @returns {Array<Record<string, unknown>>}
 */
export function buildGlobalSearchItems(input) {
  const categories = Array.isArray(input?.categories) ? input.categories : [];
  const products = Array.isArray(input?.products) ? input.products : [];
  const services = Array.isArray(input?.services) ? input.services : [];
  const categoryMap = Object.fromEntries(categories.map((category) => [category.id, category.name]));

  return [
    ...products.map((product) =>
      createGlobalSearchProductItem({
        product,
        categoryName: categoryMap[product.category_id] || DEFAULT_PRODUCT_CATEGORY,
      })
    ),
    ...services.map((service) => createGlobalSearchServiceItem(service)),
    ...categories.map((category) => createGlobalSearchCategoryItem(category)),
  ].filter((item) => Boolean(item?.href && item?.title));
}

/**
 * Builds the quick category chips shown above the search results.
 *
 * @param {Array<Record<string, unknown>>} items
 * @param {number} [limit=GLOBAL_SEARCH_QUICK_FILTER_LIMIT]
 * @returns {Array<{ label: string, value: string, count: number }>}
 */
export function buildGlobalSearchQuickFilters(items, limit = GLOBAL_SEARCH_QUICK_FILTER_LIMIT) {
  const counts = new Map();

  for (const item of Array.isArray(items) ? items : []) {
    const label = String(item?.categoryLabel || "").trim();
    const value = String(item?.categoryKey || "").trim();

    if (!label || !value) {
      continue;
    }

    counts.set(value, {
      label,
      value,
      count: (counts.get(value)?.count || 0) + 1,
    });
  }

  return [...counts.values()]
    .sort((first, second) => second.count - first.count || first.label.localeCompare(second.label, "ar"))
    .slice(0, limit);
}

/**
 * Builds the popular suggestion chips displayed before typing starts.
 *
 * @param {{
 *   items?: Array<Record<string, unknown>>,
 *   limit?: number,
 *   fallbackSuggestions?: string[],
 * }} input
 * @returns {string[]}
 */
export function buildGlobalSearchPopularSuggestions(input) {
  const limit = Number(input?.limit) > 0 ? Number(input.limit) : GLOBAL_SEARCH_SUGGESTION_LIMIT;
  const items = [...(Array.isArray(input?.items) ? input.items : [])];
  const suggestions = [];
  const seen = new Set();

  for (const item of items.sort((first, second) => second.priorityScore - first.priorityScore)) {
    for (const label of [item?.title, item?.categoryLabel]) {
      const suggestion = String(label || "").trim();
      if (suggestion.length < MINIMUM_SUGGESTION_LENGTH || seen.has(suggestion)) {
        continue;
      }

      seen.add(suggestion);
      suggestions.push(suggestion);
      if (suggestions.length >= limit) {
        return suggestions;
      }
    }
  }

  for (const suggestion of input?.fallbackSuggestions || FALLBACK_SUGGESTIONS) {
    if (!seen.has(suggestion)) {
      suggestions.push(suggestion);
    }
    if (suggestions.length >= limit) {
      break;
    }
  }

  return suggestions.slice(0, limit);
}

/**
 * Calculates the relevance score for one item against the current query.
 *
 * @param {{ item: Record<string, unknown>, query: string }} input
 * @returns {number}
 */
function getGlobalSearchScore({ item, query }) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return Number(item?.priorityScore || 0) + (SEARCH_TYPE_WEIGHT[item?.type] || 0);
  }

  const title = normalizeSearchText(item?.title);
  const categoryLabel = normalizeSearchText(item?.categoryLabel);
  const searchText = normalizeSearchText(item?.searchText);
  let score = Number(item?.priorityScore || 0) + (SEARCH_TYPE_WEIGHT[item?.type] || 0);

  if (title === normalizedQuery) score += SEARCH_SCORE.titleExact;
  if (title.startsWith(normalizedQuery)) score += SEARCH_SCORE.titlePrefix;
  if (title.includes(normalizedQuery)) score += SEARCH_SCORE.titleIncludes;
  if (categoryLabel.includes(normalizedQuery)) score += SEARCH_SCORE.categoryIncludes;
  if (searchText.includes(normalizedQuery)) score += SEARCH_SCORE.textIncludes;

  for (const token of normalizedQuery.split(" ").filter(Boolean)) {
    if (token.length >= MINIMUM_SUGGESTION_LENGTH && searchText.includes(token)) {
      score += SEARCH_SCORE.tokenMatch;
    }
  }

  return score;
}

/**
 * Filters and ranks the global search items according to the current UI state.
 *
 * @param {{
 *   items?: Array<Record<string, unknown>>,
 *   query?: string,
 *   categoryFilter?: string,
 *   limit?: number,
 * }} input
 * @returns {Array<Record<string, unknown>>}
 */
export function filterGlobalSearchItems(input) {
  const items = Array.isArray(input?.items) ? input.items : [];
  const query = normalizeSearchText(input?.query);
  const categoryFilter = normalizeSearchText(input?.categoryFilter);
  const limit = Number(input?.limit) > 0 ? Number(input.limit) : GLOBAL_SEARCH_RESULT_LIMIT;

  return items
    .filter((item) =>
      categoryFilter && categoryFilter !== GLOBAL_SEARCH_DEFAULT_CATEGORY
        ? normalizeSearchText(item?.categoryKey) === categoryFilter
        : true
    )
    .map((item) => ({ ...item, score: getGlobalSearchScore({ item, query }) }))
    .filter((item) => (query ? item.score > Number(item.priorityScore || 0) : true))
    .sort((first, second) => second.score - first.score || first.title.localeCompare(second.title, "ar"))
    .slice(0, limit);
}
