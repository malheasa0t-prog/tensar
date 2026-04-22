import test from "node:test";
import assert from "node:assert/strict";
import { fetchCartProductSnapshots } from "./cartService.js";

/**
 * Creates a minimal cart query client for unit tests.
 *
 * @param {{
 *   productsData?: Array<Record<string, unknown>>,
 *   productsError?: Record<string, unknown> | null,
 *   onProductsIds?: (productIds: Array<string>) => void,
 * }} [options]
 * @returns {{ from: (table: string) => { select: (fields: string) => { in: (column: string, productIds: Array<string>) => Promise<{ data: Array<Record<string, unknown>>, error: Record<string, unknown> | null }> } } }}
 */
function createCartClient({
  productsData = [],
  productsError = null,
  onProductsIds = () => {},
} = {}) {
  return {
    from(table) {
      if (table === "products") {
        return {
          select(fields) {
            assert.match(fields, /discount_price/);
            return {
              in(column, productIds) {
                assert.equal(column, "id");
                onProductsIds(productIds);
                return Promise.resolve({ data: productsData, error: productsError });
              },
            };
          },
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
  };
}

test("fetchCartProductSnapshots should return an empty list when there are no product ids", async () => {
  const result = await fetchCartProductSnapshots({ productIds: [], client: createCartClient() });

  assert.deepEqual(result, []);
});

test("fetchCartProductSnapshots should query products using unique ids", async () => {
  const queriedProductsIds = [];
  const client = createCartClient({
    productsData: [{ id: "p-1", price: 25 }, { id: "p-2", price: 10 }],
    onProductsIds(productIds) {
      queriedProductsIds.push(productIds);
    },
  });
  const result = await fetchCartProductSnapshots({ productIds: ["p-1", "p-1", "p-2"], client });

  assert.deepEqual(queriedProductsIds, [["p-1", "p-2"]]);
  assert.equal(result.length, 2);
  assert.equal(result[0].id, "p-1");
  assert.equal(result[1].id, "p-2");
});

test("fetchCartProductSnapshots should throw a user-friendly error when the catalog query fails", async () => {
  const client = createCartClient({ productsError: { message: "db failed" } });

  await assert.rejects(() => fetchCartProductSnapshots({ productIds: ["p-1"], client }), {
    message:
      "[CRT-301] \u062a\u0639\u0630\u0631 \u062a\u062d\u062f\u064a\u062b \u0628\u064a\u0627\u0646\u0627\u062a \u0627\u0644\u0633\u0644\u0629 \u062d\u0627\u0644\u064a\u0627\u064b.",
  });
});
