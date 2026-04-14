import test from "node:test";
import assert from "node:assert/strict";
import { validateCartChange } from "./cartAvailabilityModel.js";

test("validateCartChange should allow active products without an explicit stock limit", () => {
  const result = validateCartChange({
    product: { id: "p-1", status: "active" },
    nextQty: 1,
  });

  assert.deepEqual(result, {
    ok: true,
    message: "",
    availableStock: null,
  });
});

test("validateCartChange should reject inactive products", () => {
  const result = validateCartChange({
    product: { id: "p-2", status: "hidden", quantity: 5 },
    nextQty: 1,
  });

  assert.equal(result.ok, false);
  assert.equal(result.message, "هذا المنتج غير متاح حالياً.");
});

test("validateCartChange should reject products with no stock", () => {
  const result = validateCartChange({
    product: { id: "p-3", status: "active", quantity: 0 },
    nextQty: 1,
  });

  assert.equal(result.ok, false);
  assert.equal(result.message, "نفد مخزون هذا المنتج حالياً.");
});

test("validateCartChange should reject quantities that exceed stock", () => {
  const result = validateCartChange({
    product: { id: "p-4", status: "active", quantity: 2 },
    nextQty: 3,
  });

  assert.equal(result.ok, false);
  assert.equal(result.message, "الكمية المتاحة حالياً هي 2 فقط.");
  assert.equal(result.availableStock, 2);
});

test("validateCartChange should accept quantities within stock", () => {
  const result = validateCartChange({
    product: { id: "p-5", status: "active", quantity: "4" },
    nextQty: 3,
  });

  assert.deepEqual(result, {
    ok: true,
    message: "",
    availableStock: 4,
  });
});

test("validateCartChange should reject quantities above the per-item cart limit", () => {
  const result = validateCartChange({
    product: { id: "p-6", status: "active", quantity: 500 },
    nextQty: 100,
  });

  assert.equal(result.ok, false);
  assert.equal(result.message, "الحد الأقصى للكمية في السلة هو 99.");
  assert.equal(result.availableStock, null);
});

test("validateCartChange should allow quantities up to the per-item cart limit", () => {
  const result = validateCartChange({
    product: { id: "p-7", status: "active", quantity: 500 },
    nextQty: 99,
  });

  assert.deepEqual(result, {
    ok: true,
    message: "",
    availableStock: 500,
  });
});
