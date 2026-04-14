import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const SCRIPT_SOURCE = fs.readFileSync(new URL("./bulk-actions.helpers.js", import.meta.url), "utf8");

function loadHooks() {
  const window = {
    __ENABLE_ADMIN_BULK_ACTION_TEST_HOOKS__: true,
  };
  const context = { window };
  vm.createContext(context);
  vm.runInContext(SCRIPT_SOURCE, context, { filename: "public/js/admin/bulk-actions.helpers.js" });
  return window.__adminBulkActionTestHooks;
}

test("toggleBulkSelection should add and remove ids predictably", () => {
  const hooks = loadHooks();
  const selected = hooks.toggleBulkSelection(["a", "b"], "c", true);
  const updated = hooks.toggleBulkSelection(selected, "b", false);

  assert.deepEqual(JSON.parse(JSON.stringify(updated)).sort(), ["a", "c"]);
});

test("getBulkSelectionState should report all-selected and partial states", () => {
  const hooks = loadHooks();
  const partial = hooks.getBulkSelectionState(["a"], ["a", "b"]);
  const full = hooks.getBulkSelectionState(["a", "b"], ["a", "b"]);

  assert.equal(partial.partiallySelected, true);
  assert.equal(full.allSelected, true);
});

test("buildCsvString should escape commas and quotes safely", () => {
  const hooks = loadHooks();
  const csv = hooks.buildCsvString(
    [
      { key: "name", label: "الاسم" },
      { key: "note", label: "ملاحظات" },
    ],
    [{ name: 'منتج "مميز"', note: "سطر, مهم" }]
  );

  assert.equal(csv.includes('"منتج ""مميز"""'), true);
  assert.equal(csv.includes('"سطر, مهم"'), true);
});
