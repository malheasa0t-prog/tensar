/**
 * Configuration helpers for the post-deployment security checks.
 */

const DEFAULT_ADMIN_PATHS = Object.freeze(["/admin", "/admin.html"]);
const DEFAULT_RATE_LIMIT_ATTEMPTS = 6;
const DEFAULT_RATE_LIMIT_BODY = Object.freeze({ items: [] });
const DEFAULT_RATE_LIMIT_METHOD = "POST";
const DEFAULT_RATE_LIMIT_PATH = "/api/checkout";
const DEFAULT_TIMEOUT_MS = 10_000;
const WAF_PROBE_ORIGIN = "https://security-check.invalid";

/**
 * Normalizes the live base URL used by all probes.
 *
 * @param {{ rawUrl?: string }} input - Raw environment or CLI input.
 * @returns {string} Canonical base URL without a trailing slash.
 * @throws {TypeError} When the URL is missing or invalid.
 */
function normalizeBaseUrl(input) {
  const rawUrl = String(input?.rawUrl || "").trim();
  if (!rawUrl) throw new TypeError("TARGET_BASE_URL is required.");

  const url = new URL(rawUrl);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new TypeError("TARGET_BASE_URL must use http:// or https://.");
  }

  url.hash = "";
  url.search = "";
  return url.toString().replace(/\/$/, "");
}

/**
 * Parses a comma-separated list while preserving a default fallback.
 *
 * @param {{ fallback: string[], rawValue?: string }} input - Raw env value.
 * @returns {string[]} Normalized list of non-empty paths.
 */
function parseCsvList(input) {
  const rawValue = String(input?.rawValue || "").trim();
  if (!rawValue) return [...input.fallback];

  return rawValue
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

/**
 * Parses a bounded positive integer from one environment value.
 *
 * @param {{ fallback: number, max?: number, min?: number, rawValue?: string }} input
 * @returns {number} Sanitized integer inside the configured bounds.
 */
function parsePositiveInteger(input) {
  const min = Number.isInteger(input?.min) ? input.min : 1;
  const max = Number.isInteger(input?.max) ? input.max : 20;
  const parsed = Number.parseInt(String(input?.rawValue || ""), 10);
  if (!Number.isInteger(parsed)) return input.fallback;
  return Math.min(max, Math.max(min, parsed));
}

/**
 * Parses a JSON object used by the rate-limit probe.
 *
 * @param {{ fallback: Record<string, unknown>, rawValue?: string }} input
 * @returns {Record<string, unknown>} Parsed JSON object.
 * @throws {TypeError} When the value is not a JSON object.
 */
function parseJsonObject(input) {
  const rawValue = String(input?.rawValue || "").trim();
  if (!rawValue) return { ...input.fallback };

  const parsed = JSON.parse(rawValue);
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new TypeError("TARGET_RATE_LIMIT_BODY must be a JSON object.");
  }

  return parsed;
}

/**
 * Builds the immutable runtime configuration for the live probes.
 *
 * @param {{ env?: NodeJS.ProcessEnv }} [input] - Optional environment source.
 * @returns {object} Parsed configuration used by the CLI and CI workflow.
 * @throws {TypeError} When required values are missing or malformed.
 */
function buildPostdeployCheckConfig(input = {}) {
  const env = input.env || process.env;
  return Object.freeze({
    adminPaths: parseCsvList({
      fallback: DEFAULT_ADMIN_PATHS,
      rawValue: env.TARGET_ADMIN_PATHS,
    }),
    baseUrl: normalizeBaseUrl({ rawUrl: env.TARGET_BASE_URL }),
    failOnWarnings: env.POSTDEPLOY_FAIL_ON_WARNINGS === "true",
    probeOrigin: String(env.TARGET_PROBE_ORIGIN || WAF_PROBE_ORIGIN).trim(),
    rateLimitAttempts: parsePositiveInteger({
      fallback: DEFAULT_RATE_LIMIT_ATTEMPTS,
      max: 20,
      rawValue: env.TARGET_RATE_LIMIT_ATTEMPTS,
    }),
    rateLimitBody: parseJsonObject({
      fallback: DEFAULT_RATE_LIMIT_BODY,
      rawValue: env.TARGET_RATE_LIMIT_BODY,
    }),
    rateLimitMethod: String(env.TARGET_RATE_LIMIT_METHOD || DEFAULT_RATE_LIMIT_METHOD)
      .trim()
      .toUpperCase(),
    rateLimitPath: String(env.TARGET_RATE_LIMIT_PATH || DEFAULT_RATE_LIMIT_PATH).trim(),
    signedDepositProofUrl: String(env.TARGET_SIGNED_DEPOSIT_PROOF_URL || "").trim(),
    timeoutMs: parsePositiveInteger({
      fallback: DEFAULT_TIMEOUT_MS,
      max: 30_000,
      min: 1_000,
      rawValue: env.TARGET_REQUEST_TIMEOUT_MS,
    }),
  });
}

export {
  DEFAULT_ADMIN_PATHS,
  DEFAULT_RATE_LIMIT_ATTEMPTS,
  buildPostdeployCheckConfig,
  normalizeBaseUrl,
};
