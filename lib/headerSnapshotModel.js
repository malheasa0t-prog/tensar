const ACTIVE_CATEGORY_STATUS = "active";
const ACCOUNT_LABEL = "حسابي";
const LOGIN_LABEL = "تسجيل الدخول";

/**
 * Extracts the preferred display name from auth metadata.
 *
 * @param {Record<string, unknown> | null | undefined} user
 * @returns {string}
 */
function getMetadataName(user) {
  const metadata = user?.user_metadata || {};
  return String(
    metadata.full_name ||
      metadata.name ||
      metadata.display_name ||
      ""
  ).trim();
}

/**
 * Determines whether a category should be shown in the header navigation.
 *
 * @param {{ category: Record<string, unknown>, navMap: Record<string, boolean> }} input
 * @returns {boolean}
 */
function isVisibleHeaderCategory({ category, navMap }) {
  const isActive =
    String(category?.status || ACTIVE_CATEGORY_STATUS).trim().toLowerCase() ===
    ACTIVE_CATEGORY_STATUS;
  const bySettings = Object.prototype.hasOwnProperty.call(navMap, category.id)
    ? navMap[category.id] !== false
    : true;
  const byCategory =
    category?.show_in_navbar !== false &&
    category?.show_in_nav !== false &&
    category?.showInNavbar !== false;

  return isActive && bySettings && byCategory;
}

/**
 * Builds the dynamic category links displayed in the public header.
 *
 * @param {{ categories: Array<Record<string, unknown>>, siteSettings: Record<string, unknown> }} input
 * @returns {Array<{ href: string, label: string, id: string, image: string }>}
 */
export function buildHeaderCategoryLinks({ categories, siteSettings }) {
  if (!Array.isArray(categories) || categories.length === 0) {
    return [];
  }

  const navMap = siteSettings?.categoryNavVisibility || {};

  return categories
    .filter((category) => isVisibleHeaderCategory({ category, navMap }))
    .map((category) => ({
      href: `/category/${category.slug || category.id}`,
      label: category.name,
      id: category.id,
      image: category.image || "",
    }));
}

/**
 * Resolves the current header account label from profile and auth data.
 *
 * @param {{ user: Record<string, unknown> | null, profileFullName?: string }} input
 * @returns {string}
 */
export function resolveHeaderUserLabel({ user, profileFullName = "" }) {
  if (!user) {
    return LOGIN_LABEL;
  }

  const fallbackName = user.email ? String(user.email).split("@")[0] : ACCOUNT_LABEL;
  return String(profileFullName || getMetadataName(user) || fallbackName).trim() || ACCOUNT_LABEL;
}
