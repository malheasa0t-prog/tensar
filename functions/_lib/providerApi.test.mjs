import assert from "node:assert/strict";
import test from "node:test";

import {
  createProviderOrder,
  getProviderBalance,
  getProviderServices,
  parseProviderJson,
  readProviderConfig,
  translateProviderError,
} from "./providerApi.js";

test("readProviderConfig should normalize environment values", () => {
  assert.deepEqual(
    readProviderConfig({
      PROVIDER_API_BASE_URL: " https://serva-s.com/api/v1 ",
      PROVIDER_API_KEY: " api-key ",
      PROVIDER_API_TIMEOUT_MS: "9000",
    }),
    {
      apiKey: "api-key",
      baseUrl: "https://serva-s.com/api/v1",
      timeoutMs: 9000,
    }
  );
});

test("translateProviderError should localize known provider errors", () => {
  assert.equal(translateProviderError("invalid_api_key"), "مفتاح API غير صالح.");
  assert.equal(translateProviderError("custom message"), "custom message");
});

test("parseProviderJson should fail clearly on invalid upstream bodies", async () => {
  await assert.rejects(
    () => parseProviderJson(new Response("<html>bad gateway</html>")),
    /استجابة غير صالحة من المزود: <html>bad gateway<\/html>/
  );
});

test("getProviderServices should return provider catalog arrays", async () => {
  const result = await getProviderServices(
    {
      PROVIDER_API_BASE_URL: "https://serva-s.com/api/v1",
      PROVIDER_API_KEY: "api-key",
      PROVIDER_API_TIMEOUT_MS: "5000",
    },
    {
      fetchImpl() {
        return Promise.resolve(
          new Response(JSON.stringify([{ service: 1, name: "Demo" }]), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );
      },
    }
  );

  assert.deepEqual(result, {
    success: true,
    services: [{ service: 1, name: "Demo" }],
  });
});

test("getProviderBalance should surface upstream provider errors", async () => {
  const result = await getProviderBalance(
    {
      PROVIDER_API_BASE_URL: "https://serva-s.com/api/v1",
      PROVIDER_API_KEY: "api-key",
    },
    {
      fetchImpl() {
        return Promise.resolve(
          new Response(JSON.stringify({ error: "INVALID_API_KEY" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );
      },
    }
  );

  assert.equal(result.success, false);
  assert.equal(result.error, translateProviderError("INVALID_API_KEY"));
  assert.equal(result.status, 502);
});

test("createProviderOrder should return the upstream order id", async () => {
  const result = await createProviderOrder(
    {
      PROVIDER_API_BASE_URL: "https://serva-s.com/api/v1",
      PROVIDER_API_KEY: "api-key",
    },
    {
      serviceId: "42",
      quantity: 3,
      link: "https://example.com/order-target",
    },
    {
      fetchImpl() {
        return Promise.resolve(
          new Response(JSON.stringify({ order: "ORD-12345" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        );
      },
    }
  );

  assert.deepEqual(result, {
    success: true,
    orderId: "ORD-12345",
  });
});

test("createProviderOrder should reject invalid local payloads", async () => {
  const result = await createProviderOrder(
    {
      PROVIDER_API_BASE_URL: "https://serva-s.com/api/v1",
      PROVIDER_API_KEY: "api-key",
    },
    {
      serviceId: "",
      quantity: 0,
    }
  );

  assert.equal(result.success, false);
  assert.equal(result.error, "Provider order payload is invalid.");
  assert.equal(result.status, 400);
});
