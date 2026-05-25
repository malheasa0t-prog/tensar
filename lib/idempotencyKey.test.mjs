import assert from "node:assert/strict";
import test from "node:test";
import { createIdempotencyKey } from "./idempotencyKey.js";

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test("createIdempotencyKey should return a UUID v4 value", () => {
  const key = createIdempotencyKey();

  assert.match(key, UUID_V4_PATTERN);
});

test("createIdempotencyKey should return unique values for repeated calls", () => {
  const keys = new Set(Array.from({ length: 20 }, () => createIdempotencyKey()));

  assert.equal(keys.size, 20);
});
