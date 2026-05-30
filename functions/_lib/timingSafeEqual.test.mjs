import assert from "node:assert/strict";
import test from "node:test";

import { timingSafeEqualStrings } from "./timingSafeEqual.js";

test("timingSafeEqualStrings should return true for identical strings", () => {
  assert.equal(timingSafeEqualStrings("s3cr3t-token", "s3cr3t-token"), true);
});

test("timingSafeEqualStrings should return false for different strings of equal length", () => {
  assert.equal(timingSafeEqualStrings("s3cr3t-token", "s3cr3t-tokeX"), false);
});

test("timingSafeEqualStrings should return false for length mismatches", () => {
  assert.equal(timingSafeEqualStrings("short", "short-but-longer"), false);
  assert.equal(timingSafeEqualStrings("short-but-longer", "short"), false);
});

test("timingSafeEqualStrings should treat empty/nullish inputs safely", () => {
  assert.equal(timingSafeEqualStrings("", ""), true);
  assert.equal(timingSafeEqualStrings(null, ""), true);
  assert.equal(timingSafeEqualStrings(undefined, "x"), false);
  assert.equal(timingSafeEqualStrings("x", null), false);
});

test("timingSafeEqualStrings should handle multibyte (UTF-8) secrets", () => {
  assert.equal(timingSafeEqualStrings("سرّ-مميز", "سرّ-مميز"), true);
  assert.equal(timingSafeEqualStrings("سرّ-مميز", "سرّ-آخر"), false);
});
