import assert from "node:assert/strict";
import test from "node:test";
import { formatCurrency, normalizeCurrencyAmount } from "./formatCurrency.js";

test("normalizeCurrencyAmount should keep finite numbers only", () => {
  assert.equal(normalizeCurrencyAmount("12.5"), 12.5);
  assert.equal(normalizeCurrencyAmount("nope"), 0);
});

test("formatCurrency should format Jordanian Dinar values with the shared symbol", () => {
  assert.equal(formatCurrency(15), "١٥٫٠٠ د.أ");
  assert.equal(formatCurrency(15.2), "١٥٫٢٠ د.أ");
});

test("formatCurrency should support symbol-less output", () => {
  assert.equal(formatCurrency(99.5, { showSymbol: false }), "٩٩٫٥٠");
});
