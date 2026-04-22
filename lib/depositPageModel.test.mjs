import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_DEPOSIT_AMOUNT_MESSAGE,
  MIN_DEPOSIT_AMOUNT_MESSAGE,
  buildDepositProofObjectPath,
  validateDepositAmount,
} from "./depositPageModel.js";

test("validateDepositAmount should reject invalid deposit values", () => {
  assert.equal(validateDepositAmount("not-a-number"), "[DPG-101] مبلغ الشحن غير صالح.");
});

test("validateDepositAmount should reject amounts below the minimum", () => {
  assert.equal(validateDepositAmount(0), MIN_DEPOSIT_AMOUNT_MESSAGE);
});

test("validateDepositAmount should reject amounts above the maximum", () => {
  assert.equal(validateDepositAmount(10001), MAX_DEPOSIT_AMOUNT_MESSAGE);
});

test("validateDepositAmount should accept values within the allowed range", () => {
  assert.equal(validateDepositAmount(250), "");
});

test("buildDepositProofObjectPath should build a per-user path with a normalized extension", () => {
  const result = buildDepositProofObjectPath({
    userId: "user-1",
    fileName: "receipt.PNG",
    now: 1700000000000,
  });

  assert.equal(result, "user-1/1700000000000.png");
});

test("buildDepositProofObjectPath should fall back to a safe extension", () => {
  const result = buildDepositProofObjectPath({
    userId: "user-2",
    fileName: "receipt",
    now: 5,
  });

  assert.equal(result, "user-2/5.jpg");
});

test("buildDepositProofObjectPath should reject missing user ids", async () => {
  assert.throws(
    () => buildDepositProofObjectPath({ userId: "", fileName: "proof.jpg" }),
    /\[DPG-102\]/
  );
});
