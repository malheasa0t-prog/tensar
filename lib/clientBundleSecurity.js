/**
 * Client bundle security helpers for Vite.
 *
 * Detects server-only Supabase modules and sensitive token references
 * before they ship inside the browser bundle.
 */

export const CLIENT_SECURITY_LEAK_CHUNK = "__server_only_leak__";

const FORBIDDEN_CLIENT_MODULE_SUFFIXES = Object.freeze([
  "/lib/supabaseServer.js",
]);

const FORBIDDEN_CLIENT_CODE_TOKENS = Object.freeze([
  "SUPABASE_SERVICE_ROLE_KEY",
]);

/**
 * Normalizes a module identifier into a stable slash-based path.
 *
 * @param {unknown} moduleId
 * @returns {string}
 */
export function normalizeClientModuleId(moduleId) {
  return String(moduleId || "").split("?")[0].replace(/\\/g, "/");
}

/**
 * Determines whether a module must never appear in the client bundle.
 *
 * @param {unknown} moduleId
 * @returns {boolean}
 */
export function isForbiddenClientModuleId(moduleId) {
  const normalizedModuleId = normalizeClientModuleId(moduleId);
  return FORBIDDEN_CLIENT_MODULE_SUFFIXES.some((suffix) =>
    normalizedModuleId.endsWith(suffix)
  );
}

/**
 * Routes forbidden client modules into a dedicated chunk for leak detection,
 * and splits large vendor libraries into separate chunks for better caching.
 *
 * @param {unknown} moduleId
 * @returns {string | null}
 */
export function resolveClientSecurityManualChunk(moduleId) {
  if (isForbiddenClientModuleId(moduleId)) {
    return CLIENT_SECURITY_LEAK_CHUNK;
  }

  const normalizedId = normalizeClientModuleId(moduleId);

  if (normalizedId.includes("node_modules/@supabase")) {
    return "vendor-supabase";
  }
  if (normalizedId.includes("node_modules/react-dom")) {
    return "vendor-react-dom";
  }
  if (normalizedId.includes("node_modules/react")) {
    return "vendor-react";
  }
  if (normalizedId.includes("node_modules/lucide")) {
    return "vendor-icons";
  }
  if (normalizedId.includes("node_modules/react-router")) {
    return "vendor-router";
  }

  return null;
}

/**
 * Collects forbidden module ids from a generated Rollup chunk.
 *
 * @param {{ modules?: Record<string, unknown> }} output
 * @returns {string[]}
 */
function collectChunkModuleLeaks(output) {
  return Object.keys(output.modules || {})
    .map(normalizeClientModuleId)
    .filter((moduleId) => isForbiddenClientModuleId(moduleId));
}

/**
 * Collects sensitive token markers from emitted chunk code.
 *
 * @param {{ code?: string }} output
 * @returns {string[]}
 */
function collectChunkTokenLeaks(output) {
  const chunkCode = String(output.code || "");
  return FORBIDDEN_CLIENT_CODE_TOKENS.filter((token) => chunkCode.includes(token));
}

/**
 * Scans a Rollup bundle for server-only module leaks.
 *
 * @param {Record<string, { type?: string, code?: string, modules?: Record<string, unknown> }>} bundle
 * @returns {Array<{ fileName: string, category: "module" | "token", values: string[] }>}
 */
export function findClientBundleSecurityLeaks(bundle) {
  const leaks = [];

  for (const [fileName, output] of Object.entries(bundle || {})) {
    if (output?.type !== "chunk") {
      continue;
    }

    const moduleLeaks = collectChunkModuleLeaks(output);
    if (moduleLeaks.length > 0) {
      leaks.push({ fileName, category: "module", values: moduleLeaks });
    }

    const tokenLeaks = collectChunkTokenLeaks(output);
    if (tokenLeaks.length > 0) {
      leaks.push({ fileName, category: "token", values: tokenLeaks });
    }
  }

  return leaks;
}

/**
 * Formats a readable Vite build error for client bundle security leaks.
 *
 * @param {Array<{ fileName: string, category: "module" | "token", values: string[] }>} leaks
 * @returns {string}
 */
export function formatClientBundleSecurityLeakError(leaks) {
  const details = (Array.isArray(leaks) ? leaks : [])
    .map((leak) => {
      const label =
        leak.category === "token" ? "sensitive token reference" : "server-only module";
      return `${leak.fileName} -> ${label}: ${leak.values.join(", ")}`;
    })
    .join(" | ");

  return `[VCS-401] Client bundle leak detected. Remove server-only Supabase imports from browser-reachable code. ${details}`;
}

/**
 * Creates a Vite plugin that fails builds when forbidden modules reach the client bundle.
 *
 * @returns {import('vite').Plugin}
 */
export function createClientBundleLeakGuardPlugin() {
  return {
    name: "client-bundle-leak-guard",
    generateBundle(_options, bundle) {
      const leaks = findClientBundleSecurityLeaks(bundle);
      if (leaks.length > 0) {
        this.error(formatClientBundleSecurityLeakError(leaks));
      }
    },
  };
}
