/**
 * Legacy admin runtime asset helpers for Vite dev/build flows.
 */

import { getMissingAdminRuntimeConfigKeys } from "./adminRuntimeConfig.js";

/**
 * Resolves the public config required by the legacy admin static shell.
 *
 * @param {Record<string, string | undefined> | undefined} env - Source environment values.
 * @param {string} command - The active Vite command such as `build` or `serve`.
 * @returns {{ supabasePublishableKey: string, supabaseUrl: string, writeEnabled: boolean }}
 * @throws {Error} When a production build is missing required public keys.
 */
export function resolveAdminRuntimeAssetConfig(env, command) {
  const missingKeys = getMissingAdminRuntimeConfigKeys(env);
  const supabaseUrl = String(env?.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const publishableKeyCandidate = env?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env?.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabasePublishableKey = String(publishableKeyCandidate ?? "").trim();

  if (command === "build" && missingKeys.length > 0) {
    throw new Error(
      `[BST-305] Missing required public environment variables for legacy admin asset: ${missingKeys.join(", ")}`
    );
  }

  return {
    supabasePublishableKey,
    supabaseUrl,
    writeEnabled: false,
  };
}

/**
 * Serializes the legacy admin config into a browser-executable asset.
 *
 * @param {{ supabasePublishableKey?: string, supabaseUrl?: string, writeEnabled?: boolean }} config - Normalized public config.
 * @returns {string} JavaScript source for `/admin-config.js`.
 */
export function buildAdminRuntimeAssetSource(config) {
  return [
    "window.__TZ_LEGACY_ADMIN_OPEN_ACCESS = false;",
    `window.__TZ_SUPABASE_URL = ${JSON.stringify(String(config?.supabaseUrl ?? "").trim())};`,
    `window.__TZ_SUPABASE_PUBLISHABLE_KEY = ${JSON.stringify(
      String(config?.supabasePublishableKey ?? "").trim()
    )};`,
    `window.__TZ_SUPABASE_ANON_KEY = ${JSON.stringify(String(config?.supabasePublishableKey ?? "").trim())};`,
    `window.__TZ_LEGACY_ADMIN_WRITE_ENABLED = ${config?.writeEnabled === true ? "true" : "false"};`,
  ].join("\n");
}
