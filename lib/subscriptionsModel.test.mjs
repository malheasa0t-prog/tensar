import test from "node:test";
import assert from "node:assert/strict";
import {
  DIGITAL_SERVICES_CATEGORY_SLUG,
  getSubscriptionsCategoryIds,
  selectSubscriptionProducts,
} from "./subscriptionsModel.js";

test("getSubscriptionsCategoryIds should resolve digital categories by slug", () => {
  const result = getSubscriptionsCategoryIds([
    { id: "cat-digital-new", slug: DIGITAL_SERVICES_CATEGORY_SLUG },
    { id: "cat-laptops", slug: "laptops" },
  ]);

  assert.deepEqual([...result], ["cat-digital-new"]);
});

test("selectSubscriptionProducts should use category ids derived from slugs instead of category names", () => {
  const result = selectSubscriptionProducts({
    categories: [{ id: "cat-digital-new", slug: DIGITAL_SERVICES_CATEGORY_SLUG }],
    products: [
      { id: "prod-1", category_id: "cat-digital-new", category: "اسم متغير" },
      { id: "prod-2", category_id: "cat-laptops", category: "شحن واشتراكات" },
    ],
  });

  assert.deepEqual(
    result.map((product) => product.id),
    ["prod-1"]
  );
});

test("selectSubscriptionProducts should keep products marked as digital even without category metadata", () => {
  const result = selectSubscriptionProducts({
    categories: [],
    products: [
      { id: "prod-1", product_type: "digital", category_id: "missing" },
      { id: "prod-2", product_type: "physical", category_id: "missing" },
    ],
  });

  assert.deepEqual(
    result.map((product) => product.id),
    ["prod-1"]
  );
});
