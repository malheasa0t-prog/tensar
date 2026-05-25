import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCartStorageKey,
  parseStoredCartItems,
  resolveCartOwnerKey,
} from "./cartStorageModel.js";

test("resolveCartOwnerKey should isolate carts by authenticated user id", () => {
  assert.equal(resolveCartOwnerKey({ user: { id: "user-1" } }), "user:user-1");
  assert.equal(resolveCartOwnerKey(null), "guest");
});

test("buildCartStorageKey should create a per-owner storage key", () => {
  assert.equal(buildCartStorageKey("user:user-1"), "tz_next_cart:user:user-1");
  assert.equal(buildCartStorageKey(""), "tz_next_cart:guest");
});

test("parseStoredCartItems should return safe arrays only", () => {
  assert.deepEqual(parseStoredCartItems('[{"id":"p-1"},{"id":"p-2"}]'), [{ id: "p-1" }, { id: "p-2" }]);
  assert.deepEqual(parseStoredCartItems('{"id":"p-1"}'), []);
  assert.deepEqual(parseStoredCartItems("{"), []);
});
