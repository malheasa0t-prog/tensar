import test from "node:test";
import assert from "node:assert/strict";
import { uploadDepositProof } from "./depositProofService.js";

function createAuthClient({ accessToken = "token-1" } = {}) {
  return {
    client: {
      auth: {
        async getSession() {
          return {
            data: {
              session: accessToken ? { access_token: accessToken } : null,
            },
          };
        },
      },
    },
  };
}

test("uploadDepositProof should return null when no file was provided", async () => {
  const { client } = createAuthClient();

  const result = await uploadDepositProof({
    client,
    proofFile: null,
  });

  assert.equal(result, null);
});

test("uploadDepositProof should upload proof files through the deposit API", async () => {
  const { client } = createAuthClient();
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      async json() {
        return { success: true, data: { objectPath: "user-1/proof.png" } };
      },
    };
  };

  try {
    const result = await uploadDepositProof({
      client,
      proofFile: { name: "receipt.png", type: "image/png", size: 10 },
    });

    assert.equal(result, "user-1/proof.png");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "/api/deposits/proof");
    assert.equal(calls[0].options.method, "POST");
    assert.equal(calls[0].options.headers.Authorization, "Bearer token-1");
    assert.ok(calls[0].options.body instanceof FormData);
  } finally {
    global.fetch = originalFetch;
  }
});

test("uploadDepositProof should reject non-image files", async () => {
  const { client } = createAuthClient();

  await assert.rejects(
    () =>
      uploadDepositProof({
        client,
        proofFile: { name: "receipt.pdf", type: "application/pdf" },
      }),
    /صورة صالحة/
  );
});

test("uploadDepositProof should reject when the session token is missing", async () => {
  const { client } = createAuthClient({ accessToken: "" });

  await assert.rejects(
    () =>
      uploadDepositProof({
        client,
        proofFile: { name: "receipt.png", type: "image/png", size: 10 },
      }),
    /جلسة تسجيل الدخول/
  );
});

test("uploadDepositProof should surface API upload failures", async () => {
  const { client } = createAuthClient();
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: false,
    async json() {
      return { success: false, error: "Bucket not found" };
    },
  });

  try {
    await assert.rejects(
      () =>
        uploadDepositProof({
          client,
          proofFile: { name: "receipt.png", type: "image/png", size: 10 },
        }),
      /Bucket not found/
    );
  } finally {
    global.fetch = originalFetch;
  }
});
