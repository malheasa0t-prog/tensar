import test from "node:test";
import assert from "node:assert/strict";
import { fetchCartProductSnapshots } from "./cartService.js";

/**
 * Creates a minimal cart query client for unit tests.
 *
 * @param {{ data?: Array<Record<string, unknown>>, error?: Record<string, unknown> | null, onIds?: (productIds: Array<string>) => void }} [options]
 * @returns {{ from: (table: string) => { select: (fields: string) => { in: (column: string, productIds: Array<string>) => Promise<{ data: Array<Record<string, unknown>>, error: Record<string, unknown> | null }> } } }}
 */
function createCartClient({ data = [], error = null, onIds = () => {} } = {}) {
  return {
    from(table) {
      assert.equal(table, "products");
      return {
        select(fields) {
          assert.match(fields, /discount_price/);
          return {
            in(column, productIds) {
              assert.equal(column, "id");
              onIds(productIds);
              return Promise.resolve({ data, error });
            },
          };
        },
      };
    },
  };
}

test("fetchCartProductSnapshots should return an empty list when there are no product ids", async () => {
  const result = await fetchCartProductSnapshots({ productIds: [], client: createCartClient() });

  assert.deepEqual(result, []);
});

test("fetchCartProductSnapshots should query the current cart products once", async () => {
  const queriedIds = [];
  const client = createCartClient({
    data: [{ id: "p-1", price: 25 }],
    onIds(productIds) {
      queriedIds.push(productIds);
    },
  });
  const result = await fetchCartProductSnapshots({ productIds: ["p-1", "p-1", "p-2"], client });

  assert.deepEqual(result, [{ id: "p-1", price: 25 }]);
  assert.deepEqual(queriedIds, [["p-1", "p-2"]]);
});

test("fetchCartProductSnapshots should throw a user-friendly error when the catalog query fails", async () => {
  const client = createCartClient({ error: { message: "db failed" } });

  await assert.rejects(
    () => fetchCartProductSnapshots({ productIds: ["p-1"], client }),
    /تعذر تحديث بيانات السلة حالياً\./
  );
});
