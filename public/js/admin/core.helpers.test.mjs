import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const SCRIPT_SOURCE = fs.readFileSync(new URL("./core.helpers.js", import.meta.url), "utf8");

function loadHelpers() {
  const window = {};
  const context = vm.createContext({
    window,
    localStorage: {
      getItem() {
        return null;
      },
      setItem() {}
    },
    CustomEvent
  });

  vm.runInContext(SCRIPT_SOURCE, context, { filename: "public/js/admin/core.helpers.js" });
  return window.AdminCoreHelpers;
}

test("normalizeSection should keep allowed sections", () => {
  const helpers = loadHelpers();
  assert.equal(helpers.normalizeSection("orders"), "orders");
  assert.equal(helpers.normalizeSection("product-orders"), "product-orders");
  assert.equal(helpers.normalizeSection("products"), "products");
});

test("normalizeSection should route unknown sections back to dashboard", () => {
  const helpers = loadHelpers();
  assert.equal(helpers.normalizeSection("unknown"), "dashboard");
  assert.equal(helpers.normalizeSection("/not-real/"), "dashboard");
});

test("formatOrderNumber should prefer the display number when available", () => {
  const helpers = loadHelpers();
  assert.equal(helpers.formatOrderNumber({ id: "ord-abc", displayNumber: 2000 }), "#2000");
  assert.equal(helpers.formatOrderNumber({ id: "ord-abc" }), "ord-abc");
});

test("deliveryLabel should return translated admin labels", () => {
  const helpers = loadHelpers();
  assert.equal(helpers.deliveryLabel("delivery"), "توصيل للمنزل");
  assert.equal(helpers.deliveryLabel("pickup"), "استلام من المحل");
  assert.equal(helpers.deliveryLabel("custom"), "custom");
});
