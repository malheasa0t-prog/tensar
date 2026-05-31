import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const SCRIPT_SOURCE = fs.readFileSync(new URL("./core.helpers.js", import.meta.url), "utf8");

function loadHelpers(overrides = {}) {
  const window = {};
  const context = vm.createContext({
    window,
    document: overrides.document,
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
  assert.equal(helpers.normalizeSection("service-orders"), "service-orders");
  assert.equal(helpers.normalizeSection("repair-orders"), "repair-orders");
  assert.equal(helpers.normalizeSection("products"), "products");
  assert.equal(helpers.normalizeSection("catalog"), "catalog");
  assert.equal(helpers.normalizeSection("serva-catalog"), "serva-catalog");
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

test("updateOrdersBadge should include product, service, and repair pending work", () => {
  const badge = { textContent: "", style: { display: "" } };
  const helpers = loadHelpers({
    document: {
      getElementById(id) {
        return id === "ordersBadge" ? badge : null;
      }
    }
  });

  helpers.updateOrdersBadge({
    db: {
      orders: [{ status: "pending" }],
      serviceOrders: [{ status: "processing" }],
      repairBookings: [{ status: "awaiting_device" }]
    }
  });

  assert.equal(badge.textContent, 3);
  assert.equal(badge.style.display, "inline");
});

test("deliveryLabel should return translated admin labels", () => {
  const helpers = loadHelpers();
  assert.equal(helpers.deliveryLabel("delivery"), "توصيل للمنزل");
  assert.equal(helpers.deliveryLabel("pickup"), "استلام من المحل");
  assert.equal(helpers.deliveryLabel("custom"), "custom");
});
