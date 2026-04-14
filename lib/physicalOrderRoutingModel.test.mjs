import test from "node:test";
import assert from "node:assert/strict";
import {
  ACCESSORY_ORDER_KIND,
  ACCESSORY_ORDERS_SECTION_ID,
  PRODUCT_ORDER_KIND,
  PRODUCT_ORDERS_SECTION_ID,
  getPhysicalOrderKindFromProducts,
  getPhysicalOrderSectionId,
  isAccessoryPhysicalProduct,
} from "./physicalOrderRoutingModel.js";

test("isAccessoryPhysicalProduct should detect accessory by product type", () => {
  assert.equal(
    isAccessoryPhysicalProduct({ product_type: "accessory", category_id: "laptops" }),
    true
  );
});

test("isAccessoryPhysicalProduct should detect accessory categories by slug lookup instead of a fixed id", () => {
  assert.equal(
    isAccessoryPhysicalProduct(
      { product_type: "physical", category_id: "cat-custom-accessories" },
      { categories: [{ id: "cat-custom-accessories", slug: "accessories" }] }
    ),
    true
  );
});

test("isAccessoryPhysicalProduct should detect inline category slugs without a category lookup", () => {
  assert.equal(
    isAccessoryPhysicalProduct({
      product_type: "physical",
      category_id: "cat-anything",
      category_slug: "accessories-direct-items",
    }),
    true
  );
});

test("isAccessoryPhysicalProduct should reject main catalog products", () => {
  assert.equal(
    isAccessoryPhysicalProduct(
      { product_type: "physical", category_id: "cat-laptops" },
      { categories: [{ id: "cat-laptops", slug: "laptops" }] }
    ),
    false
  );
});

test("getPhysicalOrderKindFromProducts should route accessory-only carts to accessories", () => {
  assert.equal(
    getPhysicalOrderKindFromProducts(
      [
        { product_type: "physical", category_id: "cat-a" },
        { product_type: "physical", category_id: "cat-b" },
      ],
      {
        categories: [
          { id: "cat-a", slug: "accessories" },
          { id: "cat-b", slug: "accessories-direct-items" },
        ],
      }
    ),
    ACCESSORY_ORDER_KIND
  );
});

test("getPhysicalOrderKindFromProducts should route mixed carts to products", () => {
  assert.equal(
    getPhysicalOrderKindFromProducts(
      [
        { product_type: "physical", category_id: "cat-accessories" },
        { product_type: "physical", category_id: "cat-laptops" },
      ],
      {
        categories: [
          { id: "cat-accessories", slug: "accessories" },
          { id: "cat-laptops", slug: "laptops" },
        ],
      }
    ),
    PRODUCT_ORDER_KIND
  );
});

test("getPhysicalOrderSectionId should map kinds to admin sections", () => {
  assert.equal(getPhysicalOrderSectionId(ACCESSORY_ORDER_KIND), ACCESSORY_ORDERS_SECTION_ID);
  assert.equal(getPhysicalOrderSectionId(PRODUCT_ORDER_KIND), PRODUCT_ORDERS_SECTION_ID);
  assert.equal(getPhysicalOrderSectionId("unknown"), PRODUCT_ORDERS_SECTION_ID);
});
