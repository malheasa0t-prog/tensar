import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const SCRIPT_SOURCE = fs.readFileSync(new URL("./table-enhancements.helpers.js", import.meta.url), "utf8");

function loadHooks() {
  const window = { __ENABLE_ADMIN_TABLE_TEST_HOOKS__: true };
  const context = vm.createContext({ window });
  vm.runInContext(SCRIPT_SOURCE, context, { filename: "public/js/admin/table-enhancements.helpers.js" });
  return window.__adminTableTestHooks;
}

test("normalizePageSize should fall back to a supported value", () => {
  const hooks = loadHooks();
  assert.equal(hooks.normalizePageSize(99, [10, 25, 50]), 25);
  assert.equal(hooks.normalizePageSize(10, [10, 25, 50]), 10);
});

test("buildPaginationState should clamp the current page into bounds", () => {
  const hooks = loadHooks();
  const state = hooks.buildPaginationState(42, 9, 10);
  assert.deepEqual(JSON.parse(JSON.stringify(state)), {
    currentPage: 5,
    endIndex: 42,
    pageSize: 10,
    startIndex: 40,
    totalItems: 42,
    totalPages: 5
  });
});

test("buildVisiblePageNumbers should create a centered window when possible", () => {
  const hooks = loadHooks();
  assert.deepEqual(
    JSON.parse(JSON.stringify(hooks.buildVisiblePageNumbers(4, 10, 5))),
    [2, 3, 4, 5, 6]
  );
});
