import test from "node:test";
import assert from "node:assert/strict";
import { fetchFavoriteProductSnapshots } from "./favoritesService.js";

test("fetchFavoriteProductSnapshots should return an empty list when there are no favorite ids", async () => {
  const result = await fetchFavoriteProductSnapshots({
    client: {},
    productIds: [],
  });

  assert.deepEqual(result, []);
});

test("fetchFavoriteProductSnapshots should query products with active and out-of-stock statuses", async () => {
  const calls = [];
  const client = {
    from(tableName) {
      calls.push(["from", tableName]);

      return {
        select(fields) {
          calls.push(["select", fields]);

          return {
            in(columnName, values) {
              calls.push(["in", columnName, values]);

              if (columnName === "status") {
                return Promise.resolve({
                  data: [{ id: "p-1", name: "Product" }],
                  error: null,
                });
              }

              return this;
            },
          };
        },
      };
    },
  };

  const result = await fetchFavoriteProductSnapshots({
    client,
    productIds: ["p-1", "p-1", "p-2"],
  });

  assert.equal(result.length, 1);
  assert.deepEqual(calls, [
    ["from", "products"],
    ["select", "id,name,price,discount_price,images,status,quantity,category_id,icon,brand,description,rating,review_count,reviews_count,sold,product_type,created_at"],
    ["in", "id", ["p-1", "p-2"]],
    ["in", "status", ["active", "out_of_stock"]],
  ]);
});

test("fetchFavoriteProductSnapshots should throw a stable error when the query fails", async () => {
  const client = {
    from() {
      return {
        select() {
          return {
            in() {
              return {
                in() {
                  return Promise.resolve({
                    data: null,
                    error: { message: "db failed" },
                  });
                },
              };
            },
          };
        },
      };
    },
  };

  await assert.rejects(
    () => fetchFavoriteProductSnapshots({ client, productIds: ["p-1"] }),
    /تعذر تحميل المفضلة حالياً/
  );
});
