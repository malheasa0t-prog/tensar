import test from "node:test";
import assert from "node:assert/strict";
import {
  applyInventoryAdjustments,
  buildInventoryAdjustments,
  INVENTORY_CONFLICT_ERROR_MESSAGE,
  INVENTORY_UPDATE_ERROR_MESSAGE,
  rollbackInventoryAdjustments,
} from "./checkoutInventoryService.js";

/**
 * Creates a mock Supabase client for optimistic product updates.
 *
 * @param {{ responses?: Array<{ data?: { id?: string } | null, error?: Record<string, unknown> | null }> }} [options]
 * @returns {{ calls: Array<{ payload: Record<string, unknown>, filters: Record<string, unknown> }>, client: { from: (table: string) => { update: (payload: Record<string, unknown>) => { eq: (column: string, value: unknown) => any, select: (fields: string) => any, maybeSingle: () => Promise<{ data?: { id?: string } | null, error?: Record<string, unknown> | null }> } } } }}
 */
function createInventoryClient({ responses = [] } = {}) {
  const calls = [];
  const queue = [...responses];

  return {
    calls,
    client: {
      from(table) {
        assert.equal(table, "products");
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
                calls.push({ payload, filters });
                return queue.shift() || { data: { id: filters.id }, error: null };
              },
            };
            return chain;
          },
        };
      },
    },
  };
}

test("buildInventoryAdjustments should derive the next quantity and sold counters", () => {
  const adjustments = buildInventoryAdjustments({
    products: [{ id: "p-1", quantity: 4, sold: 2, status: "active" }],
    aggregatedItems: [{ id: "p-1", qty: 3 }],
  });

  assert.deepEqual(adjustments, [
    {
      productId: "p-1",
      previousQuantity: 4,
      nextQuantity: 1,
      previousSold: 2,
      nextSold: 5,
      previousStatus: "active",
      nextStatus: "active",
    },
  ]);
});

test("buildInventoryAdjustments should mark the product out of stock when the last item is sold", () => {
  const adjustments = buildInventoryAdjustments({
    products: [{ id: "p-2", quantity: 1, sold: 7, status: "active" }],
    aggregatedItems: [{ id: "p-2", qty: 1 }],
  });

  assert.equal(adjustments[0].nextStatus, "out_of_stock");
});

test("buildInventoryAdjustments should reject quantities that are no longer available", () => {
  assert.throws(
    () =>
      buildInventoryAdjustments({
        products: [{ id: "p-3", quantity: 1, sold: 0, status: "active" }],
        aggregatedItems: [{ id: "p-3", qty: 2 }],
      }),
    { message: INVENTORY_CONFLICT_ERROR_MESSAGE }
  );
});

test("applyInventoryAdjustments should update every product with optimistic filters", async () => {
  const { client, calls } = createInventoryClient();
  const adjustments = [
    {
      productId: "p-4",
      previousQuantity: 5,
      nextQuantity: 3,
      previousSold: 1,
      nextSold: 3,
      previousStatus: "active",
      nextStatus: "active",
    },
  ];

  const result = await applyInventoryAdjustments({ adjustments, client });

  assert.deepEqual(result, adjustments);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].payload.quantity, 3);
  assert.equal(calls[0].payload.sold, 3);
  assert.equal(calls[0].filters.quantity, 5);
  assert.equal(calls[0].filters.sold, 1);
  assert.equal(calls[0].filters.status, "active");
});

test("applyInventoryAdjustments should raise a conflict when an optimistic update touches no rows", async () => {
  const { client } = createInventoryClient({ responses: [{ data: null, error: null }] });

  await assert.rejects(
    () =>
      applyInventoryAdjustments({
        adjustments: [
          {
            productId: "p-5",
            previousQuantity: 2,
            nextQuantity: 1,
            previousSold: 0,
            nextSold: 1,
            previousStatus: "active",
            nextStatus: "active",
          },
        ],
        client,
      }),
    { message: INVENTORY_CONFLICT_ERROR_MESSAGE }
  );
});

test("applyInventoryAdjustments should surface database update errors", async () => {
  const { client } = createInventoryClient({ responses: [{ data: null, error: { message: "db failed" } }] });

  await assert.rejects(
    () =>
      applyInventoryAdjustments({
        adjustments: [
          {
            productId: "p-6",
            previousQuantity: 2,
            nextQuantity: 1,
            previousSold: 0,
            nextSold: 1,
            previousStatus: "active",
            nextStatus: "active",
          },
        ],
        client,
      }),
    { message: INVENTORY_UPDATE_ERROR_MESSAGE }
  );
});

test("rollbackInventoryAdjustments should restore previous values in reverse order", async () => {
  const { client, calls } = createInventoryClient();

  const result = await rollbackInventoryAdjustments({
    adjustments: [
      {
        productId: "p-7",
        previousQuantity: 5,
        nextQuantity: 4,
        previousSold: 1,
        nextSold: 2,
        previousStatus: "active",
        nextStatus: "active",
      },
      {
        productId: "p-8",
        previousQuantity: 1,
        nextQuantity: 0,
        previousSold: 3,
        nextSold: 4,
        previousStatus: "active",
        nextStatus: "out_of_stock",
      },
    ],
    client,
  });

  assert.deepEqual(result, []);
  assert.deepEqual(
    calls.map((call) => call.filters.id),
    ["p-8", "p-7"]
  );
  assert.equal(calls[0].payload.quantity, 1);
  assert.equal(calls[0].payload.status, "active");
});

test("rollbackInventoryAdjustments should return the products that failed to restore", async () => {
  const { client } = createInventoryClient({
    responses: [{ data: null, error: { message: "restore failed" } }],
  });

  const result = await rollbackInventoryAdjustments({
    adjustments: [
      {
        productId: "p-9",
        previousQuantity: 2,
        nextQuantity: 1,
        previousSold: 0,
        nextSold: 1,
        previousStatus: "active",
        nextStatus: "active",
      },
    ],
    client,
  });

  assert.deepEqual(result, ["p-9"]);
});
