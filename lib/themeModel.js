export const SITE_THEME_STORAGE_KEY = "tz_theme";
export const SITE_THEME_DEFAULT = "techfix";
export const SITE_THEME_LIGHT = "light";

/**
 * Resolves the supported public site theme identifier.
 *
 * @param {unknown} value
 * @returns {"techfix" | "light"}
 */
export function normalizeThemeValue(value) {
  return String(value || "").trim().toLowerCase() === SITE_THEME_LIGHT ? SITE_THEME_LIGHT : SITE_THEME_DEFAULT;
}

/**
 * Resolves the initial theme using the stored preference first, then the system preference.
 *
 * @param {{ prefersLight?: boolean, storedTheme?: unknown }} options
 * @returns {"techfix" | "light"}
 */
export function resolveInitialThemeValue(options = {}) {
  if (String(options.storedTheme || "").trim()) {
    return normalizeThemeValue(options.storedTheme);
  }

  return options.prefersLight ? SITE_THEME_LIGHT : SITE_THEME_DEFAULT;
}

/**
 * Returns the next theme in the simple light/dark toggle cycle.
 *
 * @param {unknown} value
 * @returns {"techfix" | "light"}
 */
export function toggleThemeValue(value) {
  return normalizeThemeValue(value) === SITE_THEME_LIGHT ? SITE_THEME_DEFAULT : SITE_THEME_LIGHT;
}

/**
 * Provides the user-facing theme label used inside compact UI controls.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function getThemeLabel(value) {
  return normalizeThemeValue(value) === SITE_THEME_LIGHT ? "الوضع الفاتح" : "الوضع الداكن";
}
