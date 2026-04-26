/**
 * Guest checkout rate limiting helpers for Cloudflare Pages Functions.
 */

import { buildErrorPayload } from "./errorCodes.js";
import { extractBearerToken } from "./supabase.js";

const CHECKOUT_GUEST_RATE_LIMIT_STORE = new Map();
const CHECKOUT_GUEST_RATE_LIMIT_BINDING_NAME = "TECHZONE_CHECKOUT_GUEST_RATE_LIMITER";
const CHECKOUT_GUEST_RATE_LIMIT_MAX_REQUESTS = 5;
const CHECKOUT_GUEST_RATE_LIMIT_MODE_BINDING = "binding";
const CHECKOUT_GUEST_RATE_LIMIT_MODE_HEADER = "X-Checkout-Guest-Mode";
const CHECKOUT_GUEST_RATE_LIMIT_MODE_LOCAL = "local";
const CHECKOUT_GUEST_RATE_LIMIT_WINDOW_MS = 60_000;
const CHECKOUT_GUEST_RATE_LIMIT_WINDOW_SECONDS =
  CHECKOUT_GUEST_RATE_LIMIT_WINDOW_MS / 1000;
const REQUIRE_EDGE_RATE_LIMIT_ENV = "REQUIRE_EDGE_RATE_LIMIT";
const CHECKOUT_GUEST_RATE_LIMIT_CONFIGURATION_ERROR =
  "[CHK-115] Guest checkout rate limiting is not configured for this environment.";
const CHECKOUT_GUEST_RATE_LIMIT_ERROR =
  "[CHK-116] تم تجاوز الحد الأقصى لطلبات الشراء كضيف من نفس الشبكة. حاول مرة أخرى بعد قليل أو سجّل الدخول.";

/**
 * Resolves one stable guest actor string from the incoming request.
 *
 * @param {Request} request - Incoming request object.
 * @returns {string} Stable actor string scoped to guest requests.
 */
function resolveGuestCheckoutActor(request) {
  const forwardedIp = request.headers.get("cf-connecting-ip")?.trim();
  if (forwardedIp) return `ip:${forwardedIp}`;

  const trueClientIp = request.headers.get("true-client-ip")?.trim();
  if (trueClientIp) return `ip:${trueClientIp}`;

  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwardedFor) return `ip:${forwardedFor}`;

  const userAgent = request.headers.get("user-agent")?.trim();
  if (userAgent) return `ua:${userAgent}`;

  return "guest:anonymous";
}

/**
 * Detects whether the current request is running on a local development host.
 *
 * @param {Request} request - Incoming request object.
 * @returns {boolean} True when the request target is localhost.
 */
function isLocalGuestCheckoutRequest(request) {
  try {
    const hostname = new URL(request.url).hostname.trim().toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname.endsWith(".localhost");
  } catch {
    return false;
  }
}

/**
 * Determines whether the local guest checkout fallback is acceptable.
 *
 * @param {{ env?: Record<string, unknown>, request: Request }} input - Request context.
 * @returns {boolean} True when the local fallback is allowed.
 */
function canUseLocalGuestCheckoutFallback(input) {
  const env = input?.env || {};
  if (env[REQUIRE_EDGE_RATE_LIMIT_ENV] !== "true") {
    return true;
  }

  return (
    env.ALLOW_LOCAL_RATE_LIMIT_FALLBACK === "true" ||
    isLocalGuestCheckoutRequest(input.request) ||
    !env.ASSETS
  );
}

/**
 * Builds a deterministic short digest for rate limit storage keys.
 *
 * @param {string} value - Raw actor key to hash.
 * @returns {Promise<string>} Stable digest used in storage keys.
 */
async function digestGuestCheckoutKey(value) {
  const bytes = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);

  return Array.from(new Uint8Array(hashBuffer))
    .map((part) => part.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

/**
 * Builds the final guest checkout rate limit key.
 *
 * @param {Request} request - Incoming request object.
 * @returns {Promise<string>} Hashed guest checkout key.
 */
async function buildGuestCheckoutRateLimitKey(request) {
  const actorDigest = await digestGuestCheckoutKey(resolveGuestCheckoutActor(request));
  return `checkout-guest:${actorDigest}`;
}

/**
 * Removes expired timestamps from one guest checkout bucket.
 *
 * @param {number[]} timestamps - Stored attempt timestamps.
 * @param {number} nowMs - Current wall clock in milliseconds.
 * @returns {number[]} Pruned timestamps still inside the active window.
 */
function pruneGuestCheckoutAttempts(timestamps, nowMs) {
  const cutoff = nowMs - CHECKOUT_GUEST_RATE_LIMIT_WINDOW_MS;
  return timestamps.filter((timestamp) => timestamp > cutoff);
}

/**
 * Applies the in-memory guest checkout limiter when no Cloudflare binding exists.
 *
 * @param {{ key: string, nowMs?: number }} input - Rate limit state.
 * @returns {{ allowed: boolean, remaining: number, retryAfterSeconds: number }} Local decision.
 */
function applyLocalGuestCheckoutRateLimit(input) {
  const nowMs = Number.isFinite(input?.nowMs) ? input.nowMs : Date.now();
  const key = typeof input?.key === "string" ? input.key : "checkout-guest:anonymous";
  const activeBucket = pruneGuestCheckoutAttempts(
    CHECKOUT_GUEST_RATE_LIMIT_STORE.get(key) || [],
    nowMs
  );

  if (activeBucket.length >= CHECKOUT_GUEST_RATE_LIMIT_MAX_REQUESTS) {
    const retryAfterMs =
      CHECKOUT_GUEST_RATE_LIMIT_WINDOW_MS - (nowMs - activeBucket[0]);
    CHECKOUT_GUEST_RATE_LIMIT_STORE.set(key, activeBucket);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil(Math.max(1, retryAfterMs) / 1000),
    };
  }

  const nextBucket = [...activeBucket, nowMs];
  CHECKOUT_GUEST_RATE_LIMIT_STORE.set(key, nextBucket);
  return {
    allowed: true,
    remaining: Math.max(0, CHECKOUT_GUEST_RATE_LIMIT_MAX_REQUESTS - nextBucket.length),
    retryAfterSeconds: CHECKOUT_GUEST_RATE_LIMIT_WINDOW_SECONDS,
  };
}

/**
 * Applies the Cloudflare guest checkout limiter when a dedicated binding exists.
 *
 * @param {{ binding?: { limit?: (input: { key: string }) => Promise<{ success?: boolean }> }, key: string }} input
 * @returns {Promise<{ allowed: boolean, remaining: number | null, retryAfterSeconds: number }>}
 */
async function applyCloudflareGuestCheckoutRateLimit(input) {
  const result = await input.binding.limit({ key: input.key });
  return {
    allowed: result?.success !== false,
    mode: CHECKOUT_GUEST_RATE_LIMIT_MODE_BINDING,
    remaining: null,
    retryAfterSeconds: CHECKOUT_GUEST_RATE_LIMIT_WINDOW_SECONDS,
  };
}

/**
 * Builds the response headers for guest checkout rate limiting.
 *
 * @param {{ allowed?: boolean, remaining?: number | null, retryAfterSeconds?: number }} [input={}]
 * @returns {Record<string, string>} Guest checkout rate limit headers.
 */
function buildGuestCheckoutRateLimitHeaders(input = {}) {
  const allowed = input?.allowed !== false;
  const mode =
    input?.mode === CHECKOUT_GUEST_RATE_LIMIT_MODE_BINDING
      ? CHECKOUT_GUEST_RATE_LIMIT_MODE_BINDING
      : CHECKOUT_GUEST_RATE_LIMIT_MODE_LOCAL;
  const retryAfterSeconds = Math.max(
    1,
    Number(input?.retryAfterSeconds) || CHECKOUT_GUEST_RATE_LIMIT_WINDOW_SECONDS
  );
  const headers = {
    "Cache-Control": "no-store",
    "X-Checkout-Guest-Limit": String(CHECKOUT_GUEST_RATE_LIMIT_MAX_REQUESTS),
    [CHECKOUT_GUEST_RATE_LIMIT_MODE_HEADER]: mode,
    "X-Checkout-Guest-Window": String(CHECKOUT_GUEST_RATE_LIMIT_WINDOW_SECONDS),
  };

  if (Number.isInteger(input?.remaining)) {
    headers["X-Checkout-Guest-Remaining"] = String(input.remaining);
  }

  if (!allowed) {
    headers["Retry-After"] = String(retryAfterSeconds);
  }

  return headers;
}

/**
 * Applies guest-specific checkout rate limiting for unauthenticated requests.
 *
 * @param {{ env?: Record<string, unknown>, nowMs?: number, request: Request }} input - Request context.
 * @returns {Promise<{ allowed: boolean, headers: Record<string, string> }>} Rate limit decision.
 */
async function applyGuestCheckoutRateLimit(input) {
  if (extractBearerToken(input.request)) {
    return { allowed: true, headers: {} };
  }

  const env = input?.env || {};
  const key = await buildGuestCheckoutRateLimitKey(input.request);
  const binding = env[CHECKOUT_GUEST_RATE_LIMIT_BINDING_NAME];
  if (!binding?.limit && !canUseLocalGuestCheckoutFallback({ env, request: input.request })) {
    return {
      allowed: false,
      configurationError: true,
      headers: {
        "Cache-Control": "no-store",
        [CHECKOUT_GUEST_RATE_LIMIT_MODE_HEADER]: CHECKOUT_GUEST_RATE_LIMIT_MODE_LOCAL,
      },
    };
  }

  const result = binding?.limit
    ? await applyCloudflareGuestCheckoutRateLimit({ binding, key })
    : {
        ...applyLocalGuestCheckoutRateLimit({ key, nowMs: input?.nowMs }),
        mode: CHECKOUT_GUEST_RATE_LIMIT_MODE_LOCAL,
      };

  return {
    allowed: result.allowed,
    configurationError: false,
    headers: buildGuestCheckoutRateLimitHeaders(result),
  };
}

/**
 * Builds the HTTP 429 response returned for blocked guest checkout attempts.
 *
 * @param {Record<string, string>} [headers={}] - Additional response headers.
 * @returns {Response} JSON rate limit response.
 */
function buildGuestCheckoutRateLimitExceededResponse(headers = {}) {
  return Response.json(buildErrorPayload(CHECKOUT_GUEST_RATE_LIMIT_ERROR), {
    status: 429,
    headers,
  });
}

/**
 * Builds the HTTP 503 response returned when guest rate limiting is missing.
 *
 * @param {Record<string, string>} [headers={}] - Additional response headers.
 * @returns {Response} JSON configuration error response.
 */
function buildGuestCheckoutRateLimitConfigurationResponse(headers = {}) {
  return Response.json(buildErrorPayload(CHECKOUT_GUEST_RATE_LIMIT_CONFIGURATION_ERROR), {
    status: 503,
    headers: {
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}

/**
 * Enforces guest checkout rate limiting for the current request.
 *
 * @param {{ env?: Record<string, unknown>, nowMs?: number, request: Request }} input - Request context.
 * @returns {Promise<Response | null>} 429 response when blocked, otherwise null.
 */
async function guardGuestCheckoutRateLimit(input) {
  const result = await applyGuestCheckoutRateLimit(input);
  if (result.allowed) {
    return null;
  }

  return result.configurationError
    ? buildGuestCheckoutRateLimitConfigurationResponse(result.headers)
    : buildGuestCheckoutRateLimitExceededResponse(result.headers);
}

/**
 * Clears the local guest checkout rate limit store for deterministic tests.
 *
 * @returns {void}
 */
function resetGuestCheckoutRateLimitStore() {
  CHECKOUT_GUEST_RATE_LIMIT_STORE.clear();
}

export {
  CHECKOUT_GUEST_RATE_LIMIT_BINDING_NAME,
  CHECKOUT_GUEST_RATE_LIMIT_ERROR,
  CHECKOUT_GUEST_RATE_LIMIT_MAX_REQUESTS,
  CHECKOUT_GUEST_RATE_LIMIT_MODE_BINDING,
  CHECKOUT_GUEST_RATE_LIMIT_MODE_HEADER,
  CHECKOUT_GUEST_RATE_LIMIT_MODE_LOCAL,
  CHECKOUT_GUEST_RATE_LIMIT_WINDOW_SECONDS,
  applyGuestCheckoutRateLimit,
  buildGuestCheckoutRateLimitConfigurationResponse,
  buildGuestCheckoutRateLimitExceededResponse,
  buildGuestCheckoutRateLimitHeaders,
  guardGuestCheckoutRateLimit,
  resetGuestCheckoutRateLimitStore,
};
