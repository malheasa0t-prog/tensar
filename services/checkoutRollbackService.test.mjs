import test from "node:test";
import assert from "node:assert/strict";
import {
  CHECKOUT_ROLLBACK_ERROR_MESSAGE,
  deleteCheckoutOrder,
  rollbackCheckoutState,
} from "./checkoutRollbackService.js";

/**
 * Creates a minimal multi-table client for checkout rollback tests.
 *
 * @param {{
 *   productResponses?: Array<{ data?: { id?: string } | null, error?: Record<string, unknown> | null }>,
 *   orderResponses?: Array<{ data?: { id?: string } | null, error?: Record<string, unknown> | null }>,
 * }} [options]
 * @returns {{ calls: Array<{ table: string, payload?: Record<string, unknown>, filters: Record<string, unknown> }>, client: { from: (table: string) => any } }}
 */
function createCheckoutRollbackClient({ productResponses = [], orderResponses = [] } = {}) {
  const calls = [];
  const nextProductResponses = [...productResponses];
  const nextOrderResponses = [...orderResponses];

  return {
    calls,
    client: {
      from(table) {
        if (table === "products") {
          return {
            update(payload) {
              const filters = {};
              const chain = {
                eq(column, value) {
                  filters[column] = value;
                  return chain;
                },
                select(fields) {
                  assert.equal(fields, "id");
                  return chain;
                },
                async maybeSingle() {
                  calls.push({ table, payload, filters });
                  return nextProductResponses.shift() || { data: { id: filters.id }, error: null };
                },
              };
              return chain;
            },
          };
        }

        if (table === "orders") {
          return {
            delete() {
              const filters = {};
              const chain = {
                eq(column, value) {
                  filters[column] = value;
                  return chain;
                },
                select(fields) {
                  assert.equal(fields, "id");
                  return chain;
                },
                async maybeSingle() {
                  calls.push({ table, filters });
                  return nextOrderResponses.shift() || { data: { id: filters.id }, error: null };
                },
              };
              return chain;
            },
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      },
    },
  };
}

test("deleteCheckoutOrder should remove the order row and validate the deleted id", async () => {
  const { client, calls } = createCheckoutRollbackClient();

  await deleteCheckoutOrder({ orderId: "ord-1", client });

  assert.deepEqual(calls, [{ table: "orders", filters: { id: "ord-1" } }]);
});

test("deleteCheckoutOrder should throw when the rollback delete fails", async () => {
  const { client } = createCheckoutRollbackClient({
    orderResponses: [{ data: null, error: { message: "delete failed" } }],
  });

  await assert.rejects(
    () => deleteCheckoutOrder({ orderId: "ord-2", client }),
    new RegExp(CHECKOUT_ROLLBACK_ERROR_MESSAGE)
  );
});

test("rollbackCheckoutState should report a successful rollback when inventory and order deletion succeed", async () => {
  const { client } = createCheckoutRollbackClient();
  const result = await rollbackCheckoutState({
    orderId: "ord-3",
    appliedInventoryAdjustments: [
      {
        productId: "prd-1",
        previousQuantity: 5,
        nextQuantity: 4,
        previousSold: 2,
        nextSold: 3,
        previousStatus: "active",
        nextStatus: "active",
      },
    ],
    client,
  });

  assert.deepEqual(result, {
    ok: true,
    failedInventoryProductIds: [],
    orderDeleteFailed: false,
  });
});

test("rollbackCheckoutState should report inventory rollback failures without hiding them", async () => {
  const { client } = createCheckoutRollbackClient({
    productResponses: [{ data: null, error: { message: "restore failed" } }],
  });
  const result = await rollbackCheckoutState({
    orderId: "ord-4",
    appliedInventoryAdjustments: [
      {
        productId: "prd-2",
        previousQuantity: 6,
        nextQuantity: 3,
        previousSold: 0,
        nextSold: 3,
        previousStatus: "active",
        nextStatus: "active",
      },
    ],
    client,
  });

  assert.deepEqual(result, {
    ok: false,
    failedInventoryProductIds: ["prd-2"],
    orderDeleteFailed: false,
  });
});

test("rollbackCheckoutState should report order deletion failures explicitly", async () => {
  const { client } = createCheckoutRollbackClient({
    orderResponses: [{ data: null, error: { message: "delete failed" } }],
  });
  const result = await rollbackCheckoutState({
    orderId: "ord-5",
    appliedInventoryAdjustments: [],
    client,
  });

  assert.deepEqual(result, {
    ok: false,
    failedInventoryProductIds: [],
    orderDeleteFailed: true,
  });
});
