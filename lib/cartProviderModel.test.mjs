import assert from "node:assert/strict";
import test from "node:test";
import { getCartProductIds, toCartNumber } from "./cartProviderModel.js";

test("getCartProductIds should return trimmed non-empty cart ids", () => {
  assert.deepEqual(
    getCartProductIds([{ id: " p-1 " }, { id: "" }, { name: "missing" }, { id: "p-2" }]),
    ["p-1", "p-2"]
  );
});

test("getCartProductIds should return an empty list for invalid carts", () => {
  assert.deepEqual(getCartProductIds(null), []);
});

test("toCartNumber should normalize finite numbers and numeric strings", () => {
  assert.equal(toCartNumber(12), 12);
  assert.equal(toCartNumber("1,250.50"), 1250.5);
  assert.equal(toCartNumber(Number.NaN), 0);
  assert.equal(toCartNumber("not a number"), 0);
});
