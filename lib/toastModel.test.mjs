import assert from "node:assert/strict";
import test from "node:test";
import {
  TOAST_DEFAULT_DURATION,
  normalizeToastDuration,
  normalizeToastPayload,
  normalizeToastType,
} from "./toastModel.js";

test("normalizeToastDuration should clamp to the allowed range", () => {
  assert.equal(normalizeToastDuration(50), 1800);
  assert.equal(normalizeToastDuration(12000), 9000);
});

test("normalizeToastDuration should fall back when the value is invalid", () => {
  assert.equal(normalizeToastDuration("oops"), TOAST_DEFAULT_DURATION);
});

test("normalizeToastType should keep only supported variants", () => {
  assert.equal(normalizeToastType("success"), "success");
  assert.equal(normalizeToastType("custom"), "info");
});

test("normalizeToastPayload should support the legacy numeric duration signature", () => {
  const payload = normalizeToastPayload("تم الحفظ", 2500);

  assert.equal(payload.message, "تم الحفظ");
  assert.equal(payload.duration, 2500);
  assert.equal(payload.type, "info");
});

test("normalizeToastPayload should resolve icon and title from the variant", () => {
  const payload = normalizeToastPayload("حدث خطأ", { type: "error", duration: 4800 });

  assert.equal(payload.type, "error");
  assert.equal(payload.icon, "circle-alert");
  assert.equal(payload.title, "خطأ");
  assert.equal(payload.duration, 4800);
});
