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

test("buildAdminBreadcrumbs should include group label for nested sections", () => {
  const hooks = loadHooks();
  const breadcrumbs = hooks.buildAdminBreadcrumbs("products");
  assert.deepEqual(
    JSON.parse(JSON.stringify(breadcrumbs.map((item) => item.label))),
    ["الرئيسية", "المتجر", "المنتجات"]
  );
});

test("buildAdminHeaderAlerts should prioritize actionable dashboard alerts", () => {
  const hooks = loadHooks();
  const alerts = hooks.buildAdminHeaderAlerts({
    lowStock: 2,
    offlineQueueCount: 1,
    pendingDeposits: 3,
    pendingOrders: 4,
    unreadMessages: 5
  });
  assert.equal(alerts[0].section, "orders");
  assert.equal(alerts[1].section, "deposits");
  assert.equal(alerts.length, 5);
});

test("searchAdminCommands should return strongly matching commands first", () => {
  const hooks = loadHooks();
  const results = hooks.searchAdminCommands(hooks.buildAdminCommandItems(), "نسخة احتياطية", 5);
  assert.equal(results[0].id, "export-backup");
  assert.ok(results.every((item) => item.title || item.description));
});
