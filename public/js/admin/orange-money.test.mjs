import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const SCRIPT_SOURCE = fs.readFileSync(new URL("./orange-money.js", import.meta.url), "utf8");

function normalize(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadHooks() {
  const window = {
    __ENABLE_ORANGE_MONEY_ADMIN_TEST_HOOKS__: true,
    AdminApp: {
      adminContent: { innerHTML: "" },
      sections: {},
    },
  };
  const document = {
    getElementById() {
      return null;
    },
  };
  const context = {
    TZ: {
      db: { orangeMoneyLogs: [] },
      escapeHtml(value) {
        return String(value || "");
      },
    },
    document,
    window,
  };

  vm.createContext(context);
  vm.runInContext(SCRIPT_SOURCE, context, { filename: "public/js/admin/orange-money.js" });
  return window.__orangeMoneyAdminTestHooks;
}

test("getStatusMeta should resolve Arabic status labels", () => {
  const hooks = loadHooks();

  assert.deepEqual(normalize(hooks.getStatusMeta("processed")), {
    label: "تمت المعالجة",
    color: "#2ecc71",
  });
  assert.equal(hooks.getStatusMeta("unknown").label, "unknown");
});

test("getTargetLabel should resolve operation targets", () => {
  const hooks = loadHooks();

  assert.equal(hooks.getTargetLabel("deposit"), "إيداع");
  assert.equal(hooks.getTargetLabel("direct_wallet_topup"), "شحن مباشر");
  assert.equal(hooks.getTargetLabel("missing"), "-");
});

test("filterOrangeMoneyLogs should filter by status and query", () => {
  const hooks = loadHooks();
  const logs = [
    { referenceId: "REF-1", status: "processed", payerPhone: "0771234567" },
    { referenceId: "REF-2", status: "failed", errorMessage: "no user" },
  ];

  assert.deepEqual(hooks.filterOrangeMoneyLogs(logs, { status: "processed" }), [logs[0]]);
  assert.deepEqual(hooks.filterOrangeMoneyLogs(logs, { query: "no user" }), [logs[1]]);
});

test("formatAmount should format Jordanian dinar values", () => {
  const hooks = loadHooks();

  assert.equal(hooks.formatAmount(12), "12.00 د.أ");
});
