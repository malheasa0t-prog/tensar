import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const SCRIPT_SOURCE = fs.readFileSync(new URL("./global-search.helpers.js", import.meta.url), "utf8");

function loadHooks() {
  const window = {
    __ENABLE_ADMIN_GLOBAL_SEARCH_TEST_HOOKS__: true,
    AdminCoreHelpers: {
      formatOrderNumber(order) {
        return order?.displayNumber ? `#${order.displayNumber}` : "#2000";
      }
    }
  };
  const context = { window };
  vm.createContext(context);
  vm.runInContext(SCRIPT_SOURCE, context, { filename: "public/js/admin/global-search.helpers.js" });
  return window.__adminGlobalSearchTestHooks;
}

test("resolvePhysicalOrderSection should always return product-orders", () => {
  const hooks = loadHooks();
  const section = hooks.resolvePhysicalOrderSection(
    { metadata: { catalog_kind: "products" }, items: [] },
    {}
  );

  assert.equal(section, "product-orders");
});

test("buildAdminSearchIndex should index physical orders", () => {
  const hooks = loadHooks();
  const index = hooks.buildAdminSearchIndex({
    orders: [{ id: "1234", customerName: "أحمد محمد", total: 45, status: "processing", items: [] }],
    helpers: {},
  });

  assert.equal(index.length, 1);
  assert.equal(index.some((item) => item.kind === "order"), true);
  assert.equal(index[0].title, "طلب #2000");
  assert.equal(index[0].searchText.includes("2000"), true);
});

test("searchAdminIndex should rank title prefix matches first", () => {
  const hooks = loadHooks();
  const results = hooks.searchAdminIndex(
    [
      { title: "طلب #1234", subtitle: "أحمد", meta: "processing", searchText: "أحمد محمد 1234" },
      { title: "عميل أحمد", subtitle: "حساب نشط", meta: "active", searchText: "أحمد عميل" },
    ],
    "طلب #"
  );

  assert.equal(results.length, 1);
  assert.equal(results[0].title, "طلب #1234");
});
