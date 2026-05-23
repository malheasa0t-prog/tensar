import assert from "node:assert/strict";
import test from "node:test";
import {
  matchRoutePrefetchKey,
  normalizeRoutePrefetchPath,
} from "./routePrefetchModel.js";

test("normalizeRoutePrefetchPath should remove query strings and trailing slashes", () => {
  assert.equal(
    normalizeRoutePrefetchPath("/services/repair/?source=nav"),
    "/services/repair"
  );
});

test("normalizeRoutePrefetchPath should ignore invalid or hash-only hrefs", () => {
  assert.equal(normalizeRoutePrefetchPath("#reviews"), "");
  assert.equal(normalizeRoutePrefetchPath(""), "");
});

test("matchRoutePrefetchKey should resolve static and dynamic storefront routes", () => {
  assert.equal(matchRoutePrefetchKey("/services"), "services");
  assert.equal(matchRoutePrefetchKey("/services/diagnostics"), "service-detail");
  assert.equal(matchRoutePrefetchKey("/favorites/shared?items=svc-1"), "favorites-shared");
  assert.equal(matchRoutePrefetchKey("/dashboard/orders"), "dashboard-orders");
});

test("matchRoutePrefetchKey should not prefetch discontinued product routes", () => {
  assert.equal(matchRoutePrefetchKey("/products"), "");
  assert.equal(matchRoutePrefetchKey("/products/prd-100"), "");
});

test("matchRoutePrefetchKey should return an empty key for unsupported routes", () => {
  assert.equal(matchRoutePrefetchKey("/admin.html"), "");
  assert.equal(matchRoutePrefetchKey("/unknown/path"), "");
});
