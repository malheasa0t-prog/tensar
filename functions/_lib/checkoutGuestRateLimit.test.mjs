import assert from "node:assert/strict";
import test from "node:test";

import {
  CHECKOUT_GUEST_RATE_LIMIT_ERROR,
  CHECKOUT_GUEST_RATE_LIMIT_MAX_REQUESTS,
  CHECKOUT_GUEST_RATE_LIMIT_MODE_HEADER,
  CHECKOUT_GUEST_RATE_LIMIT_WINDOW_SECONDS,
  applyGuestCheckoutRateLimit,
  buildGuestCheckoutRateLimitConfigurationResponse,
  buildGuestCheckoutRateLimitExceededResponse,
  guardGuestCheckoutRateLimit,
  resetGuestCheckoutRateLimitStore,
} from "./checkoutGuestRateLimit.js";

test("applyGuestCheckoutRateLimit should skip authenticated checkout requests", async () => {
  resetGuestCheckoutRateLimitStore();

  const result = await applyGuestCheckoutRateLimit({
    request: new Request("https://tensr.systems/api/checkout", {
      headers: { Authorization: "Bearer valid-token" },
    }),
  });

  assert.equal(result.allowed, true);
  assert.deepEqual(result.headers, {});
});

test("applyGuestCheckoutRateLimit should block the first guest request above the local ceiling", async () => {
  resetGuestCheckoutRateLimitStore();
  const request = new Request("https://tensr.systems/api/checkout", {
    headers: { "cf-connecting-ip": "203.0.113.9" },
  });
  const baseNow = 1_000;

  for (let index = 0; index < CHECKOUT_GUEST_RATE_LIMIT_MAX_REQUESTS; index += 1) {
    const result = await applyGuestCheckoutRateLimit({
      nowMs: baseNow + index,
      request,
    });

    assert.equal(result.allowed, true);
  }

  const blockedResult = await applyGuestCheckoutRateLimit({
    nowMs: baseNow + CHECKOUT_GUEST_RATE_LIMIT_MAX_REQUESTS,
    request,
  });

  assert.equal(blockedResult.allowed, false);
  assert.equal(blockedResult.headers["X-Checkout-Guest-Remaining"], "0");
  assert.equal(
    blockedResult.headers["X-Checkout-Guest-Window"],
    String(CHECKOUT_GUEST_RATE_LIMIT_WINDOW_SECONDS)
  );
  assert.ok(Number(blockedResult.headers["Retry-After"]) >= 1);
});

test("guardGuestCheckoutRateLimit should return a 429 response for blocked guest requests", async () => {
  resetGuestCheckoutRateLimitStore();
  const request = new Request("https://tensr.systems/api/checkout", {
    headers: { "cf-connecting-ip": "198.51.100.21" },
  });
  const baseNow = 10_000;

  for (let index = 0; index < CHECKOUT_GUEST_RATE_LIMIT_MAX_REQUESTS; index += 1) {
    await guardGuestCheckoutRateLimit({ nowMs: baseNow + index, request });
  }

  const response = await guardGuestCheckoutRateLimit({
    nowMs: baseNow + CHECKOUT_GUEST_RATE_LIMIT_MAX_REQUESTS,
    request,
  });
  const payload = await response.json();

  assert.equal(response.status, 429);
  assert.equal(payload.code, "CHK-116");
  assert.equal(payload.error, CHECKOUT_GUEST_RATE_LIMIT_ERROR);
});

test("buildGuestCheckoutRateLimitExceededResponse should include the provided headers", async () => {
  const response = buildGuestCheckoutRateLimitExceededResponse({
    "Retry-After": "30",
    "X-Checkout-Guest-Remaining": "0",
  });
  const payload = await response.json();

  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Retry-After"), "30");
  assert.equal(response.headers.get("X-Checkout-Guest-Remaining"), "0");
  assert.equal(payload.error, CHECKOUT_GUEST_RATE_LIMIT_ERROR);
});

test("applyGuestCheckoutRateLimit should use the local fallback on deployed hosts by default", async () => {
  resetGuestCheckoutRateLimitStore();

  const result = await applyGuestCheckoutRateLimit({
    env: { ASSETS: { fetch() {} } },
    request: new Request("https://tensr.systems/api/checkout", {
      headers: { "cf-connecting-ip": "203.0.113.4" },
    }),
  });

  assert.equal(result.allowed, true);
  assert.equal(result.configurationError, false);
  assert.equal(result.headers[CHECKOUT_GUEST_RATE_LIMIT_MODE_HEADER], "local");
  assert.match(result.headers["X-Checkout-Guest-Remaining"], /^\d+$/);
});

test("applyGuestCheckoutRateLimit should require an external limiter when strict mode is enabled", async () => {
  resetGuestCheckoutRateLimitStore();

  const result = await applyGuestCheckoutRateLimit({
    env: {
      ASSETS: { fetch() {} },
      REQUIRE_EDGE_RATE_LIMIT: "true",
    },
    request: new Request("https://tensr.systems/api/checkout", {
      headers: { "cf-connecting-ip": "203.0.113.4" },
    }),
  });

  assert.equal(result.allowed, false);
  assert.equal(result.configurationError, true);
  assert.equal(result.headers["Cache-Control"], "no-store");
  assert.equal(result.headers[CHECKOUT_GUEST_RATE_LIMIT_MODE_HEADER], "local");
});

test("buildGuestCheckoutRateLimitConfigurationResponse should return a 503 response", async () => {
  const response = buildGuestCheckoutRateLimitConfigurationResponse({
    "X-Checkout-Guard": "missing-binding",
  });
  const payload = await response.json();

  assert.equal(response.status, 503);
  assert.equal(response.headers.get("X-Checkout-Guard"), "missing-binding");
  assert.equal(payload.code, "CHK-115");
});
