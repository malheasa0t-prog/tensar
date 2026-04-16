import assert from "node:assert/strict";
import test from "node:test";

import { mapProviderStatus, SYNCABLE_ORDER_STATUSES } from "./orderSync.mjs";

test("mapProviderStatus should translate provider statuses", () => {
  assert.equal(mapProviderStatus("completed"), "completed");
  assert.equal(mapProviderStatus("in-progress"), "in_progress");
  assert.equal(mapProviderStatus("refund"), "refunded");
  assert.equal(mapProviderStatus("unknown"), "processing");
});

test("SYNCABLE_ORDER_STATUSES should contain the pending sync states", () => {
  assert.deepEqual(SYNCABLE_ORDER_STATUSES, ["processing", "in_progress", "pending"]);
});
