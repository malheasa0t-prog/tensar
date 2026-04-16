import assert from "node:assert/strict";
import test from "node:test";

import { validateProfileInput } from "./profile.mjs";

test("validateProfileInput should normalize valid values", () => {
  const result = validateProfileInput({
    full_name: "  Test User  ",
    phone: "  +962700000000  ",
    preferred_currency: "",
    preferred_language: ""
  });

  assert.deepEqual(result.errors, []);
  assert.equal(result.payload.full_name, "Test User");
  assert.equal(result.payload.phone, "+962700000000");
  assert.equal(result.payload.preferred_currency, "JOD");
  assert.equal(result.payload.preferred_language, "ar");
});

test("validateProfileInput should reject invalid phone numbers", () => {
  const result = validateProfileInput({ phone: "bad-number" });
  assert.equal(result.errors[0], "رقم الهاتف غير صالح");
});
