import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const SCRIPT_SOURCE = fs.readFileSync(new URL("./customers.helpers.js", import.meta.url), "utf8");

function loadHooks() {
  const window = { __ENABLE_ADMIN_CUSTOMERS_TEST_HOOKS__: true };
  const context = vm.createContext({ window });
  vm.runInContext(SCRIPT_SOURCE, context, { filename: "public/js/admin/customers.helpers.js" });
  return window.__adminCustomerTestHooks;
}

function normalizeValue(value) {
  return JSON.parse(JSON.stringify(value));
}

test("buildCustomerProfile should summarize customer spend and order count", () => {
  const hooks = loadHooks();
  const profile = hooks.buildCustomerProfile({
    user: { id: "user-1", fullName: "أحمد", status: "active", email: "a@example.com" },
    orders: [
      { id: "ord-1", userId: "user-1", customerName: "أحمد", total: 20, status: "processing", createdAt: "2026-04-01T10:00:00Z" },
      { id: "ord-2", userId: "user-1", customerName: "أحمد", total: 15, status: "completed", createdAt: "2026-04-02T10:00:00Z" }
    ]
  });

  assert.equal(profile.orderCount, 2);
  assert.equal(profile.totalSpend, 35);
  assert.equal(profile.lastOrderAt, "2026-04-02T10:00:00Z");
});

test("filterCustomerProfiles should filter by status and search query", () => {
  const hooks = loadHooks();
  const profiles = [
    { searchableText: "أحمد ahmad@example.com 079", status: "active" },
    { searchableText: "سارة sara@example.com 078", status: "inactive" }
  ];

  const filtered = hooks.filterCustomerProfiles({
    profiles,
    searchQuery: "ahmad",
    statusFilter: "active"
  });

  assert.deepEqual(normalizeValue(filtered), [
    { searchableText: "أحمد ahmad@example.com 079", status: "active" }
  ]);
});

test("collectOrderActivity should keep product activity in reverse chronological order", () => {
  const hooks = loadHooks();
  const activity = hooks.collectOrderActivity(
    "user-1",
    [
      { id: "ord-1", userId: "user-1", customerName: "أحمد", total: 20, createdAt: "2026-04-01T10:00:00Z" },
      { id: "ord-2", userId: "user-1", customerName: "أحمد", total: 15, createdAt: "2026-04-03T10:00:00Z" }
    ],
    []
  );

  assert.deepEqual(
    normalizeValue(activity.map((item) => item.id)),
    ["ord-2", "ord-1"]
  );
});
