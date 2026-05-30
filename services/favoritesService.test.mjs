import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchFavoriteCategoryMap,
  fetchFavoriteProductSnapshots,
  mapFavoriteProductsForDisplay,
  sortFavoriteProducts,
} from "./favoritesService.js";

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
    [
      "select",
      "id,name,price,discount_price,images,status,quantity,category_id,icon,brand,description,rating,review_count,sold,product_type,created_at",
    ],
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

test("fetchFavoriteCategoryMap should return an empty object when there are no category ids", async () => {
  const result = await fetchFavoriteCategoryMap({
    client: {},
    categoryIds: [],
  });

  assert.deepEqual(result, {});
});

test("fetchFavoriteCategoryMap should load active categories only", async () => {
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

              return {
                eq(nextColumnName, nextValue) {
                  calls.push(["eq", nextColumnName, nextValue]);
                  return Promise.resolve({
                    data: [{ id: "cat-1", name: "Laptops" }],
                    error: null,
                  });
                },
              };
            },
          };
        },
      };
    },
  };

  const result = await fetchFavoriteCategoryMap({
    client,
    categoryIds: ["cat-1", "cat-1"],
  });

  assert.deepEqual(result, { "cat-1": "Laptops" });
  assert.deepEqual(calls, [
    ["from", "categories"],
    ["select", "id,name"],
    ["in", "id", ["cat-1"]],
    ["eq", "status", "active"],
  ]);
});

test("sortFavoriteProducts should preserve the favorites order", () => {
  const result = sortFavoriteProducts({
    favoriteIds: ["prd-2", "prd-1"],
    products: [{ id: "prd-1" }, { id: "prd-2" }, { id: "prd-9" }],
  });

  assert.deepEqual(result.map((product) => product.id), ["prd-2", "prd-1", "prd-9"]);
});

test("mapFavoriteProductsForDisplay should map products with fallback category names", () => {
  const result = mapFavoriteProductsForDisplay({
    favoriteIds: ["prd-1"],
    categoryMap: {},
    products: [
      {
        id: "prd-1",
        name: "Laptop",
        category_id: "cat-1",
        product_type: "physical",
        price: 20,
        quantity: 3,
        status: "active",
        images: [],
      },
    ],
  });

  assert.equal(result[0].category, "منتجات عامة");
  assert.equal(result[0].link, "/products/prd-1");
});
