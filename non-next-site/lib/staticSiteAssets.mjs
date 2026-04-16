const STATIC_SITEMAP_PATHS = Object.freeze([
  { changeFrequency: "daily", path: "/", priority: 1 },
  { changeFrequency: "daily", path: "/products", priority: 0.9 },
  { changeFrequency: "daily", path: "/accessories", priority: 0.8 },
  { changeFrequency: "weekly", path: "/services", priority: 0.8 },
  { changeFrequency: "weekly", path: "/subscriptions", priority: 0.7 },
  { changeFrequency: "monthly", path: "/contact", priority: 0.6 }
]);

const ROBOTS_DISALLOWED_PATHS = Object.freeze([
  "/admin",
  "/admin.html",
  "/auth",
  "/checkout",
  "/dashboard",
  "/deposit"
]);

/**
 * Escapes one XML string fragment.
 *
 * @param {string} value
 * @returns {string}
 */
function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

/**
 * Ensures one site origin is present and normalized.
 *
 * @param {string} siteOrigin
 * @returns {string}
 * @throws {Error}
 */
function normalizeSiteOrigin(siteOrigin) {
  const normalizedOrigin = String(siteOrigin || "").trim().replace(/\/+$/, "");

  if (!normalizedOrigin) {
    throw new Error("SITE_URL or NEXT_PUBLIC_SITE_URL is required.");
  }

  return normalizedOrigin;
}

/**
 * Builds static sitemap entries for public routes.
 *
 * @param {string} siteOrigin
 * @returns {Array<{ changeFrequency: string, priority: number, url: string }>}
 */
export function getStaticSitemapEntries(siteOrigin) {
  const normalizedOrigin = normalizeSiteOrigin(siteOrigin);
  return STATIC_SITEMAP_PATHS.map((entry) => ({
    changeFrequency: entry.changeFrequency,
    priority: entry.priority,
    url: `${normalizedOrigin}${entry.path}`
  }));
}

/**
 * Builds the production robots.txt content.
 *
 * @param {string} siteOrigin
 * @returns {string}
 */
export function buildRobotsContent(siteOrigin) {
  const normalizedOrigin = normalizeSiteOrigin(siteOrigin);
  const lines = [
    "User-agent: *",
    "Allow: /",
    ...ROBOTS_DISALLOWED_PATHS.map((path) => `Disallow: ${path}`),
    `Host: ${normalizedOrigin}`,
    `Sitemap: ${normalizedOrigin}/sitemap.xml`
  ];

  return `${lines.join("\n")}\n`;
}

/**
 * Builds one XML sitemap document.
 *
 * @param {Array<{ changeFrequency?: string, lastModified?: string, priority?: number, url: string }>} entries
 * @returns {string}
 * @throws {Error}
 */
export function buildSitemapContent(entries) {
  if (!Array.isArray(entries)) {
    throw new Error("Sitemap entries must be an array.");
  }

  const urlNodes = entries.map((entry) => {
    const nodeLines = [`    <loc>${escapeXml(entry.url)}</loc>`];

    if (entry.lastModified) {
      nodeLines.push(`    <lastmod>${escapeXml(entry.lastModified)}</lastmod>`);
    }

    if (entry.changeFrequency) {
      nodeLines.push(`    <changefreq>${escapeXml(entry.changeFrequency)}</changefreq>`);
    }

    if (typeof entry.priority === "number") {
      nodeLines.push(`    <priority>${entry.priority.toFixed(1)}</priority>`);
    }

    return `  <url>\n${nodeLines.join("\n")}\n  </url>`;
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urlNodes,
    "</urlset>",
    ""
  ].join("\n");
}

/**
 * Builds a static admin config payload for legacy admin bootstrap.
 *
 * @param {{ supabaseAnonKey: string, supabaseUrl: string, writeEnabled: boolean }} config
 * @returns {string}
 * @throws {Error}
 */
export function buildAdminConfigContent(config) {
  const supabaseUrl = String(config?.supabaseUrl || "").trim();
  const supabaseAnonKey = String(config?.supabaseAnonKey || "").trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase public admin config is incomplete.");
  }

  return [
    `window.__TZ_SUPABASE_URL = ${JSON.stringify(supabaseUrl)};`,
    `window.__TZ_SUPABASE_ANON_KEY = ${JSON.stringify(supabaseAnonKey)};`,
    `window.__TZ_SUPABASE_PUBLISHABLE_KEY = ${JSON.stringify(supabaseAnonKey)};`,
    `window.__TZ_LEGACY_ADMIN_WRITE_ENABLED = ${config?.writeEnabled === true};`,
    ""
  ].join("\n");
}

/**
 * Builds the redirects file required by SPA hosting on static platforms.
 *
 * @returns {string}
 */
export function buildRedirectsContent() {
  return ["/admin /admin.html 200", "/* /index.html 200", ""].join("\n");
}
