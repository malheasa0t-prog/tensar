import test from "node:test";
import assert from "node:assert/strict";
import {
  selectFeaturedProducts,
  selectFeaturedServices,
  selectHomepageCategories,
} from "./techfixModel.js";

test("selectHomepageCategories should ignore top-nav visibility and return sorted root categories", () => {
  const categories = [
    { id: "child", name: "ابن", parent_id: "b", sort_order: 1 },
    { id: "b", name: "ب", parent_id: null, sort_order: 2 },
    { id: "a", name: "أ", parent_id: null, sort_order: 1, show_in_navbar: true },
    { id: "hidden", name: "مخفي", parent_id: null, sort_order: 0, show_in_navbar: false },
  ];

  assert.deepEqual(
    selectHomepageCategories(categories, 3).map((category) => category.id),
    ["hidden", "a", "b"]
  );
});

test("selectFeaturedProducts should sort active products by newest first", () => {
  const products = [
    { id: "1", category_id: "laptops", created_at: "2024-01-01", status: "active" },
    { id: "2", category_id: "laptops", created_at: "2024-03-01", status: "active" },
    { id: "3", category_id: "screens", created_at: "2024-02-01", status: "active" },
  ];

  assert.deepEqual(
    selectFeaturedProducts(products, 2).map((product) => product.id),
    ["2", "3"]
  );
});

test("selectFeaturedProducts should exclude inactive products", () => {
  const products = [
    { id: "1", category_id: "laptops", created_at: "2024-02-01", status: "inactive" },
    { id: "2", category_id: "laptops", created_at: "2024-03-01", status: "active" },
  ];

  assert.deepEqual(
    selectFeaturedProducts(products, 2).map((product) => product.id),
    ["2"]
  );
});

test("selectFeaturedServices should return only active services in sorted order", () => {
  const services = [
    { id: "2", category: "تنظيف", name: "تنظيف عميق", status: "active" },
    { id: "1", category: "تشخيص", name: "فحص أولي", status: "active" },
    { id: "3", category: "تشخيص", name: "معطل", status: "inactive" },
  ];

  assert.deepEqual(
    selectFeaturedServices(services, 2).map((service) => service.id),
    ["1", "2"]
  );
});
