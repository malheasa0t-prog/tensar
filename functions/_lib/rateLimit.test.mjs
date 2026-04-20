import assert from "node:assert/strict";
import test from "node:test";
import {
  RATE_LIMIT_MAX_REQUESTS,
  applyLocalRateLimit,
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
