import assert from "node:assert/strict";
import test from "node:test";
import { requestStockAlert } from "./stockAlertService.js";

function createStockAlertClient({ accessToken = "token-1" } = {}) {
  return {
    auth: {
      async getSession() {
        return {
          data: {
            session: accessToken ? { access_token: accessToken } : null,
          },
        };
      },
    },
  };
}

test("requestStockAlert should reject invalid product ids", async () => {
  await assert.rejects(() => requestStockAlert({ client: createStockAlertClient(), productId: "" }), /تعذر تفعيل/);
});

test("requestStockAlert should reject when there is no authenticated session", async () => {
  await assert.rejects(
    () => requestStockAlert({ client: createStockAlertClient({ accessToken: "" }), productId: "prd-1" }),
    /سجل الدخول أولاً/
  );
});

test("requestStockAlert should call the stock alert API with the bearer token", async () => {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      async json() {
        return {
          success: true,
          alreadySubscribed: false,
          productName: "Laptop",
        };
      },
    };
  };

  try {
    const result = await requestStockAlert({
      client: createStockAlertClient(),
      productId: "prd-1",
    });

    assert.deepEqual(result, {
      alreadySubscribed: false,
      productName: "Laptop",
      subscribed: true,
    });
    assert.equal(calls[0].url, "/api/stock-alerts");
    assert.equal(calls[0].options.method, "POST");
    assert.equal(calls[0].options.headers.Authorization, "Bearer token-1");
  } finally {
    global.fetch = originalFetch;
  }
});

test("requestStockAlert should surface API errors", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: false,
    async json() {
      return { success: false, error: "المنتج متوفر الآن بالفعل." };
    },
  });

  try {
    await assert.rejects(
      () => requestStockAlert({ client: createStockAlertClient(), productId: "prd-2" }),
      /المنتج متوفر الآن بالفعل/
    );
  } finally {
    global.fetch = originalFetch;
  }
});
