import test from "node:test";
import assert from "node:assert/strict";
import { orangeMoneyPaymentMatcherTestHooks } from "./orangeMoneyPaymentMatcher.js";

test("withOrangeMoneyMetadata should preserve existing metadata", () => {
  const result = orangeMoneyPaymentMatcherTestHooks.withOrangeMoneyMetadata(
    { source: "checkout" },
    "OJM-PAY-1",
  );

  assert.equal(result.source, "checkout");
  assert.equal(result.orange_money_ref, "OJM-PAY-1");
  assert.match(result.orange_money_paid_at, /^\d{4}-\d{2}-\d{2}T/);
});

test("createMatchedResult should normalize optional fields", () => {
  const result = orangeMoneyPaymentMatcherTestHooks.createMatchedResult({
    targetId: "dep-1",
    targetType: "deposit",
  });

  assert.deepEqual(result, {
    matched: true,
    targetId: "dep-1",
    targetType: "deposit",
    transactionId: null,
    userId: null,
  });
});

test("getDepositMetadataPhoneTail should read the manually entered payer phone", () => {
  const result = orangeMoneyPaymentMatcherTestHooks.getDepositMetadataPhoneTail({
    orange_money_payer_phone: "+962771234567",
  });

  assert.equal(result, "71234567");
});

test("pickNewestCandidate should prefer the latest matching payment request", () => {
  const result = orangeMoneyPaymentMatcherTestHooks.pickNewestCandidate([
    { id: "old", created_at: "2026-05-25T01:00:00.000Z" },
    null,
    { id: "new", created_at: "2026-05-25T02:00:00.000Z" },
  ]);

  assert.equal(result.id, "new");
});

/**
 * Builds a minimal Supabase query-builder mock returning fixed deposit rows.
 *
 * @param {Array<Record<string, unknown>>} rows
 * @returns {{ from: () => object }}
 */
function buildDepositAdminMock(rows) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    limit: () => Promise.resolve({ data: rows }),
  };
  return { from: () => builder };
}

test("findMatchingDeposit prefers an exact reference-id match", async () => {
  const admin = buildDepositAdminMock([
    { id: "dep-a", user_id: "u1", created_at: "2026-05-25T02:00:00.000Z", metadata: { orange_money_payer_phone: "+962771234567", orange_money_reference_id: "REF-OTHER" } },
    { id: "dep-b", user_id: "u2", created_at: "2026-05-25T01:00:00.000Z", metadata: { orange_money_payer_phone: "+962770000000", orange_money_reference_id: "REF-MINE" } },
  ]);

  const result = await orangeMoneyPaymentMatcherTestHooks.findMatchingDeposit({
    admin,
    amount: 100,
    phone: "+962771234567",
    referenceId: "ref-mine",
  });

  assert.equal(result.id, "dep-b");
  assert.equal(result.matchType, "deposit");
});

test("findMatchingDeposit skips ambiguous amount+phone matches (no reference)", async () => {
  const admin = buildDepositAdminMock([
    { id: "dep-a", user_id: "u1", created_at: "2026-05-25T02:00:00.000Z", metadata: { orange_money_payer_phone: "+962771234567" } },
    { id: "dep-b", user_id: "u2", created_at: "2026-05-25T01:00:00.000Z", metadata: { orange_money_payer_phone: "+962771234567" } },
  ]);

  const result = await orangeMoneyPaymentMatcherTestHooks.findMatchingDeposit({
    admin,
    amount: 100,
    phone: "+962771234567",
    referenceId: "",
  });

  assert.equal(result, null);
});

test("findMatchingDeposit matches a single amount+phone deposit", async () => {
  const admin = buildDepositAdminMock([
    { id: "dep-a", user_id: "u1", created_at: "2026-05-25T02:00:00.000Z", metadata: { orange_money_payer_phone: "+962771234567" } },
    { id: "dep-b", user_id: "u2", created_at: "2026-05-25T01:00:00.000Z", metadata: { orange_money_payer_phone: "+962770000000" } },
  ]);

  const result = await orangeMoneyPaymentMatcherTestHooks.findMatchingDeposit({
    admin,
    amount: 100,
    phone: "+962771234567",
    referenceId: "",
  });

  assert.equal(result.id, "dep-a");
});
