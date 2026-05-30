/**
 * Tests for Orange Money log reuse protections.
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  createOrReuseOrangeMoneyLog,
  orangeMoneyLogsTestHooks,
} from "./orangeMoneyLogs.js";

/**
 * Creates one admin stub for Orange Money log operations.
 *
 * @param {{ existingLog?: Record<string, unknown> | null, insertedLogId?: string, onUpdate?: (patch: Record<string, unknown>) => void }} [options={}] - Stub options.
 * @returns {Record<string, unknown>} Supabase-like admin stub.
 */
function createAdminStub(options = {}) {
  const existingLog = options.existingLog ?? null;
  const insertedLogId = options.insertedLogId || "log-new";

  return {
    from(tableName) {
      assert.equal(tableName, "orange_money_logs");
      return {
        insert(rows) {
          return {
            select(columnName) {
              assert.equal(columnName, "id");
              assert.equal(rows[0].status, "received");
              return {
                async maybeSingle() {
                  return { data: { id: insertedLogId }, error: null };
                },
              };
            },
          };
        },
        select(columns) {
          if (columns === "*") {
            return {
              eq(columnName, value) {
                assert.equal(columnName, "reference_id");
                assert.match(String(value), /^OJM/u);
                return {
                  async maybeSingle() {
                    return { data: existingLog, error: null };
                  },
                };
              },
            };
          }

          return {
            async maybeSingle() {
              return { data: { id: insertedLogId }, error: null };
            },
          };
        },
        update(patch) {
          options.onUpdate?.(patch);
          return {
            async eq(columnName, value) {
              assert.equal(columnName, "id");
              assert.ok(value);
              return { error: null };
            },
          };
        },
      };
    },
  };
}

test("isReservedOrFinalOrangeMoneyLog should flag reserved and processed logs", () => {
  assert.equal(orangeMoneyLogsTestHooks.isReservedOrFinalOrangeMoneyLog(null), false);
  assert.equal(orangeMoneyLogsTestHooks.isReservedOrFinalOrangeMoneyLog({ status: "processed" }), true);
  assert.equal(orangeMoneyLogsTestHooks.isReservedOrFinalOrangeMoneyLog({ status: "received", target_id: "dep-1" }), true);
  assert.equal(orangeMoneyLogsTestHooks.isReservedOrFinalOrangeMoneyLog({ status: "received", wallet_transaction_id: "tx-1" }), true);
  assert.equal(orangeMoneyLogsTestHooks.isReservedOrFinalOrangeMoneyLog({ status: "received" }), false);
});

test("createOrReuseOrangeMoneyLog should treat reserved logs as duplicates", async () => {
  const result = await createOrReuseOrangeMoneyLog({
    admin: createAdminStub({
      existingLog: { id: "log-1", status: "received", target_id: "dep-1" },
    }),
    amount: 15,
    normalizedPhone: "0771234567",
    phone: "0771234567",
    referenceId: "OJM-LOCKED",
    sender: "OrangeMoney",
    text: "sms",
  });

  assert.deepEqual(result, { duplicate: true, logId: "log-1" });
});

test("createOrReuseOrangeMoneyLog should reuse unmatched logs safely", async () => {
  const updates = [];
  const result = await createOrReuseOrangeMoneyLog({
    admin: createAdminStub({
      existingLog: { id: "log-2", status: "unmatched" },
      onUpdate(patch) {
        updates.push(patch);
      },
    }),
    amount: 15,
    normalizedPhone: "0771234567",
    phone: "0771234567",
    referenceId: "OJM-RETRY",
    sender: "OrangeMoney",
    text: "sms",
  });

  assert.deepEqual(result, { duplicate: false, logId: "log-2" });
  assert.equal(updates.length, 1);
  assert.equal(updates[0].status, "received");
});

test("createOrReuseOrangeMoneyLog should insert a new log when the reference is unseen", async () => {
  const result = await createOrReuseOrangeMoneyLog({
    admin: createAdminStub({ existingLog: null, insertedLogId: "log-3" }),
    amount: 15,
    normalizedPhone: "0771234567",
    phone: "0771234567",
    referenceId: "OJM-NEW",
    sender: "OrangeMoney",
    text: "sms",
  });

  assert.deepEqual(result, { duplicate: false, logId: "log-3" });
});
