/**
 * Redirect helpers for misplaced Supabase OAuth hash callbacks.
 */

import { AUTH_CALLBACK_PATH, buildAuthRedirectUrl } from "./authRedirectUrl.js";

const AUTH_CALLBACK_ROUTE = AUTH_CALLBACK_PATH.replace(/\/+$/, "");
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost"]);
const SUPABASE_HASH_KEYS = Object.freeze([
  "access_token",
  "refresh_token",
  "error",
  "error_code",
  "error_description",
]);
const SUPABASE_HASH_TYPES = new Set(["invite", "magiclink", "recovery", "signup"]);
const AUTH_PATH_PATTERN = /^\/auth(?:\/|$)/;

/**
 * Detects Supabase auth data inside a URL hash fragment.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isSupabaseAuthHash(value) {
  const hash = String(value || "").trim();

  if (!hash.startsWith("#") || hash.length <= 1) {
    return false;
  }

  const params = new URLSearchParams(hash.slice(1));
  const type = String(params.get("type") || "").trim().toLowerCase();
  return SUPABASE_HASH_KEYS.some((key) => params.has(key)) || SUPABASE_HASH_TYPES.has(type);
}

/**
 * Builds the canonical callback URL for misplaced auth hash fragments.
 *
 * @param {{ configuredSiteUrl?: unknown, href?: unknown }} [input]
 * @returns {string}
 */
export function buildAuthHashForwardUrl(input = {}) {
  const fallbackHref = typeof window !== "undefined" ? window.location?.href : "";
  const href = String(input.href || fallbackHref || "").trim();

  try {
    const url = new URL(href);
    const normalizedPath = url.pathname.replace(/\/+$/, "");

    if (!isSupabaseAuthHash(url.hash) || normalizedPath === AUTH_CALLBACK_ROUTE) {
      return "";
    }

    return `${buildAuthRedirectUrl({
      configuredSiteUrl: input.configuredSiteUrl,
      browserOrigin: url.origin,
      path: AUTH_CALLBACK_PATH,
    })}${url.hash}`;
  } catch (error) {
    if (error instanceof TypeError) {
      return "";
    }

    throw error;
  }
}

/**
 * Builds a production URL when auth is accidentally opened on localhost.
 *
 * @param {{ configuredSiteUrl?: unknown, href?: unknown }} [input]
 * @returns {string}
 */
export function buildLocalhostAuthForwardUrl(input = {}) {
  const fallbackHref = typeof window !== "undefined" ? window.location?.href : "";
  const href = String(input.href || fallbackHref || "").trim();

  try {
    const url = new URL(href);

    if (!LOCAL_HOSTS.has(url.hostname)) {
      return "";
    }

    const hasEmptyHash = href.endsWith("#");
    const shouldForward = AUTH_PATH_PATTERN.test(url.pathname) || hasEmptyHash || isSupabaseAuthHash(url.hash);

    if (!shouldForward) {
      return "";
    }

    const target = buildAuthRedirectUrl({
      configuredSiteUrl: input.configuredSiteUrl,
      browserOrigin: url.origin,
      path: `${url.pathname}${url.search}`,
    });

    return target === href ? "" : `${target}${hasEmptyHash ? "#" : url.hash}`;
  } catch (error) {
    if (error instanceof TypeError) {
      return "";
    }

    throw error;
  }
}

/**
 * Resolves the first canonical auth URL needed for the current location.
 *
 * @param {{ configuredSiteUrl?: unknown, href?: unknown }} [input]
 * @returns {string}
 */
export function buildCanonicalAuthForwardUrl(input = {}) {
  return buildAuthHashForwardUrl(input) || buildLocalhostAuthForwardUrl(input);
}

/**
 * Redirects the current browser location to the canonical auth callback route.
 *
 * @param {{ configuredSiteUrl?: unknown, href?: unknown, location?: { replace: (url: string) => void } }} [input]
 * @returns {boolean}
 */
export function redirectMisplacedAuthHash(input = {}) {
  const locationObject = input.location || (typeof window !== "undefined" ? window.location : null);
  const nextUrl = buildCanonicalAuthForwardUrl({
    configuredSiteUrl: input.configuredSiteUrl,
    href: input.href || locationObject?.href,
  });

  if (!nextUrl || !locationObject || typeof locationObject.replace !== "function") {
    return false;
  }

  locationObject.replace(nextUrl);
  return true;
}
