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
});

test("normalizeSection should route removed sections back to dashboard", () => {
  const helpers = loadHelpers();
  assert.equal(helpers.normalizeSection("products"), "dashboard");
  assert.equal(helpers.normalizeSection("customers"), "dashboard");
  assert.equal(helpers.normalizeSection("settings"), "dashboard");
});
