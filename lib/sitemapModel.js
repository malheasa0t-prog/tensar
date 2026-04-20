/**
 * Pure helpers for building sitemap entries and XML output.
 */

const DEFAULT_CHANGE_FREQUENCY = "weekly";
const DEFAULT_PRIORITY = 0.7;

/**
 * Escapes XML special characters in text values.
 *
 * @param {unknown} value
 * @returns {string}
 */
function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Normalizes route paths before joining them to the site origin.
 *
 * @param {string} pathname
 * @returns {string}
 */
function normalizePathname(pathname) {
  const candidate = String(pathname || "").trim();
  if (!candidate) return "/";
  return candidate.startsWith("/") ? candidate : `/${candidate}`;
}

/**
 * Normalizes date-like input into ISO-8601 strings.
 *
 * @param {unknown} value
 * @returns {string}
 */
function normalizeIsoDate(value) {
  const timestamp = new Date(value || "");
  return Number.isNaN(timestamp.getTime()) ? "" : timestamp.toISOString();
}

/**
 * Builds a sitemap entry with an absolute URL.
 *
 * @param {{
 *   origin: string,
 *   pathname: string,
 *   lastModified?: string,
 *   changeFrequency?: string,
 *   priority?: number,
 * }} input
 * @returns {Record<string, string>}
 */
export function buildSitemapEntry({
  origin,
  pathname,
  lastModified = "",
  changeFrequency = DEFAULT_CHANGE_FREQUENCY,
  priority = DEFAULT_PRIORITY,
}) {
  const absoluteUrl = new URL(normalizePathname(pathname), `${origin}/`).toString();
  const normalizedPriority = Number.isFinite(Number(priority))
    ? Number(priority).toFixed(1)
    : DEFAULT_PRIORITY.toFixed(1);

  return {
    loc: absoluteUrl,
    lastmod: normalizeIsoDate(lastModified),
    changefreq: String(changeFrequency || DEFAULT_CHANGE_FREQUENCY).trim() || DEFAULT_CHANGE_FREQUENCY,
    priority: normalizedPriority,
  };
}

/**
 * Renders a complete XML sitemap payload.
 *
 * @param {Array<Record<string, string>>} entries
 * @returns {string}
 */
export function renderSitemapXml(entries = []) {
  const urlEntries = Array.isArray(entries) ? entries.filter(Boolean) : [];
  const body = urlEntries
    .map((entry) => {
      const lastmod = entry.lastmod ? `<lastmod>${escapeXml(entry.lastmod)}</lastmod>` : "";
      return [
        "<url>",
        `<loc>${escapeXml(entry.loc)}</loc>`,
        lastmod,
        `<changefreq>${escapeXml(entry.changefreq)}</changefreq>`,
        `<priority>${escapeXml(entry.priority)}</priority>`,
        "</url>",
      ].join("");
    })
    .join("");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    body,
    "</urlset>",
  ].join("");
}
