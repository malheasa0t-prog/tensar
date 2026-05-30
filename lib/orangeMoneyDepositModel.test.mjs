/**
 * Tests for Orange Money deposit validation helpers.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  LOGIN_REQUIRED_MESSAGE,
  PAYER_PHONE_INVALID_MESSAGE,
  PAYER_PHONE_REQUIRED_MESSAGE,
  PENDING_SMS_SUCCESS_MESSAGE,
  REFERENCE_ID_INVALID_MESSAGE,
  STORED_REFERENCE_SUCCESS_MESSAGE,
  buildOrangeMoneyDepositMetadata,
  buildOrangeMoneyDepositSuccessMessage,
  normalizeDepositPayerPhone,
  normalizeOrangeMoneyReferenceId,
  validateDepositPayerPhone,
  validateOrangeMoneyReferenceId,
} from "./orangeMoneyDepositModel.js";

test("LOGIN_REQUIRED_MESSAGE should expose the public auth copy", () => {
  assert.match(LOGIN_REQUIRED_MESSAGE, /تسجيل الدخول/u);
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

test("normalizeOrangeMoneyReferenceId should uppercase trimmed references", () => {
  assert.equal(normalizeOrangeMoneyReferenceId("  ojm-123-a  "), "OJM-123-A");
});

test("validateOrangeMoneyReferenceId should accept blank references", () => {
  assert.equal(validateOrangeMoneyReferenceId(""), "");
});

test("validateOrangeMoneyReferenceId should reject malformed references", () => {
  assert.equal(validateOrangeMoneyReferenceId("abc"), REFERENCE_ID_INVALID_MESSAGE);
});

test("buildOrangeMoneyDepositMetadata should include phone metadata and optional reference", () => {
  const metadata = buildOrangeMoneyDepositMetadata({
    payerPhone: "+962771234567",
    referenceId: "ojm-100",
    now: () => "2026-05-25T03:00:00.000Z",
  });

  assert.deepEqual(metadata, {
    orange_money_payer_phone: "0771234567",
    orange_money_payer_phone_tail: "71234567",
    orange_money_reference_id: "OJM-100",
    orange_money_requested_at: "2026-05-25T03:00:00.000Z",
  });
});

test("buildOrangeMoneyDepositSuccessMessage should describe approved stored claims", () => {
  assert.equal(
    buildOrangeMoneyDepositSuccessMessage({
      autoApproved: true,
      claimOutcome: "stored_reference_matched",
      status: "approved",
    }),
    STORED_REFERENCE_SUCCESS_MESSAGE,
  );
});

test("buildOrangeMoneyDepositSuccessMessage should describe pending requests", () => {
  assert.equal(
    buildOrangeMoneyDepositSuccessMessage({
      autoApproved: false,
      claimOutcome: "pending_waiting_sms",
      status: "pending",
    }),
    PENDING_SMS_SUCCESS_MESSAGE,
  );
});
