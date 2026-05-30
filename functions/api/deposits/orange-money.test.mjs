/**
 * Tests for the Orange Money deposit creation endpoint.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  CLAIM_REFERENCE_NOT_FOUND_MESSAGE,
} from "../../_lib/orangeMoneyStoredClaim.js";
import { createOrangeMoneyDepositHandlers, onRequestOptions } from "./orange-money.js";

const ORIGINAL_CONSOLE_ERROR = console.error;

test.afterEach(() => {
  console.error = ORIGINAL_CONSOLE_ERROR;
});

/**
 * Creates one Pages-style function context.
 *
 * @param {Request} request - Incoming request.
 * @param {Record<string, unknown>} [env={}] - Environment bindings.
 * @returns {{ env: Record<string, unknown>, request: Request }} Minimal route context.
 */
function createContext(request, env = {}) {
  return { env, request };
}

/**
 * Reads the JSON body from a route response.
 *
 * @param {Response} response - Function response.
 * @returns {Promise<Record<string, unknown>>} Parsed payload.
 */
async function readJson(response) {
  return response.json();
}

test("onRequestOptions should return the Orange Money deposit preflight response", () => {
  const response = onRequestOptions(createContext(new Request("https://tensar.systems/api/deposits/orange-money", {
    method: "OPTIONS",
    headers: { Origin: "https://tensar.pages.dev" },
  })));

  assert.equal(response.status, 204);
  assert.equal(response.headers.get("Access-Control-Allow-Methods"), "POST, OPTIONS");
});

test("createOrangeMoneyDepositHandlers should require an authenticated user", async () => {
  const handlers = createOrangeMoneyDepositHandlers({
    authenticateRequest: async () => ({ error: "[DPG-202] Unauthorized", user: null }),
  });

  const response = await handlers.onRequestPost(createContext(new Request("https://tensar.systems/api/deposits/orange-money", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://tensar.pages.dev",
    },
    body: JSON.stringify({ amount: 15, payerPhone: "0771234567" }),
  })));
  const payload = await readJson(response);

  assert.equal(response.status, 401);
  assert.equal(payload.success, false);
});

test("createOrangeMoneyDepositHandlers should create a pending deposit when no reference is provided", async () => {
  const handlers = createOrangeMoneyDepositHandlers({
    authenticateRequest: async () => ({ error: "", user: { id: "user-1" } }),
    createAdminClient: () => ({}),
    createPendingDeposit: async () => ({ id: "dep-1", metadata: {}, status: "pending" }),
    findDuplicatePendingDepositMessage: async () => "",
  });

  const response = await handlers.onRequestPost(createContext(new Request("https://tensar.systems/api/deposits/orange-money", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://tensar.pages.dev",
    },
    body: JSON.stringify({ amount: 15, payerPhone: "0771234567" }),
  })));
  const payload = await readJson(response);

  assert.equal(response.status, 201);
  assert.deepEqual(payload.data, {
    autoApproved: false,
    claimOutcome: "pending_waiting_sms",
    depositId: "dep-1",
    referenceId: "",
    status: "pending",
    userId: "user-1",
  });
});

test("createOrangeMoneyDepositHandlers should auto approve a valid stored reference claim", async () => {
  const finalizeCalls = [];
  const markCalls = [];
  const handlers = createOrangeMoneyDepositHandlers({
    authenticateRequest: async () => ({ error: "", user: { id: "user-1" } }),
    createAdminClient: () => ({}),
    createPendingDeposit: async () => ({ id: "dep-1", metadata: { source: "request" }, status: "pending" }),
    findDuplicatePendingDepositMessage: async () => "",
    finalizeLog: async (input) => {
      finalizeCalls.push(input);
      return new Response(null, { status: 200 });
    },
    markDepositApproved: async (input) => {
      markCalls.push(input);
    },
    reserveStoredClaimLog: async () => true,
    validateStoredClaim: async () => ({ error: "", log: { id: "log-1" } }),
    walletTopup: async () => "tx-1",
  });

  const response = await handlers.onRequestPost(createContext(new Request("https://tensar.systems/api/deposits/orange-money", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://tensar.pages.dev",
    },
    body: JSON.stringify({ amount: 15, payerPhone: "0771234567", referenceId: "OJM-100" }),
  })));
  const payload = await readJson(response);

  assert.equal(response.status, 201);
  assert.equal(payload.data.autoApproved, true);
  assert.equal(payload.data.claimOutcome, "stored_reference_matched");
  assert.equal(payload.data.referenceId, "OJM-100");
  assert.equal(markCalls.length, 1);
  assert.equal(finalizeCalls.length, 1);
  assert.equal(finalizeCalls[0].result.transactionId, "tx-1");
});

test("createOrangeMoneyDepositHandlers should reject unknown stored references before creating a deposit", async () => {
  let createPendingCalled = false;
  const handlers = createOrangeMoneyDepositHandlers({
    authenticateRequest: async () => ({ error: "", user: { id: "user-1" } }),
    createAdminClient: () => ({}),
    createPendingDeposit: async () => {
      createPendingCalled = true;
      return { id: "dep-1", metadata: {}, status: "pending" };
    },
    findDuplicatePendingDepositMessage: async () => "",
    validateStoredClaim: async () => ({ error: CLAIM_REFERENCE_NOT_FOUND_MESSAGE, log: null }),
  });

  const response = await handlers.onRequestPost(createContext(new Request("https://tensar.systems/api/deposits/orange-money", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://tensar.pages.dev",
    },
    body: JSON.stringify({ amount: 15, payerPhone: "0771234567", referenceId: "OJM-404" }),
  })));
  const payload = await readJson(response);

  assert.equal(response.status, 404);
  assert.equal(payload.error, CLAIM_REFERENCE_NOT_FOUND_MESSAGE);
  assert.equal(createPendingCalled, false);
});

test("createOrangeMoneyDepositHandlers should reject duplicate pending deposit requests", async () => {
  let createPendingCalled = false;
  const handlers = createOrangeMoneyDepositHandlers({
    authenticateRequest: async () => ({ error: "", user: { id: "user-1" } }),
    createAdminClient: () => ({}),
    createPendingDeposit: async () => {
      createPendingCalled = true;
      return { id: "dep-1", metadata: {}, status: "pending" };
    },
    findDuplicatePendingDepositMessage: async () =>
      "[DPG-106] لديك بالفعل طلب إيداع معلق بنفس المبلغ ورقم الهاتف.",
  });

  const response = await handlers.onRequestPost(createContext(new Request("https://tensar.systems/api/deposits/orange-money", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://tensar.pages.dev",
    },
    body: JSON.stringify({ amount: 15, payerPhone: "0771234567" }),
  })));
  const payload = await readJson(response);

  assert.equal(response.status, 409);
  assert.equal(payload.success, false);
  assert.equal(createPendingCalled, false);
});

test("createOrangeMoneyDepositHandlers should delete the pending deposit when reservation loses a race", async () => {
  const deletedDepositIds = [];
  const handlers = createOrangeMoneyDepositHandlers({
    authenticateRequest: async () => ({ error: "", user: { id: "user-1" } }),
    createAdminClient: () => ({}),
    createPendingDeposit: async () => ({ id: "dep-race", metadata: {}, status: "pending" }),
    deletePendingDeposit: async (input) => {
      deletedDepositIds.push(input.depositId);
    },
    findDuplicatePendingDepositMessage: async () => "",
    reserveStoredClaimLog: async () => false,
    validateStoredClaim: async () => ({ error: "", log: { id: "log-race" } }),
  });

  const response = await handlers.onRequestPost(createContext(new Request("https://tensar.systems/api/deposits/orange-money", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://tensar.pages.dev",
    },
    body: JSON.stringify({ amount: 15, payerPhone: "0771234567", referenceId: "OJM-RACE" }),
  })));
  const payload = await readJson(response);

  assert.equal(response.status, 409);
  assert.equal(payload.success, false);
  assert.deepEqual(deletedDepositIds, ["dep-race"]);
});

test("createOrangeMoneyDepositHandlers should release the reservation and delete the deposit when wallet crediting fails", async () => {
  const deletedDepositIds = [];
  const releasedReservations = [];
  const handlers = createOrangeMoneyDepositHandlers({
    authenticateRequest: async () => ({ error: "", user: { id: "user-1" } }),
    createAdminClient: () => ({}),
    createPendingDeposit: async () => ({ id: "dep-fail", metadata: {}, status: "pending" }),
    deletePendingDeposit: async (input) => {
      deletedDepositIds.push(input.depositId);
    },
    findDuplicatePendingDepositMessage: async () => "",
    releaseStoredClaimLog: async (input) => {
      releasedReservations.push(input);
    },
    reserveStoredClaimLog: async () => true,
    validateStoredClaim: async () => ({ error: "", log: { id: "log-fail" } }),
    walletTopup: async () => {
      throw new Error("[SMS-503] فشل شحن المحفظة عبر Orange Money.");
    },
  });

  const response = await handlers.onRequestPost(createContext(new Request("https://tensar.systems/api/deposits/orange-money", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://tensar.pages.dev",
    },
    body: JSON.stringify({ amount: 15, payerPhone: "0771234567", referenceId: "OJM-TOPUP-FAIL" }),
  })));
  const payload = await readJson(response);

  assert.equal(response.status, 500);
  assert.equal(payload.success, false);
  assert.deepEqual(deletedDepositIds, ["dep-fail"]);
  assert.deepEqual(releasedReservations, [{
    admin: {},
    depositId: "dep-fail",
    logId: "log-fail",
  }]);
});

test("createOrangeMoneyDepositHandlers should keep the reservation when approval finalization fails after wallet crediting", async () => {
  console.error = () => {};
  const deletedDepositIds = [];
  const releasedReservations = [];
  const handlers = createOrangeMoneyDepositHandlers({
    authenticateRequest: async () => ({ error: "", user: { id: "user-1" } }),
    createAdminClient: () => ({}),
    createPendingDeposit: async () => ({ id: "dep-final", metadata: {}, status: "pending" }),
    deletePendingDeposit: async (input) => {
      deletedDepositIds.push(input.depositId);
    },
    findDuplicatePendingDepositMessage: async () => "",
    markDepositApproved: async () => {
      throw new Error("[DPG-304] تعذر اعتماد الحوالة المحفوظة تلقائيًا.");
    },
    releaseStoredClaimLog: async (input) => {
      releasedReservations.push(input);
    },
    reserveStoredClaimLog: async () => true,
    validateStoredClaim: async () => ({ error: "", log: { id: "log-final" } }),
    walletTopup: async () => "tx-final",
  });

  const response = await handlers.onRequestPost(createContext(new Request("https://tensar.systems/api/deposits/orange-money", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://tensar.pages.dev",
    },
    body: JSON.stringify({ amount: 15, payerPhone: "0771234567", referenceId: "OJM-FINAL" }),
  })));
  const payload = await readJson(response);

  assert.equal(response.status, 500);
  assert.equal(payload.success, false);
  assert.deepEqual(deletedDepositIds, []);
  assert.deepEqual(releasedReservations, []);
});
