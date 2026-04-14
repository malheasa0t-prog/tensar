import assert from "node:assert/strict";
import test from "node:test";
import {
  COMPARISON_MAX_ITEMS,
  normalizeComparisonEntry,
  parseComparisonEntries,
  toggleComparisonEntry,
} from "./comparisonModel.js";

test("normalizeComparisonEntry should reject incomplete payloads", () => {
  assert.equal(normalizeComparisonEntry({ name: "بدون معرف" }), null);
});

test("parseComparisonEntries should keep unique valid entries only", () => {
  const entries = parseComparisonEntries(
    JSON.stringify([
      { id: "p1", name: "منتج 1" },
      { id: "p1", name: "منتج 1 مكرر" },
      { id: "p2", name: "منتج 2" },
    ])
  );

  assert.equal(entries.length, 2);
  assert.deepEqual(
    entries.map((entry) => entry.id),
    ["p1", "p2"]
  );
});

test("toggleComparisonEntry should add a new product", () => {
  const result = toggleComparisonEntry([], { id: "p1", name: "منتج 1" });

  assert.equal(result.isCompared, true);
  assert.equal(result.entries.length, 1);
});

test("toggleComparisonEntry should remove an existing product", () => {
  const result = toggleComparisonEntry([{ id: "p1", name: "منتج 1" }], { id: "p1", name: "منتج 1" });

  assert.equal(result.isCompared, false);
  assert.equal(result.entries.length, 0);
});

test("toggleComparisonEntry should stop adding when the limit is reached", () => {
  const entries = Array.from({ length: COMPARISON_MAX_ITEMS }, (_, index) => ({
    id: `p${index + 1}`,
    name: `منتج ${index + 1}`,
  }));
  const result = toggleComparisonEntry(entries, { id: "overflow", name: "منتج زائد" });

  assert.equal(result.isAtLimit, true);
  assert.equal(result.entries.length, COMPARISON_MAX_ITEMS);
});
