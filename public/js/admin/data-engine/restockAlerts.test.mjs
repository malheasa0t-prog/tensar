import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAdminRestockNotifications,
  fetchExistingProductSnapshot,
  hasAdminProductRestocked,
  isAdminProductOutOfStock,
  RESTOCK_SUBSCRIPTION_REFERENCE_TYPE,
  syncProductRestockAlerts,
} from "./restockAlerts.js";

test("isAdminProductOutOfStock should detect unavailable physical products", () => {
  assert.equal(isAdminProductOutOfStock({ status: "active", quantity: 0, product_type: "physical" }), true);
  assert.equal(isAdminProductOutOfStock({ status: "active", quantity: 4, product_type: "physical" }), false);
});

test("hasAdminProductRestocked should detect the stock recovery transition", () => {
  assert.equal(
    hasAdminProductRestocked(
      { status: "out_of_stock", quantity: 0, product_type: "physical" },
      { status: "active", quantity: 5, product_type: "physical" }
    ),
    true
  );
});

test("buildAdminRestockNotifications should create unique user notifications", () => {
  assert.deepEqual(
    buildAdminRestockNotifications({
      productId: "prd-1",
      productName: "Laptop",
      subscriptions: [{ user_id: "user-1" }, { user_id: "user-1" }, { user_id: "user-2" }],
    }),
    [
      {
        user_id: "user-1",
        title: "عاد المنتج إلى المخزون",
        body: "Laptop متوفر الآن من جديد ويمكنك إكمال الطلب.",
        type: "success",
        reference_type: "product",
        reference_id: "prd-1",
      },
      {
        user_id: "user-2",
        title: "عاد المنتج إلى المخزون",
        body: "Laptop متوفر الآن من جديد ويمكنك إكمال الطلب.",
        type: "success",
        reference_type: "product",
        reference_id: "prd-1",
      },
    ]
  );
});

test("fetchExistingProductSnapshot should load the current product snapshot when it exists", async () => {
  const supabase = {
    from(tableName) {
      assert.equal(tableName, "products");
      return {
        select(fields) {
          assert.equal(fields, "id,name,status,quantity,product_type");
          return {
            eq(column, value) {
              assert.equal(column, "id");
              assert.equal(value, "prd-1");
              return {
                async maybeSingle() {
                  return { data: { id: "prd-1" }, error: null };
                },
              };
            },
          };
        },
      };
    },
  };

  const result = await fetchExistingProductSnapshot({ productId: "prd-1", supabase });
  assert.deepEqual(result, { id: "prd-1" });
});

test("syncProductRestockAlerts should insert notifications then delete subscription rows", async () => {
  const calls = [];
  const supabase = {
    from(tableName) {
      if (tableName === "notifications") {
        return {
          select(columns) {
            calls.push({ type: "select", columns });
            return {
              eq(firstColumn, firstValue) {
                calls.push({ type: "eq", column: firstColumn, value: firstValue });
                return {
                  async eq(secondColumn, secondValue) {
                    calls.push({ type: "eq", column: secondColumn, value: secondValue });
                    return {
                      data: [{ id: "notif-1", user_id: "user-1", reference_type: RESTOCK_SUBSCRIPTION_REFERENCE_TYPE }],
                      error: null,
                    };
                  },
                };
              },
            };
          },
          insert(rows) {
            calls.push({ type: "insert", rows });
            return Promise.resolve({ error: null });
          },
          delete() {
            calls.push({ type: "delete" });
            return {
              in(column, values) {
                calls.push({ type: "in", column, values });
                return Promise.resolve({ error: null });
              },
            };
          },
        };
      }

      throw new Error(`Unexpected table ${tableName}`);
    },
  };

  const executeSync = async (queryPromise, fallbackMessage) => {
    calls.push({ type: "executeSync", fallbackMessage });
    return queryPromise;
  };

  await syncProductRestockAlerts({
    executeSync,
    previousProduct: { status: "out_of_stock", quantity: 0, product_type: "physical" },
    product: { id: "prd-1", name: "Laptop", status: "active", quantity: 4, product_type: "physical" },
    supabase,
  });

  assert.equal(calls.some((call) => call.type === "insert"), true);
  assert.deepEqual(
    calls.find((call) => call.type === "in"),
    { type: "in", column: "id", values: ["notif-1"] }
  );
});
