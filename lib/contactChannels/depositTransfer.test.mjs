import test from "node:test";
import assert from "node:assert/strict";
import {
  hasDepositTransferDetails,
  normalizeDepositTransferSettings,
} from "./depositTransfer.js";

test("normalizeDepositTransferSettings should normalize alternate field names", () => {
  const result = normalizeDepositTransferSettings(
    {
      bank: "البنك العربي",
      accountName: "TechZone Store",
      accountNumber: "JO00 TEST 1234",
      note: "أرسل صورة التحويل بعد الدفع.",
    },
    "Fallback Name"
  );

  assert.deepEqual(result, {
    bankName: "البنك العربي",
    accountHolder: "TechZone Store",
    iban: "JO00 TEST 1234",
    instructions: "أرسل صورة التحويل بعد الدفع.",
  });
});

test("normalizeDepositTransferSettings should fall back to the provided account holder", () => {
  const result = normalizeDepositTransferSettings({}, "TechZone");

  assert.equal(result.accountHolder, "TechZone");
  assert.equal(result.bankName, "");
  assert.equal(result.iban, "");
});

test("hasDepositTransferDetails should require both bank name and iban", () => {
  assert.equal(hasDepositTransferDetails({ bankName: "البنك العربي", iban: "JO00 TEST 1234" }), true);
  assert.equal(hasDepositTransferDetails({ bankName: "البنك العربي" }), false);
  assert.equal(hasDepositTransferDetails(null), false);
});
