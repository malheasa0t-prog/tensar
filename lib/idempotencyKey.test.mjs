import assert from "node:assert/strict";
import test from "node:test";
import {
  acquireSubmissionLock,
  createIdempotencyKey,
  createSubmissionState,
  releaseSubmissionLock,
  resetSubmissionIdempotencyKey,
  resolveSubmissionIdempotencyKey,
} from "./idempotencyKey.js";

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

test("createSubmissionState should create an unlocked empty container", () => {
  const state = createSubmissionState();

  assert.deepEqual(state, {
    fingerprint: "",
    idempotencyKey: "",
    locked: false,
  });
});

test("acquireSubmissionLock should prevent re-entrant submits until released", () => {
  const state = createSubmissionState();

  assert.equal(acquireSubmissionLock(state), true);
  assert.equal(acquireSubmissionLock(state), false);

  releaseSubmissionLock(state);

  assert.equal(acquireSubmissionLock(state), true);
});

test("resolveSubmissionIdempotencyKey should reuse the key for the same fingerprint", () => {
  const state = createSubmissionState();
  const firstKey = resolveSubmissionIdempotencyKey({
    state,
    fingerprint: '{"amount":25}',
  });
  const secondKey = resolveSubmissionIdempotencyKey({
    state,
    fingerprint: '{"amount":25}',
  });

  assert.match(firstKey, UUID_V4_PATTERN);
  assert.equal(firstKey, secondKey);
});

test("resolveSubmissionIdempotencyKey should rotate the key when the fingerprint changes", () => {
  const state = createSubmissionState();
  const firstKey = resolveSubmissionIdempotencyKey({
    state,
    fingerprint: '{"amount":25}',
  });
  const secondKey = resolveSubmissionIdempotencyKey({
    state,
    fingerprint: '{"amount":30}',
  });

  assert.notEqual(firstKey, secondKey);
});

test("resetSubmissionIdempotencyKey should clear the cached fingerprint and key", () => {
  const state = createSubmissionState();
  const firstKey = resolveSubmissionIdempotencyKey({
    state,
    fingerprint: '{"amount":25}',
  });

  resetSubmissionIdempotencyKey(state);

  assert.deepEqual(state, {
    fingerprint: "",
    idempotencyKey: "",
    locked: false,
  });

  const nextKey = resolveSubmissionIdempotencyKey({
    state,
    fingerprint: '{"amount":25}',
  });

  assert.match(nextKey, UUID_V4_PATTERN);
  assert.notEqual(firstKey, nextKey);
});
