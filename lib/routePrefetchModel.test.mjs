import assert from "node:assert/strict";
import test from "node:test";
import {
  matchRoutePrefetchKey,
  normalizeRoutePrefetchPath,
} from "./routePrefetchModel.js";

test("normalizeRoutePrefetchPath should remove query strings and trailing slashes", () => {
  assert.equal(
    normalizeRoutePrefetchPath("/products/sku-1/?color=black"),
    "/products/sku-1"
  );
});

test("normalizeRoutePrefetchPath should ignore invalid or hash-only hrefs", () => {
  assert.equal(normalizeRoutePrefetchPath("#reviews"), "");
  assert.equal(normalizeRoutePrefetchPath(""), "");
});

test("matchRoutePrefetchKey should resolve static and dynamic storefront routes", () => {
  assert.equal(matchRoutePrefetchKey("/products"), "products");
  assert.equal(matchRoutePrefetchKey("/products/prd-100"), "product-detail");
  assert.equal(matchRoutePrefetchKey("/favorites/shared?items=prd-1"), "favorites-shared");
  assert.equal(matchRoutePrefetchKey("/dashboard/orders"), "dashboard-orders");
});

test("matchRoutePrefetchKey should return an empty key for unsupported routes", () => {
  assert.equal(matchRoutePrefetchKey("/admin.html"), "");
  assert.equal(matchRoutePrefetchKey("/unknown/path"), "");
});
