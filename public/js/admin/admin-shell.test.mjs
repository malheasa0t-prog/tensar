import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const SCRIPT_SOURCE = fs.readFileSync(new URL("./admin-shell.helpers.js", import.meta.url), "utf8");

function loadHooks() {
  const window = { __ENABLE_ADMIN_SHELL_TEST_HOOKS__: true };
  const context = vm.createContext({ window });
  vm.runInContext(SCRIPT_SOURCE, context, { filename: "public/js/admin/admin-shell.helpers.js" });
  return window.__adminShellTestHooks;
}

test("buildAdminBreadcrumbs should include group label for order subsections", () => {
  const hooks = loadHooks();
  const breadcrumbs = hooks.buildAdminBreadcrumbs("product-orders");
  assert.deepEqual(
    JSON.parse(JSON.stringify(breadcrumbs.map((item) => item.label))),
    ["الرئيسية", "إدارة الطلبات", "طلبات المنتجات"]
  );
});

test("buildAdminHeaderAlerts should return orders and queue alerts only", () => {
  const hooks = loadHooks();
  const alerts = hooks.buildAdminHeaderAlerts({
    offlineQueueCount: 1,
    pendingOrders: 4
  });
  assert.equal(alerts[0].section, "orders");
  assert.equal(alerts[1].section, "dashboard");
  assert.equal(alerts.length, 2);
});

test("searchAdminCommands should return strongly matching commands first", () => {
  const hooks = loadHooks();
  const results = hooks.searchAdminCommands(hooks.buildAdminCommandItems(), "نسخة احتياطية", 5);
  assert.equal(results[0].id, "export-backup");
  assert.ok(results.every((item) => item.title || item.description));
});
