import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const SCRIPT_SOURCE = fs.readFileSync(new URL("./catalog.helpers.js", import.meta.url), "utf8");

function loadHooks() {
  const window = { __ENABLE_CATALOG_ADMIN_TEST_HOOKS__: true };
  const context = vm.createContext({
    TZ: {
      escapeHtml(value) {
        return String(value ?? "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
      },
    },
    window,
  });

  vm.runInContext(SCRIPT_SOURCE, context, { filename: "public/js/admin/catalog.helpers.js" });
  return window.__catalogAdminTestHooks;
}

test("slugifyCatalogText should keep Arabic text and dashes only", () => {
  const hooks = loadHooks();
  assert.equal(hooks.slugifyCatalogText(" آيتونز 5$ بطاقة "), "آيتونز-5-بطاقة");
});

test("buildCatalogServicePayload should normalize numeric and optional fields", () => {
  const hooks = loadHooks();
  const payload = hooks.buildCatalogServicePayload({
    categoryId: "cards",
    costPrice: "4.4",
    image: " https://example.com/card.png ",
    maxQty: "10",
    minQty: "2",
    name: "آيتونز 5$",
    price: "5.5",
    status: "active",
    subcategoryId: "itunes",
  });

  assert.match(payload.id, /^srv-/);
  assert.equal(payload.slug, "آيتونز-5");
  assert.equal(payload.price, 5.5);
  assert.equal(payload.cost_price, 4.4);
  assert.equal(payload.image, "https://example.com/card.png");
  assert.equal(payload.min_qty, 2);
  assert.equal(payload.max_qty, 10);
});

test("filterCatalogServices should keep the selected root, subcategory, and query", () => {
  const hooks = loadHooks();
  const rows = hooks.filterCatalogServices({
    categoryId: "cards",
    query: "itunes",
    services: [
      { categoryId: "cards", id: "srv-1", name: "iTunes 5", providerServiceId: "" },
      { categoryId: "cards", id: "srv-2", name: "Google Play", providerServiceId: "" },
      { categoryId: "games", id: "srv-3", name: "iTunes 10", providerServiceId: "" },
    ],
  });

  assert.deepEqual(rows.map((row) => row.id), ["srv-1"]);
});
