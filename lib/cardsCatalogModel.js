/**
 * Shared cards-catalog helpers for grouping categories and services.
 */

import { slugifyArabic } from "./categoryPageModel.js";

/**
 * Normalizes one identifier-like value for stable comparisons.
 *
 * @param {unknown} value
 * @returns {string}
 */
function normalizeKey(value) {
  return String(value || "").trim();
}

/**
 * Resolves the storefront route segment used for one cards category.
 *
 * @param {Record<string, unknown> | null | undefined} category
 * @returns {string}
 */
export function resolveCardsCategoryRouteSegment(category) {
  const explicitSlug = normalizeKey(category?.slug);
  if (explicitSlug) {
    return explicitSlug;
  }

  const generatedSlug = slugifyArabic(normalizeKey(category?.name));
  if (generatedSlug) {
    return generatedSlug;
  }

  return normalizeKey(category?.id);
}

/**
 * Returns the direct child categories for one parent id.
 *
 * @param {{ categories?: Array<Record<string, unknown>>, parentId?: unknown }} input
 * @returns {Array<Record<string, unknown>>}
 */
export function getDirectChildCategories({ categories, parentId }) {
  const parentKey = normalizeKey(parentId);

  return (Array.isArray(categories) ? categories : [])
    .filter((category) => normalizeKey(category.parent_id) === parentKey)
    .sort((first, second) => Number(first.sort_order || 0) - Number(second.sort_order || 0));
}

/**
 * Resolves the category row matching a route id or slug.
 *
 * @param {{ categories?: Array<Record<string, unknown>>, routeValue?: unknown }} input
 * @returns {Record<string, unknown> | null}
 */
export function findCardsCategoryByRoute({ categories, routeValue }) {
  const normalizedRoute = normalizeKey(routeValue);
  if (!normalizedRoute) return null;

  const normalizedSlug = slugifyArabic(normalizedRoute);
  return (Array.isArray(categories) ? categories : []).find((category) => (
    normalizeKey(category.id) === normalizedRoute
    || resolveCardsCategoryRouteSegment(category) === normalizedSlug
  )) || null;
}

/**
 * Builds a root-category list that actually has active catalog services.
 *
 * @param {{ categories?: Array<Record<string, unknown>>, services?: Array<Record<string, unknown>> }} input
 * @returns {Array<Record<string, unknown> & { serviceCount: number }>}
 */
export function buildCardsRootCategories({ categories, services }) {
  const allCategories = Array.isArray(categories) ? categories : [];
  const activeServices = Array.isArray(services) ? services : [];
  const serviceCountByRoot = countServicesByRoot({ categories: allCategories, services: activeServices });

  return allCategories
    .filter((category) => !normalizeKey(category.parent_id))
    .filter((category) => category.show_in_navbar !== false && category.showInNavbar !== false)
    .filter((category) => Number(serviceCountByRoot[category.id] || 0) > 0)
    .sort((first, second) => Number(first.sort_order || 0) - Number(second.sort_order || 0))
    .map((category) => ({
      ...category,
      serviceCount: Number(serviceCountByRoot[category.id] || 0),
    }));
}

/**
 * Counts active services under each root category including subcategories.
 *
 * @param {{ categories?: Array<Record<string, unknown>>, services?: Array<Record<string, unknown>> }} input
 * @returns {Record<string, number>}
 */
export function countServicesByRoot({ categories, services }) {
  const rootsByChild = new Map();
  const counts = {};
  const allCategories = Array.isArray(categories) ? categories : [];

  allCategories.forEach((category) => {
    const root = resolveRootCategory({ categories: allCategories, categoryId: category.id });
    if (root) {
      rootsByChild.set(normalizeKey(category.id), normalizeKey(root.id));
    }
  });

  (Array.isArray(services) ? services : []).forEach((service) => {
    const rootId = rootsByChild.get(normalizeKey(service.subcategory_id))
      || rootsByChild.get(normalizeKey(service.category_id))
      || normalizeKey(service.category_id);
    if (!rootId) return;
    counts[rootId] = Number(counts[rootId] || 0) + 1;
  });

  return counts;
}

/**
 * Counts active services per direct subcategory for one root category.
 *
 * @param {{ rootId?: unknown, services?: Array<Record<string, unknown>>, subCategories?: Array<Record<string, unknown>> }} input
 * @returns {Record<string, number>}
 */
export function countServicesBySubcategory({ rootId, services, subCategories }) {
  const counts = {};
  const rootKey = normalizeKey(rootId);

  (Array.isArray(subCategories) ? subCategories : []).forEach((subCategory) => {
    counts[subCategory.id] = 0;
  });

  (Array.isArray(services) ? services : []).forEach((service) => {
    if (normalizeKey(service.category_id) !== rootKey) return;

    const subKey = normalizeKey(service.subcategory_id);
    if (subKey && Object.prototype.hasOwnProperty.call(counts, subKey)) {
      counts[subKey] += 1;
    }
  });

  return counts;
}

/**
 * Filters visible services for one root/subcategory selection.
 *
 * @param {{ rootId?: unknown, services?: Array<Record<string, unknown>>, subCategoryId?: unknown }} input
 * @returns {Array<Record<string, unknown>>}
 */
export function getCardsServicesForSelection({ rootId, services, subCategoryId }) {
  const rootKey = normalizeKey(rootId);
  const subKey = normalizeKey(subCategoryId);

  return (Array.isArray(services) ? services : [])
    .filter((service) => normalizeKey(service.category_id) === rootKey)
    .filter((service) => {
      if (!subKey) return !normalizeKey(service.subcategory_id);
      return normalizeKey(service.subcategory_id) === subKey;
    })
    .sort((first, second) => {
      return Number(first.sort_order || 0) - Number(second.sort_order || 0)
        || String(first.name || "").localeCompare(String(second.name || ""), "ar");
    });
}

/**
 * Returns the selected subcategory id once the page snapshot is available.
 *
 * @param {{ requestedSubId?: unknown, services?: Array<Record<string, unknown>>, subCategories?: Array<Record<string, unknown>> }} input
 * @returns {string}
 */
export function resolveCardsSubcategorySelection({ requestedSubId, services, subCategories }) {
  const requestedKey = normalizeKey(requestedSubId);
  const availableSubCategories = Array.isArray(subCategories) ? subCategories : [];

  if (requestedKey && availableSubCategories.some((category) => normalizeKey(category.id) === requestedKey)) {
    return requestedKey;
  }

  const firstSubcategory = availableSubCategories.find((category) => (
    (Array.isArray(services) ? services : []).some((service) => normalizeKey(service.subcategory_id) === normalizeKey(category.id))
  ));

  return normalizeKey(firstSubcategory?.id);
}

/**
 * Resolves the root category containing one category id.
 *
 * @param {{ categories?: Array<Record<string, unknown>>, categoryId?: unknown }} input
 * @returns {Record<string, unknown> | null}
 */
function resolveRootCategory({ categories, categoryId }) {
  const allCategories = Array.isArray(categories) ? categories : [];
  const byId = new Map(allCategories.map((category) => [normalizeKey(category.id), category]));
  let current = byId.get(normalizeKey(categoryId)) || null;
  const seen = new Set();

  while (current && normalizeKey(current.parent_id) && !seen.has(normalizeKey(current.id))) {
    seen.add(normalizeKey(current.id));
    current = byId.get(normalizeKey(current.parent_id)) || current;
    if (!normalizeKey(current.parent_id)) break;
  }

  return current;
}
