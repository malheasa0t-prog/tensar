import assert from "node:assert/strict";
import test from "node:test";
import {
  RATE_LIMIT_MAX_REQUESTS,
  RATE_LIMIT_MODE_HEADER,
  applyApiRateLimit,
  applyLocalRateLimit,
  buildRateLimitConfigurationErrorResponse,
  buildRateLimitHeaders,
  buildRateLimitKey,
  resetLocalRateLimitStore,
} from "./rateLimit.js";

test("buildRateLimitKey should scope the hashed actor to the request path", async () => {
  const request = new Request("https://tensar.pages.dev/api/chat", {
    headers: {
      Authorization: "Bearer sample-token",
    },
  });

  const key = await buildRateLimitKey(request);

  assert.match(key, /^\/api\/chat:[a-f0-9]{32}$/);
});

test("applyLocalRateLimit should block the first request above the configured ceiling", () => {
  resetLocalRateLimitStore();

  const key = "actor:/api/chat";
  const nowMs = 1_000;

  for (let index = 0; index < RATE_LIMIT_MAX_REQUESTS; index += 1) {
    const result = applyLocalRateLimit({ key, nowMs: nowMs + index });
    assert.equal(result.allowed, true);
  }

  const blockedResult = applyLocalRateLimit({
    key,
    nowMs: nowMs + RATE_LIMIT_MAX_REQUESTS,
  });

  assert.equal(blockedResult.allowed, false);
  assert.equal(blockedResult.remaining, 0);
  assert.ok(blockedResult.retryAfterSeconds >= 1);
});

test("buildRateLimitHeaders should include retry metadata for blocked requests", () => {
  const headers = buildRateLimitHeaders({
    allowed: false,
    remaining: 0,
    retryAfterSeconds: 17,
  });

  assert.equal(headers["Ratelimit-Policy"], '"api";q=100;w=60');
  assert.equal(headers.Ratelimit, '"api";r=0;t=17');
  assert.equal(headers["Retry-After"], "17");
});

test("applyApiRateLimit should use the local fallback on deployed hosts by default", async () => {
  resetLocalRateLimitStore();

  const result = await applyApiRateLimit({
    env: { ASSETS: { fetch() {} } },
    request: new Request("https://tensr.systems/api/chat"),
  });

  assert.equal(result.allowed, true);
  assert.equal(result.configurationError, false);
  assert.equal(result.headers[RATE_LIMIT_MODE_HEADER], "local");
  assert.match(result.headers.Ratelimit, /^"api";r=\d+;t=\d+$/);
});

test("applyApiRateLimit should require an external limiter when strict mode is enabled", async () => {
  const result = await applyApiRateLimit({
    env: {
      ASSETS: { fetch() {} },
      REQUIRE_EDGE_RATE_LIMIT: "true",
    },
    request: new Request("https://tensr.systems/api/chat"),
  });

  assert.equal(result.allowed, false);
  assert.equal(result.configurationError, true);
  assert.equal(result.headers["Cache-Control"], "no-store");
  assert.equal(result.headers[RATE_LIMIT_MODE_HEADER], "local");
});

test("applyApiRateLimit should allow localhost fallback without a binding", async () => {
  resetLocalRateLimitStore();

  const result = await applyApiRateLimit({
    request: new Request("http://127.0.0.1:8788/api/chat"),
  });

  assert.equal(result.allowed, true);
  assert.equal(result.configurationError, false);
  assert.match(result.headers.Ratelimit, /^"api";r=\d+;t=\d+$/);
});

test("buildRateLimitConfigurationErrorResponse should return a 503 response", async () => {
  const response = buildRateLimitConfigurationErrorResponse({
    "X-RateLimit-State": "missing-binding",
  });
  const payload = await response.json();

  assert.equal(response.status, 503);
  assert.equal(response.headers.get("X-RateLimit-State"), "missing-binding");
  assert.equal(payload.code, "RAT-101");
});
