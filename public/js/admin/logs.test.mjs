import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const SCRIPT_SOURCE = fs.readFileSync(new URL("./logs.helpers.js", import.meta.url), "utf8");

function loadHooks() {
  const window = { __ENABLE_ADMIN_LOGS_TEST_HOOKS__: true };
  const context = vm.createContext({ window });
  vm.runInContext(SCRIPT_SOURCE, context, { filename: "public/js/admin/logs.helpers.js" });
  return window.__adminLogsTestHooks;
}

test("classifyAuditLog should mark delete actions as sensitive", () => {
  const hooks = loadHooks();
  const meta = hooks.classifyAuditLog({ action: "product_delete" });

  assert.equal(meta.isSensitive, true);
  assert.equal(meta.tone, "danger");
});

test("filterAuditLogs should match actor category and search text together", () => {
  const hooks = loadHooks();
  const filtered = hooks.filterAuditLogs({
    actorId: "admin-1",
    categoryId: "orders",
    logs: [
      { action: "order_update", actorId: "admin-1", searchText: "order ahmad", timestamp: "2026-04-02T00:00:00Z" },
      { action: "product_update", actorId: "admin-1", searchText: "product sony", timestamp: "2026-04-02T00:00:00Z" }
    ],
    searchQuery: "ahmad"
  });

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].action, "order_update");
});

test("buildAuditExportRows should resolve actor labels and category names", () => {
  const hooks = loadHooks();
  const rows = hooks.buildAuditExportRows(
    [{ action: "settings_update", actorId: "admin-1", details: "saved", timestamp: "2026-04-01T00:00:00Z" }],
    () => "الإدارة"
  );

  assert.deepEqual(JSON.parse(JSON.stringify(rows)), [
    {
      action: "settings_update",
      actor: "الإدارة",
      category: "النظام",
      details: "saved",
      sensitive: "no",
      timestamp: "2026-04-01T00:00:00Z"
    }
  ]);
});
