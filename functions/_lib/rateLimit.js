import { buildErrorPayload } from "./errorCodes.js";
/**
 * Shared API rate limiting helpers for Cloudflare Pages Functions.
 *
 * @module functions/_lib/rateLimit
 */

const LOCAL_RATE_LIMIT_STORE = new Map();
const RATE_LIMIT_BINDING_NAME = "TECHZONE_API_RATE_LIMITER";
const RATE_LIMIT_HEADER_NAME = '"api"';
const RATE_LIMIT_MAX_REQUESTS = 100;
const RATE_LIMIT_MODE_BINDING = "binding";
const RATE_LIMIT_MODE_HEADER = "X-RateLimit-Mode";
const RATE_LIMIT_MODE_LOCAL = "local";
const RATE_LIMIT_POLICY = `${RATE_LIMIT_HEADER_NAME};q=${RATE_LIMIT_MAX_REQUESTS};w=60`;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_WINDOW_SECONDS = RATE_LIMIT_WINDOW_MS / 1000;
const REQUIRE_EDGE_RATE_LIMIT_ENV = "REQUIRE_EDGE_RATE_LIMIT";
const RATE_LIMIT_CONFIGURATION_ERROR =
  "[RAT-101] API rate limiting binding is not configured for this environment.";
const RATE_LIMIT_EXCEEDED_MESSAGE = "[RAT-201] تم تجاوز الحد الأقصى للطلبات. حاول مرة أخرى بعد قليل.";

/**
 * Builds a stable request path for rate limiting.
 *
 * @param {Request} request - The incoming request.
 * @returns {string} The normalized pathname.
 */
function resolveRequestPath(request) {
  try {
    return new URL(request.url).pathname || "/api";
  } catch {
    return "/api";
  }
}
/**
 * Detects whether the current request is running on a local development host.
 *
 * @param {Request} request - The incoming request.
 * @returns {boolean} True when the request target is localhost.
 */
function isLocalRateLimitRequest(request) {
  try {
    const hostname = new URL(request.url).hostname.trim().toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname.endsWith(".localhost");
  } catch {
    return false;
  }
}
/**
 * Determines whether the unsafe in-memory fallback is allowed for this runtime.
 *
 * @param {{ env?: Record<string, unknown>, request: Request }} input - Request context.
 * @returns {boolean} True when the local fallback is acceptable.
 */
function canUseLocalRateLimitFallback(input) {
  const env = input?.env || {};
  if (env[REQUIRE_EDGE_RATE_LIMIT_ENV] !== "true") {
    return true;
  }

  return (
    env.ALLOW_LOCAL_RATE_LIMIT_FALLBACK === "true" ||
    isLocalRateLimitRequest(input.request) ||
    !env.ASSETS
  );
}
/**
 * Selects the most stable request identifier available.
 *
 * @param {Request} request - The incoming request.
 * @returns {string} The identifier source to hash.
 */
function resolveActorSource(request) {
  const authorization = request.headers.get("Authorization")?.trim();
  if (authorization) {
    return `auth:${authorization}`;
  }

  const forwardedIp = request.headers.get("cf-connecting-ip")?.trim();
  if (forwardedIp) {
    return `ip:${forwardedIp}`;
  }

  const userAgent = request.headers.get("User-Agent")?.trim();
  if (userAgent) {
    return `ua:${userAgent}`;
  }

  return "anonymous";
}
/**
 * Creates a short digest for the rate limit key.
 *
 * @param {string} value - The raw actor value.
 * @returns {Promise<string>} The shortened digest.
 */
async function digestKey(value) {
  const input = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", input);
  const hashBytes = Array.from(new Uint8Array(hashBuffer));

  return hashBytes
    .map((valuePart) => valuePart.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

/**
 * Creates the final rate limit key used for the actor and route.
 *
 * @param {Request} request - The incoming request.
 * @returns {Promise<string>} The hashed rate limit key.
 */
async function buildRateLimitKey(request) {
  const actorDigest = await digestKey(resolveActorSource(request));
  return `${resolveRequestPath(request)}:${actorDigest}`;
}

/**
 * Removes expired local timestamps from a rate limit bucket.
 *
 * @param {number[]} timestamps - The stored timestamps for one actor bucket.
 * @param {number} nowMs - The current timestamp in milliseconds.
 * @returns {number[]} The pruned timestamp list.
 */
function pruneExpiredTimestamps(timestamps, nowMs) {
  const cutoff = nowMs - RATE_LIMIT_WINDOW_MS;
  return timestamps.filter((timestamp) => timestamp > cutoff);
}

/**
 * Applies the local fallback rate limiter when no Cloudflare binding exists.
 *
 * @param {{ key: string, nowMs?: number }} input - The rate limiting input.
 * @returns {{ allowed: boolean, remaining: number, retryAfterSeconds: number }} The local decision.
 */
function applyLocalRateLimit(input) {
  const nowMs = Number.isFinite(input?.nowMs) ? input.nowMs : Date.now();
  const key = typeof input?.key === "string" ? input.key : "anonymous";
  const existingBucket = LOCAL_RATE_LIMIT_STORE.get(key) || [];
  const activeBucket = pruneExpiredTimestamps(existingBucket, nowMs);

  if (activeBucket.length >= RATE_LIMIT_MAX_REQUESTS) {
    const oldestTimestamp = activeBucket[0];
    const retryAfterMs = Math.max(1, RATE_LIMIT_WINDOW_MS - (nowMs - oldestTimestamp));

    LOCAL_RATE_LIMIT_STORE.set(key, activeBucket);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
    };
  }

  const nextBucket = [...activeBucket, nowMs];
  LOCAL_RATE_LIMIT_STORE.set(key, nextBucket);

  return {
    allowed: true,
    remaining: Math.max(0, RATE_LIMIT_MAX_REQUESTS - nextBucket.length),
    retryAfterSeconds: RATE_LIMIT_WINDOW_SECONDS,
  };
}

/**
 * Builds rate limit response headers.
 *
 * @param {{
 *   allowed?: boolean,
 *   remaining?: number | null,
 *   retryAfterSeconds?: number,
 * }} [input={}] - The rate limit result metadata.
 * @returns {Record<string, string>} The rate limit headers.
 */
function buildRateLimitHeaders(input = {}) {
  const allowed = input?.allowed !== false;
  const remaining = Number.isInteger(input?.remaining) ? input.remaining : null;
  const mode =
    input?.mode === RATE_LIMIT_MODE_BINDING
      ? RATE_LIMIT_MODE_BINDING
      : RATE_LIMIT_MODE_LOCAL;
  const retryAfterSeconds = Math.max(1, Number(input?.retryAfterSeconds) || RATE_LIMIT_WINDOW_SECONDS);
  const headers = {
    "Ratelimit-Policy": RATE_LIMIT_POLICY,
    [RATE_LIMIT_MODE_HEADER]: mode,
  };

  if (remaining !== null) {
    headers.Ratelimit = `${RATE_LIMIT_HEADER_NAME};r=${remaining};t=${retryAfterSeconds}`;
  }

  if (!allowed) {
    headers["Retry-After"] = String(retryAfterSeconds);
  }

  return headers;
}

/**
 * Builds the JSON response returned when the limit is exceeded.
 *
 * @param {Record<string, string>} [headers={}] - Additional rate limit headers.
 * @returns {Response} The HTTP 429 response.
 */
function buildRateLimitExceededResponse(headers = {}) {
  return Response.json(
    buildErrorPayload(RATE_LIMIT_EXCEEDED_MESSAGE),
    {
      status: 429,
      headers: {
        "Cache-Control": "no-store",
        ...headers,
      },
    }
  );
}

/**
 * Builds the JSON response returned when rate limiting is not configured safely.
 *
 * @param {Record<string, string>} [headers={}] - Additional response headers.
 * @returns {Response} The HTTP 503 response.
 */
function buildRateLimitConfigurationErrorResponse(headers = {}) {
  return Response.json(
    buildErrorPayload(RATE_LIMIT_CONFIGURATION_ERROR),
    {
      status: 503,
      headers: {
        "Cache-Control": "no-store",
        ...headers,
      },
    }
  );
}

/**
 * Applies the Cloudflare binding when it is configured for the API.
 *
 * @param {{ binding?: { limit?: (input: { key: string }) => Promise<{ success?: boolean }> }, key: string }} input
 * @returns {Promise<{ allowed: boolean, remaining: number | null, retryAfterSeconds: number }>}
 */
async function applyCloudflareRateLimit(input) {
  const binding = input?.binding;
  if (!binding?.limit) {
    return {
      allowed: true,
      mode: RATE_LIMIT_MODE_LOCAL,
      remaining: null,
      retryAfterSeconds: RATE_LIMIT_WINDOW_SECONDS,
    };
  }

  const result = await binding.limit({ key: input.key });

  return {
    allowed: result?.success !== false,
    mode: RATE_LIMIT_MODE_BINDING,
    remaining: null,
    retryAfterSeconds: RATE_LIMIT_WINDOW_SECONDS,
  };
}

/**
 * Applies the best available API rate limiting strategy.
 *
 * @param {{ request: Request, env?: Record<string, unknown>, nowMs?: number }} input - The request context.
 * @returns {Promise<{ allowed: boolean, headers: Record<string, string> }>} The limit decision and headers.
 */
async function applyApiRateLimit(input) {
  const request = input?.request;
  const env = input?.env || {};
  const key = await buildRateLimitKey(request);
  const binding = env[RATE_LIMIT_BINDING_NAME];
  if (!binding?.limit && !canUseLocalRateLimitFallback({ env, request })) {
    return {
      allowed: false,
      configurationError: true,
      headers: {
        "Cache-Control": "no-store",
        [RATE_LIMIT_MODE_HEADER]: RATE_LIMIT_MODE_LOCAL,
      },
    };
  }

  const result = binding?.limit
    ? await applyCloudflareRateLimit({ binding, key })
    : {
        ...applyLocalRateLimit({ key, nowMs: input?.nowMs }),
        mode: RATE_LIMIT_MODE_LOCAL,
      };

  return {
    allowed: result.allowed,
    configurationError: false,
    headers: buildRateLimitHeaders(result),
  };
}

/**
 * Clears the local fallback store for deterministic tests.
 *
 * @returns {void}
 */
function resetLocalRateLimitStore() {
  LOCAL_RATE_LIMIT_STORE.clear();
}

export {
  RATE_LIMIT_BINDING_NAME,
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_MODE_BINDING,
  RATE_LIMIT_MODE_HEADER,
  RATE_LIMIT_MODE_LOCAL,
  RATE_LIMIT_WINDOW_SECONDS,
  applyApiRateLimit,
  applyLocalRateLimit,
  buildRateLimitConfigurationErrorResponse,
  buildRateLimitExceededResponse,
  buildRateLimitHeaders,
  buildRateLimitKey,
  resetLocalRateLimitStore,
};
