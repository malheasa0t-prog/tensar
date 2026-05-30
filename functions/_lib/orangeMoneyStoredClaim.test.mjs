/**
 * Tests for deferred Orange Money stored-claim helpers.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  CLAIM_REFERENCE_ALREADY_USED_MESSAGE,
  CLAIM_REFERENCE_EXPIRED_MESSAGE,
  CLAIM_REFERENCE_MISMATCH_MESSAGE,
  CLAIM_REFERENCE_NOT_FOUND_MESSAGE,
  orangeMoneyStoredClaimTestHooks,
} from "./orangeMoneyStoredClaim.js";

test("buildStoredClaimCutoffIso should default to a 24-hour claim window", () => {
  const cutoff = orangeMoneyStoredClaimTestHooks.buildStoredClaimCutoffIso({
    now: Date.parse("2026-05-25T12:00:00.000Z"),
  });

  assert.equal(cutoff, "2026-05-24T12:00:00.000Z");
});

test("getStoredClaimValidationMessage should reject missing references", () => {
  const result = orangeMoneyStoredClaimTestHooks.getStoredClaimValidationMessage({
    amount: 15,
    cutoffIso: "2026-05-24T12:00:00.000Z",
    log: null,
    normalizedPhone: "0771234567",
  });

  assert.equal(result, CLAIM_REFERENCE_NOT_FOUND_MESSAGE);
});

test("getStoredClaimValidationMessage should reject used logs", () => {
  const result = orangeMoneyStoredClaimTestHooks.getStoredClaimValidationMessage({
    amount: 15,
    cutoffIso: "2026-05-24T12:00:00.000Z",
    log: {
      amount: 15,
      created_at: "2026-05-25T11:00:00.000Z",
      normalized_phone: "0771234567",
      status: "processed",
    },
    normalizedPhone: "0771234567",
  });

  assert.equal(result, CLAIM_REFERENCE_ALREADY_USED_MESSAGE);
});

test("getStoredClaimValidationMessage should reject amount or phone mismatches", () => {
  const result = orangeMoneyStoredClaimTestHooks.getStoredClaimValidationMessage({
    amount: 15,
    cutoffIso: "2026-05-24T12:00:00.000Z",
    log: {
      amount: 10,
      created_at: "2026-05-25T11:00:00.000Z",
      normalized_phone: "0779999999",
      status: "unmatched",
    },
    normalizedPhone: "0771234567",
  });

  assert.equal(result, CLAIM_REFERENCE_MISMATCH_MESSAGE);
});

test("getStoredClaimValidationMessage should reject expired logs", () => {
  const result = orangeMoneyStoredClaimTestHooks.getStoredClaimValidationMessage({
    amount: 15,
    cutoffIso: "2026-05-24T12:00:00.000Z",
    log: {
      amount: 15,
      created_at: "2026-05-24T11:59:59.000Z",
      normalized_phone: "0771234567",
      status: "unmatched",
    },
    normalizedPhone: "0771234567",
  });

  assert.equal(result, CLAIM_REFERENCE_EXPIRED_MESSAGE);
});

test("getStoredClaimValidationMessage should accept one exact unmatched stored log", () => {
  const result = orangeMoneyStoredClaimTestHooks.getStoredClaimValidationMessage({
    amount: 15,
    cutoffIso: "2026-05-24T12:00:00.000Z",
    log: {
      amount: 15,
      created_at: "2026-05-25T11:00:00.000Z",
      normalized_phone: "0771234567",
      status: "unmatched",
    },
    normalizedPhone: "0771234567",
  });

  assert.equal(result, "");
});
