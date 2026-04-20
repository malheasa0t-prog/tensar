import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRestockReadyNotificationPayload,
  buildRestockSubscriptionPayload,
  hasProductBeenRestocked,
  isStockAlertEligibleProduct,
  normalizeStockAlertProductId,
  RESTOCK_NOTIFICATION_REFERENCE_TYPE,
  RESTOCK_SUBSCRIPTION_REFERENCE_TYPE,
} from "./stockAlertModel.js";

test("normalizeStockAlertProductId should trim product ids safely", () => {
  assert.equal(normalizeStockAlertProductId(" prd-1 "), "prd-1");
  assert.equal(normalizeStockAlertProductId(null), "");
});

test("isStockAlertEligibleProduct should detect out-of-stock products", () => {
  assert.equal(isStockAlertEligibleProduct({ status: "out_of_stock", quantity: 0 }), true);
  assert.equal(isStockAlertEligibleProduct({ status: "active", quantity: 3 }), false);
});

test("hasProductBeenRestocked should detect the unavailable to available transition", () => {
  assert.equal(
    hasProductBeenRestocked({
      previousProduct: { status: "out_of_stock", quantity: 0 },
      nextProduct: { status: "active", quantity: 4 },
    }),
    true
  );

  assert.equal(
    hasProductBeenRestocked({
      previousProduct: { status: "active", quantity: 2 },
      nextProduct: { status: "active", quantity: 5 },
    }),
    false
  );
});

test("buildRestockSubscriptionPayload should create an internal subscription row", () => {
  assert.deepEqual(
    buildRestockSubscriptionPayload({
      productId: "prd-1",
      productName: "Laptop",
      userId: "user-1",
    }),
    {
      user_id: "user-1",
      title: "اشتراك تنبيه التوفر",
      body: "سنخبرك عند توفر Laptop مرة أخرى.",
      type: "info",
      is_read: true,
      reference_type: RESTOCK_SUBSCRIPTION_REFERENCE_TYPE,
      reference_id: "prd-1",
      metadata: {
        source: "stock_alert_subscription",
        product_name: "Laptop",
      },
    }
  );
});

test("buildRestockReadyNotificationPayload should create a visible product notification", () => {
  assert.deepEqual(
    buildRestockReadyNotificationPayload({
      productId: "prd-9",
      productName: "Monitor",
      userId: "user-2",
    }),
    {
      user_id: "user-2",
      title: "عاد المنتج إلى المخزون",
      body: "Monitor متوفر الآن من جديد ويمكنك إكمال الطلب.",
      type: "success",
      reference_type: RESTOCK_NOTIFICATION_REFERENCE_TYPE,
      reference_id: "prd-9",
    }
  );
});
