import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const SCRIPT_SOURCE = fs.readFileSync(new URL("./serva-catalog.js", import.meta.url), "utf8");

/**
 * Loads the Serva catalog admin script and returns its test hooks.
 *
 * @returns {Record<string, Function>}
 */
function loadServaCatalogHooks() {
  const window = {
    __ENABLE_SERVA_CATALOG_TEST_HOOKS__: true,
    AdminApp: {
      sections: {},
    },
  };
  const context = vm.createContext({ window });

  vm.runInContext(SCRIPT_SOURCE, context, { filename: "public/js/admin/serva-catalog.js" });
  return window.__servaCatalogTestHooks;
}

test("getProviderServiceId should normalize numeric provider IDs", () => {
  const hooks = loadServaCatalogHooks();

  assert.equal(hooks.getProviderServiceId({ service: 1234 }), "1234");
  assert.equal(hooks.getProviderServiceId({ service: "  srv-55  " }), "srv-55");
});

test("getServiceStatusCellId should return a DOM-safe id", () => {
  const hooks = loadServaCatalogHooks();

  assert.equal(hooks.getServiceStatusCellId("abc/123?x"), "servaStatus_abc_123_x");
});

test("esc should encode unsafe catalog text", () => {
  const hooks = loadServaCatalogHooks();

  assert.equal(hooks.esc("<img src=x onerror=alert(1)>"), "&lt;img src=x onerror=alert(1)&gt;");
});

test("provider display helpers should return safe defaults", () => {
  const hooks = loadServaCatalogHooks();

  assert.equal(hooks.getProviderServiceName({ name_ar: "متابعين" }), "متابعين");
  assert.equal(hooks.getProviderServiceName({}), "خدمة بدون اسم");
  assert.equal(hooks.getProviderCategory({ category: " Instagram " }), "Instagram");
});

test("safePositiveInt should clamp invalid or too-large values", () => {
  const hooks = loadServaCatalogHooks();

  assert.equal(hooks.safePositiveInt("bad", 1, 10), 1);
  assert.equal(hooks.safePositiveInt("25", 1, 10), 10);
  assert.equal(hooks.safePositiveInt("5", 1, 10), 5);
});

test("buildLocalServiceRow should map a selected subcategory back to its root category", () => {
  const hooks = loadServaCatalogHooks();
  hooks.setCategoriesForTests([
    { id: "cards", name: "البطاقات", parent_id: null },
    { id: "itunes", name: "آيتونز", parent_id: "cards" },
  ]);

  const row = hooks.buildLocalServiceRow({
    fields: [{ key: "email" }],
    max: 50,
    min: 1,
    name_ar: "آيتونز 5$",
    rate: "5.5",
    service: "1001",
  }, "itunes");

  assert.equal(row.category_id, "cards");
  assert.equal(row.subcategory_id, "itunes");
  assert.equal(row.provider_service_id, "1001");
});

test("collectExistingProviderIds should ignore null and blank provider ids", () => {
  const hooks = loadServaCatalogHooks();

  const ids = hooks.collectExistingProviderIds([
    { provider_service_id: "srv-1" },
    { provider_service_id: null },
    { provider_service_id: "  " },
    {},
    { provider_service_id: "1002" },
  ]);

  assert.deepEqual([...ids], ["srv-1", "1002"]);
});
