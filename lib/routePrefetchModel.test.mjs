import assert from "node:assert/strict";
import test from "node:test";
import {
  createCachedRouteModuleLoader,
  matchRoutePrefetchKey,
  normalizeRoutePrefetchPath,
} from "./routePrefetchModel.js";

test("createCachedRouteModuleLoader should reuse the same pending route import", async () => {
  let loadCount = 0;
  const loadRoute = createCachedRouteModuleLoader(async () => {
    loadCount += 1;
    return { default: "صفحة الخدمات" };
  });

  const firstLoad = loadRoute();
  const secondLoad = loadRoute();

  assert.equal(firstLoad, secondLoad);
  assert.deepEqual(await firstLoad, { default: "صفحة الخدمات" });
  assert.equal(loadCount, 1);
  assert.equal(loadRoute(), firstLoad);
});

test("createCachedRouteModuleLoader should retry after a failed route import", async () => {
  let loadCount = 0;
  const loadRoute = createCachedRouteModuleLoader(async () => {
    loadCount += 1;

    if (loadCount === 1) {
      throw new Error("chunk failed");
    }

    return { default: "صفحة بديلة" };
  });

  await assert.rejects(loadRoute(), /chunk failed/);
  assert.deepEqual(await loadRoute(), { default: "صفحة بديلة" });
  assert.equal(loadCount, 2);
});

test("createCachedRouteModuleLoader should reject non-callable loaders", () => {
  assert.throws(() => createCachedRouteModuleLoader(null), /RPF-101/);
});

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
