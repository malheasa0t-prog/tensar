import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

import {
  buildAdminConfigContent,
  buildRedirectsContent,
  buildRobotsContent,
  buildSitemapContent,
  getStaticSitemapEntries
} from "../lib/staticSiteAssets.mjs";

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const projectDir = path.resolve(currentDir, "..");
const distDir = path.resolve(projectDir, "dist");

/**
 * Reads one local env file when present.
 *
 * @param {string} envFilePath
 * @returns {Promise<Record<string, string>>}
 */
async function readEnvFile(envFilePath) {
  try {
    const fileContent = await fs.readFile(envFilePath, "utf8");
    return fileContent.split(/\r?\n/).reduce((envMap, line) => {
      const trimmedLine = line.trim();

      if (!trimmedLine || trimmedLine.startsWith("#") || !trimmedLine.includes("=")) {
        return envMap;
      }

      const separatorIndex = trimmedLine.indexOf("=");
      const key = trimmedLine.slice(0, separatorIndex).trim();
      const value = trimmedLine.slice(separatorIndex + 1).trim();

      if (key) {
        envMap[key] = value;
      }

      return envMap;
    }, {});
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return {};
    }

    throw error;
  }
}

/**
 * Loads the merged build environment.
 *
 * @returns {Promise<Record<string, string | undefined>>}
 */
async function loadBuildEnv() {
  const envFileValues = await readEnvFile(path.resolve(projectDir, ".env"));
  return { ...envFileValues, ...process.env };
}

/**
 * Reads one required environment variable.
 *
 * @param {Record<string, string | undefined>} env
 * @param {string[]} names
 * @returns {string}
 * @throws {Error}
 */
function readRequiredEnv(env, names) {
  const value = names.map((name) => String(env[name] || "").trim()).find(Boolean);

  if (!value) {
    throw new Error(`Missing required environment value: ${names.join(" or ")}`);
  }

  return value;
}

/**
 * Writes one UTF-8 file into the build output.
 *
 * @param {string} filePath
 * @param {string} content
 * @returns {Promise<void>}
 */
async function writeUtf8File(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
}

/**
 * Queries one active public table from Supabase.
 *
 * @param {ReturnType<typeof createClient>} supabaseClient
 * @param {string} tableName
 * @param {string} selectedColumns
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
async function queryActiveRows(supabaseClient, tableName, selectedColumns) {
  const { data, error } = await supabaseClient
    .from(tableName)
    .select(selectedColumns)
    .eq("status", "active");

  if (error) {
    throw new Error(`Failed to load sitemap data from ${tableName}: ${error.message}`);
  }

  return Array.isArray(data) ? data : [];
}

/**
 * Converts one dynamic route path into a sitemap entry.
 *
 * @param {string} siteOrigin
 * @param {string} routePath
 * @param {string | undefined} lastModified
 * @returns {{ lastModified?: string, url: string }}
 */
function createSitemapEntry(siteOrigin, routePath, lastModified) {
  return {
    lastModified: lastModified || undefined,
    url: `${siteOrigin}${routePath}`
  };
}

/**
 * Loads the dynamic sitemap entries from Supabase public tables.
 *
 * @param {Record<string, string | undefined>} env
 * @param {string} siteOrigin
 * @returns {Promise<Array<{ lastModified?: string, url: string }>>}
 */
async function loadDynamicSitemapEntries(env, siteOrigin) {
  const supabaseUrl = readRequiredEnv(env, ["NEXT_PUBLIC_SUPABASE_URL"]);
  const supabaseAnonKey = readRequiredEnv(env, [
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  ]);
  const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  const [categories, products, services] = await Promise.all([
    queryActiveRows(supabaseClient, "categories", "id,slug,updated_at"),
    queryActiveRows(supabaseClient, "products", "id,updated_at"),
    queryActiveRows(supabaseClient, "repair_services", "id,updated_at")
  ]);

  return [
    ...categories.map((category) =>
      createSitemapEntry(siteOrigin, `/category/${category.slug || category.id}`, category.updated_at)
    ),
    ...products.map((product) =>
      createSitemapEntry(siteOrigin, `/products/${product.id}`, product.updated_at)
    ),
    ...services.map((service) =>
      createSitemapEntry(siteOrigin, `/services/${service.id}`, service.updated_at)
    )
  ];
}

/**
 * Generates the deploy-time static assets required by the non-Next site.
 *
 * @returns {Promise<void>}
 */
async function generateStaticAssets() {
  const env = await loadBuildEnv();
  const siteOrigin = readRequiredEnv(env, ["SITE_URL", "NEXT_PUBLIC_SITE_URL"]).replace(/\/+$/, "");
  const supabaseUrl = readRequiredEnv(env, ["NEXT_PUBLIC_SUPABASE_URL"]);
  const supabaseAnonKey = readRequiredEnv(env, [
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  ]);
  const writeEnabled = String(env.ENABLE_LEGACY_ADMIN_WRITE || "").trim().toLowerCase() === "true";
  const sitemapEntries = [
    ...getStaticSitemapEntries(siteOrigin),
    ...(await loadDynamicSitemapEntries(env, siteOrigin))
  ];

  await Promise.all([
    writeUtf8File(
      path.resolve(distDir, "admin-config.js"),
      buildAdminConfigContent({ supabaseAnonKey, supabaseUrl, writeEnabled })
    ),
    writeUtf8File(path.resolve(distDir, "robots.txt"), buildRobotsContent(siteOrigin)),
    writeUtf8File(path.resolve(distDir, "sitemap.xml"), buildSitemapContent(sitemapEntries)),
    writeUtf8File(path.resolve(distDir, "_redirects"), buildRedirectsContent())
  ]);
}

await generateStaticAssets();
