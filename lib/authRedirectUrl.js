/**
 * Auth redirect URL helpers for Supabase browser flows.
 */

export const AUTH_CALLBACK_PATH = "/auth/callback/";
export const PASSWORD_RECOVERY_PATH = "/auth/recover";

const TRAILING_SLASH_PATTERN = /\/+$/;
const URL_PROTOCOL_PATTERN = /^https?:\/\//i;
const FALLBACK_SITE_URL = "https://tensr.systems";
const DEFAULT_CONFIGURED_SITE_URL =
  import.meta.env?.NEXT_PUBLIC_SITE_URL ||
  (typeof process !== "undefined" && process?.env ? process.env.NEXT_PUBLIC_SITE_URL : "") ||
  FALLBACK_SITE_URL;
const hasOwn = Object.prototype.hasOwnProperty;

/**
 * Resolves the origin that Supabase should return to after auth flows.
 *
 * @param {{ configuredSiteUrl?: unknown, browserOrigin?: unknown }} [input]
 * @returns {string}
 */
export function resolveAuthRedirectOrigin(input = {}) {
  const configuredSiteUrl = hasOwn.call(input, "configuredSiteUrl")
    ? input.configuredSiteUrl
    : DEFAULT_CONFIGURED_SITE_URL;
  const browserOrigin = hasOwn.call(input, "browserOrigin")
    ? input.browserOrigin
    : typeof window !== "undefined"
      ? window.location?.origin
      : "";

  for (const value of [configuredSiteUrl, browserOrigin]) {
    const rawValue = String(value || "").trim().replace(TRAILING_SLASH_PATTERN, "");
    const candidate = URL_PROTOCOL_PATTERN.test(rawValue) ? rawValue : `https://${rawValue}`;

    if (!rawValue || (typeof URL.canParse === "function" && !URL.canParse(candidate))) {
      continue;
    }

    try {
      return new URL(candidate).origin;
    } catch (error) {
      if (error instanceof TypeError) continue;
      throw error;
    }
  }

  return "";
}

/**
 * Builds an absolute auth redirect URL for a site-owned path.
 *
 * @param {{ path?: unknown, configuredSiteUrl?: unknown, browserOrigin?: unknown }} [input]
 * @returns {string}
 */
export function buildAuthRedirectUrl(input = {}) {
  const origin = resolveAuthRedirectOrigin(input);
  const rawPath = String(input.path || "/").trim();
  const normalizedPath = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;

  if (!origin) {
    return normalizedPath;
  }

  return new URL(normalizedPath, `${origin}/`).toString();
}

/**
 * Builds the Supabase callback URL for sign-in and sign-up flows.
 *
 * @param {{ configuredSiteUrl?: unknown, browserOrigin?: unknown }} [input]
 * @returns {string}
 */
export function buildAuthCallbackRedirectUrl(input = {}) {
  return buildAuthRedirectUrl({ ...input, path: AUTH_CALLBACK_PATH });
}

/**
 * Builds the Supabase callback URL for password recovery emails.
 *
 * @param {{ configuredSiteUrl?: unknown, browserOrigin?: unknown }} [input]
 * @returns {string}
 */
export function buildPasswordRecoveryRedirectUrl(input = {}) {
  return buildAuthRedirectUrl({ ...input, path: PASSWORD_RECOVERY_PATH });
}
