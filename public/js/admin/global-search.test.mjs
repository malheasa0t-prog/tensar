import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const SCRIPT_SOURCE = fs.readFileSync(new URL("./global-search.helpers.js", import.meta.url), "utf8");

function loadHooks() {
  const window = {
    __ENABLE_ADMIN_GLOBAL_SEARCH_TEST_HOOKS__: true,
  };
  const context = { window };
  vm.createContext(context);
  vm.runInContext(SCRIPT_SOURCE, context, { filename: "public/js/admin/global-search.helpers.js" });
  return window.__adminGlobalSearchTestHooks;
}

test("resolvePhysicalOrderSection should honor explicit accessories metadata", () => {
  const hooks = loadHooks();
  const section = hooks.resolvePhysicalOrderSection(
    { metadata: { catalog_kind: "accessories" }, items: [] },
    {}
  );

  assert.equal(section, "accessory-orders");
});

test("buildAdminSearchIndex should include products customers services and orders", () => {
  const hooks = loadHooks();
  const index = hooks.buildAdminSearchIndex({
    products: [{ id: "p-1", name: "سماعة بلوتوث", quantity: 15, brand: "Sony", categoryId: "cat-1" }],
    orders: [{ id: "1234", customerName: "أحمد محمد", total: 45, status: "processing", items: [] }],
    serviceOrders: [{ id: "srv-1", serviceName: "فحص جهاز", total: 12, status: "pending", userId: "user-1" }],
    users: [{ id: "user-1", fullName: "أحمد محمد", email: "ahmad@example.com", phone: "0799999999" }],
    services: [{ id: "rep-1", name: "صيانة لابتوب", price: 15, category: "صيانة" }],
    getCategoryName: () => "سماعات",
    helpers: { getProductById: () => null, isAccessoryProduct: () => false, isAccessoryProductCategoryId: () => false },
  });

  assert.equal(index.length, 5);
  assert.equal(index.some((item) => item.kind === "product"), true);
  assert.equal(index.some((item) => item.kind === "customer"), true);
  assert.equal(index.some((item) => item.kind === "service"), true);
  assert.equal(index.some((item) => item.kind === "order"), true);
  assert.equal(index.some((item) => item.kind === "digital-order"), true);
});

test("searchAdminIndex should rank title prefix matches first", () => {
  const hooks = loadHooks();
  const results = hooks.searchAdminIndex(
    [
      { title: "سماعة بلوتوث", subtitle: "منتج", meta: "مخزون", searchText: "سماعة بلوتوث" },
      { title: "طلب #1234", subtitle: "أحمد", meta: "processing", searchText: "أحمد محمد 1234" },
    ],
    "سماعة"
  );

  assert.equal(results.length, 1);
  assert.equal(results[0].title, "سماعة بلوتوث");
});
