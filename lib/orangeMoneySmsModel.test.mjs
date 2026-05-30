import test from "node:test";
import assert from "node:assert/strict";
import {
  getPhoneSearchTail,
  isIncomingOrangeMoneyTransfer,
  isOrangeMoneySender,
  normalizePhoneForSearch,
  parseOrangeMoneySms,
} from "./orangeMoneySmsModel.js";

test("parseOrangeMoneySms should extract Arabic amount phone and reference", () => {
  const sms =
    "تم استقبال حوالة مالية بمبلغ 15.50 دينار من 0771234567 من ID محفظة بالرقم المرجعي OJM-PAY-20260523163225130240";

  assert.deepEqual(parseOrangeMoneySms(sms), {
    amount: 15.5,
    phone: "0771234567",
    referenceId: "OJM-PAY-20260523163225130240",
  });
});

test("parseOrangeMoneySms should extract the alternate Orange Money wording", () => {
  const sms =
    "تم استقبال حوالة مالية من 00962776194223 من مزود الخدمة: Orange Money إلى محفظتك بمبلغ 10 دينار بتاريخ 23/05/2026 بالرقم المرجعي OJM-PAY-ABC-123";

  assert.deepEqual(parseOrangeMoneySms(sms), {
    amount: 10,
    phone: "00962776194223",
    referenceId: "OJM-PAY-ABC-123",
  });
});

test("parseOrangeMoneySms should return null fields when values are missing", () => {
  assert.deepEqual(parseOrangeMoneySms("رسالة عادية"), {
    amount: null,
    phone: null,
    referenceId: null,
  });
});

test("normalizePhoneForSearch should normalize Jordanian phone prefixes", () => {
  assert.equal(normalizePhoneForSearch("+962771234567"), "0771234567");
  assert.equal(normalizePhoneForSearch("00962771234567"), "0771234567");
  assert.equal(normalizePhoneForSearch("962771234567"), "0771234567");
  assert.equal(normalizePhoneForSearch("771234567"), "0771234567");
});

test("getPhoneSearchTail should return the matching suffix", () => {
  assert.equal(getPhoneSearchTail("+962771234567"), "1234567".padStart(8, "7"));
  assert.equal(getPhoneSearchTail("123"), "");
});

test("incoming transfer and sender checks should classify SMS safely", () => {
  assert.equal(isOrangeMoneySender("OrangeMoney"), true);
  assert.equal(isOrangeMoneySender("Bank"), false);
  assert.equal(isIncomingOrangeMoneyTransfer("تم استقبال حوالة مالية بمبلغ 1 دينار"), true);
  assert.equal(isIncomingOrangeMoneyTransfer("رمز تحقق"), false);
});
