import assert from "node:assert/strict";
import test from "node:test";
import { createOrderLookupHandler, onRequestOptions } from "./lookup.js";

/**
 * Creates a minimal Cloudflare Pages Function context for lookup tests.
 *
 * @param {{ body?: string, headers?: Record<string, string>, method?: string }} [input]
 * @returns {{ env: Record<string, unknown>, request: Request }}
 */
function createContext(input = {}) {
  return {
    env: {},
    request: new Request("https://tensr.systems/api/orders/lookup", {
      body: input.body,
      headers: input.headers || {
        "Content-Type": "application/json",
        Origin: "https://tensr.systems",
      },
      method: input.method || "POST",
    }),
  };
}

/**
 * Creates a lookup handler with safe default test doubles.
 *
 * @param {{ lookupResult?: Record<string, unknown> | null, onLookup?: (input: Record<string, unknown>) => void }} [input]
 * @returns {(context: ReturnType<typeof createContext>) => Promise<Response>}
 */
function createHandler(input = {}) {
  return createOrderLookupHandler({
    applyApiRateLimit: async () => ({
      allowed: true,
      configurationError: false,
      headers: { "X-RateLimit-Mode": "local" },
    }),
    createSupabaseAdmin: () => ({ marker: "admin-client" }),
    lookupPublicOrderByNumber: async (lookupInput) => {
      input.onLookup?.(lookupInput);
      return input.lookupResult === undefined
        ? {
            details: [],
            orderNumber: "#1001",
            requestType: "delivery",
            requestTypeLabel: "طلب توصيل",
            status: { color: "#06b6d4", label: "قيد المعالجة" },
            title: "متابعة طلب التوصيل",
          }
        : input.lookupResult;
    },
  });
}

test("onRequestPost should resolve public orders with a phone suffix", async () => {
  let lookupInput = null;
  const handler = createHandler({
    onLookup(input) {
      lookupInput = input;
    },
  });

  const response = await handler(createContext({
    body: JSON.stringify({
      contactSuffix: "1234",
      lookupType: "delivery",
      orderNumber: "#1001",
    }),
  }));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.equal(payload.orderNumber, "#1001");
  assert.equal(lookupInput.contactSuffix, "1234");
  assert.equal(lookupInput.lookupType, "delivery");
  assert.equal(lookupInput.orderNumber, "#1001");
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "https://tensr.systems");
});

test("onRequestPost should return not found when the lookup has no match", async () => {
  const handler = createHandler({ lookupResult: null });

  const response = await handler(createContext({
    body: JSON.stringify({
      contactSuffix: "1234",
      lookupType: "all",
      orderNumber: "#9999",
    }),
  }));
  const payload = await response.json();

  assert.equal(response.status, 404);
  assert.match(payload.error, /\[OLK-404\]/);
});

test("onRequestPost should reject malformed JSON bodies", async () => {
  const handler = createHandler();

  const response = await handler(createContext({ body: "{" }));
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.match(payload.error, /\[OLK-102\]/);
});

test("onRequestOptions should allow idempotency-capable public headers", () => {
  const response = onRequestOptions(createContext({ method: "OPTIONS" }));

  assert.equal(response.status, 204);
  assert.match(response.headers.get("Access-Control-Allow-Headers") || "", /Idempotency-Key/);
});
