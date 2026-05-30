/**
 * Tests for customer deposit page data and Orange Money request creation.
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  LOGIN_REQUIRED_MESSAGE,
  PAYER_PHONE_INVALID_MESSAGE,
  PAYER_PHONE_REQUIRED_MESSAGE,
  REFERENCE_ID_INVALID_MESSAGE,
  buildOrangeMoneyDepositSuccessMessage,
  createDepositRequest,
  fetchDepositPageSnapshot,
  normalizeDepositPayerPhone,
  validateDepositPayerPhone,
  validateOrangeMoneyReferenceId,
} from "./depositPageService.js";

const ORIGINAL_FETCH = globalThis.fetch;

test.afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});

/**
 * Creates a minimal Supabase auth client stub.
 *
 * @param {{ accessToken?: string, user?: { id: string } | null }} [options={}] - Auth options.
 * @returns {Record<string, unknown>} Client stub.
 */
function createAuthClient(options = {}) {
  const accessToken = String(options.accessToken || "");
  const user = options.user ?? null;

  return {
    auth: {
      async getSession() {
        return {
          data: {
            session: accessToken ? { access_token: accessToken } : null,
          },
        };
      },
      async getUser() {
        return { data: { user } };
      },
    },
  };
}

test("fetchDepositPageSnapshot should return settings for guests", async () => {
  const client = createAuthClient();

  const result = await fetchDepositPageSnapshot({
    client,
    loadSettings: async () => ({
      depositTransfer: { bankName: "البنك العربي", iban: "JO00 TEST 1234" },
    }),
  });

  assert.deepEqual(result, {
    userId: "",
    deposits: [],
    depositTransfer: { bankName: "البنك العربي", iban: "JO00 TEST 1234" },
    walletTransferNumber: "",
  });
});

test("fetchDepositPageSnapshot should load deposits for authenticated users", async () => {
  const client = {
    ...createAuthClient({ user: { id: "user-1" } }),
    from(tableName) {
      assert.equal(tableName, "deposits");
      return {
        select() {
          return {
            eq(columnName, value) {
              assert.equal(columnName, "user_id");
              assert.equal(value, "user-1");
              return {
                async order(columnToSort, options) {
                  assert.equal(columnToSort, "created_at");
                  assert.deepEqual(options, { ascending: false });
                  return { data: [{ id: "dep-1", amount: 10 }], error: null };
                },
              };
            },
          };
        },
      };
    },
  };

  const result = await fetchDepositPageSnapshot({
    client,
    loadSettings: async () => ({
      depositTransfer: { bankName: "bank", iban: "iban" },
      walletTransferNumber: "0770000000",
    }),
  });

  assert.deepEqual(result, {
    userId: "user-1",
    deposits: [{ id: "dep-1", amount: 10 }],
    depositTransfer: { bankName: "bank", iban: "iban" },
    walletTransferNumber: "0770000000",
  });
});

test("fetchDepositPageSnapshot should surface deposit query failures", async () => {
  const client = {
    ...createAuthClient({ user: { id: "user-1" } }),
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                async order() {
                  return { data: null, error: { message: "query failed" } };
                },
              };
            },
          };
        },
      };
    },
  };

  await assert.rejects(
    () => fetchDepositPageSnapshot({ client, loadSettings: async () => ({ depositTransfer: {} }) }),
    /تعذر تحميل سجل الإيداعات/u,
  );
});

test("normalizeDepositPayerPhone should normalize Jordanian phone variants", () => {
  assert.equal(normalizeDepositPayerPhone("+962 77 123 4567"), "0771234567");
  assert.equal(normalizeDepositPayerPhone("00962771234567"), "0771234567");
});

test("validateDepositPayerPhone should require a phone number", () => {
  assert.equal(validateDepositPayerPhone(""), PAYER_PHONE_REQUIRED_MESSAGE);
});

test("validateDepositPayerPhone should reject malformed phone numbers", () => {
  assert.equal(validateDepositPayerPhone("12345"), PAYER_PHONE_INVALID_MESSAGE);
});

test("validateDepositPayerPhone should accept local Jordanian numbers", () => {
  assert.equal(validateDepositPayerPhone("0771234567"), "");
});

test("validateOrangeMoneyReferenceId should allow blank references", () => {
  assert.equal(validateOrangeMoneyReferenceId(""), "");
});

test("validateOrangeMoneyReferenceId should reject malformed references", () => {
  assert.equal(validateOrangeMoneyReferenceId("abc"), REFERENCE_ID_INVALID_MESSAGE);
});

test("buildOrangeMoneyDepositSuccessMessage should describe a stored-reference match", () => {
  const message = buildOrangeMoneyDepositSuccessMessage({
    autoApproved: true,
    claimOutcome: "stored_reference_matched",
    status: "approved",
  });

  assert.match(message, /شحن رصيدك تلقائيًا/u);
});

test("buildOrangeMoneyDepositSuccessMessage should describe a pending SMS wait", () => {
  const message = buildOrangeMoneyDepositSuccessMessage({
    autoApproved: false,
    claimOutcome: "pending_waiting_sms",
    status: "pending",
  });

  assert.match(message, /وصول رسالة Orange Money/u);
});

test("createDepositRequest should reject guests", async () => {
  await assert.rejects(
    () => createDepositRequest({ client: createAuthClient(), amount: 5, payerPhone: "0771234567" }),
    { message: LOGIN_REQUIRED_MESSAGE },
  );
});

test("createDepositRequest should reject amounts below the minimum", async () => {
  await assert.rejects(
    () => createDepositRequest({
      client: createAuthClient({ accessToken: "token-1" }),
      amount: 0,
      payerPhone: "0771234567",
    }),
    /الحد الأدنى للشحن/u,
  );
});

test("createDepositRequest should reject amounts above the maximum", async () => {
  await assert.rejects(
    () => createDepositRequest({
      client: createAuthClient({ accessToken: "token-1" }),
      amount: 10001,
      payerPhone: "0771234567",
    }),
    /الحد الأقصى للشحن/u,
  );
});

test("createDepositRequest should require the payer phone", async () => {
  await assert.rejects(
    () => createDepositRequest({
      client: createAuthClient({ accessToken: "token-1" }),
      amount: 10,
      payerPhone: "",
    }),
    { message: PAYER_PHONE_REQUIRED_MESSAGE },
  );
});

test("createDepositRequest should reject invalid reference ids", async () => {
  await assert.rejects(
    () => createDepositRequest({
      client: createAuthClient({ accessToken: "token-1" }),
      amount: 10,
      payerPhone: "0771234567",
      referenceId: "abc",
    }),
    { message: REFERENCE_ID_INVALID_MESSAGE },
  );
});

test("createDepositRequest should post one authenticated Orange Money request", async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "/api/deposits/orange-money");
    assert.equal(options.method, "POST");
    assert.equal(options.headers.Authorization, "Bearer token-1");
    assert.equal(options.headers["Content-Type"], "application/json");
    assert.equal(options.headers["Idempotency-Key"], "deposit-key-123");
    assert.deepEqual(JSON.parse(String(options.body)), {
      amount: 15,
      payerPhone: "+962771234567",
      referenceId: "ojm-100",
    });

    return Response.json({
      success: true,
      data: {
        autoApproved: true,
        claimOutcome: "stored_reference_matched",
        depositId: "dep-1",
        referenceId: "OJM-100",
        status: "approved",
        userId: "user-1",
      },
    }, { status: 201 });
  };

  const result = await createDepositRequest({
    client: createAuthClient({ accessToken: "token-1" }),
    idempotencyKey: "deposit-key-123",
    amount: "15",
    payerPhone: "+962771234567",
    referenceId: "ojm-100",
  });

  assert.deepEqual(result, {
    autoApproved: true,
    claimOutcome: "stored_reference_matched",
    depositId: "dep-1",
    referenceId: "OJM-100",
    status: "approved",
    userId: "user-1",
  });
});

test("createDepositRequest should generate an idempotency key when none is supplied", async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "/api/deposits/orange-money");
    assert.match(String(options.headers["Idempotency-Key"] || ""), /^[A-Za-z0-9_-]{8,128}$/u);

    return Response.json({
      success: true,
      data: {
        autoApproved: false,
        claimOutcome: "pending_waiting_sms",
        depositId: "dep-2",
        referenceId: "",
        status: "pending",
        userId: "user-2",
      },
    }, { status: 201 });
  };

  const result = await createDepositRequest({
    client: createAuthClient({ accessToken: "token-2" }),
    amount: 20,
    payerPhone: "0771234567",
  });

  assert.equal(result.depositId, "dep-2");
});

test("createDepositRequest should surface API failures", async () => {
  globalThis.fetch = async () => Response.json({
    success: false,
    error: "[DPG-107] لم نعثر على حوالة محفوظة بهذا الرقم المرجعي.",
  }, { status: 404 });

  await assert.rejects(
    () => createDepositRequest({
      client: createAuthClient({ accessToken: "token-1" }),
      amount: 5,
      payerPhone: "0771234567",
      referenceId: "OJM-404",
    }),
    /لم نعثر على حوالة محفوظة/u,
  );
});
