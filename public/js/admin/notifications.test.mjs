import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const SCRIPT_SOURCE = fs.readFileSync(new URL("./notifications.helpers.js", import.meta.url), "utf8");

function normalizeValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadNotificationHooks() {
  const window = {
    __ENABLE_NOTIFICATION_ADMIN_TEST_HOOKS__: true,
    AdminApp: {
      sections: {},
    },
  };
  const context = {
    window,
    document: {
      getElementById() {
        return null;
      },
      querySelectorAll() {
        return [];
      },
    },
  };

  vm.createContext(context);
  vm.runInContext(SCRIPT_SOURCE, context, { filename: "public/js/admin/notifications.helpers.js" });

  return window.__notificationAdminTestHooks;
}

test("getCustomerRecipients should keep active customer accounts only", () => {
  const hooks = loadNotificationHooks();
  const users = [
    { id: "user-1", role: "user", status: "active", fullName: "User One" },
    { id: "user-2", role: "admin", status: "active", fullName: "Admin One" },
    { id: "user-3", role: "user", status: "inactive", fullName: "User Two" },
    { id: "user-4", role: "customer", status: "active", fullName: "User Three" },
  ];

  const recipients = hooks.getCustomerRecipients(users);

  assert.deepEqual(normalizeValue(recipients), [
    { id: "user-1", role: "user", status: "active", fullName: "User One" },
    { id: "user-4", role: "customer", status: "active", fullName: "User Three" },
  ]);
});

test("buildNotificationRows should create admin broadcast rows for all recipients", () => {
  const hooks = loadNotificationHooks();
  const rows = hooks.buildNotificationRows({
    audience: "all",
    title: "رسالة من الإدارة",
    body: "يرجى مراجعة الإشعارات الجديدة.",
    type: "warning",
    recipients: [
      { id: "user-1", fullName: "User One", email: "one@example.com" },
      { id: "user-2", fullName: "User Two", email: "two@example.com" },
    ],
  });

  assert.deepEqual(normalizeValue(rows), [
    {
      user_id: "user-1",
      title: "رسالة من الإدارة",
      body: "يرجى مراجعة الإشعارات الجديدة.",
      type: "warning",
      reference_type: "admin_broadcast",
      reference_id: null,
      metadata: {
        audience: "all",
        source: "legacy_admin",
        recipient_name: "User One",
        recipient_email: "one@example.com",
      },
    },
    {
      user_id: "user-2",
      title: "رسالة من الإدارة",
      body: "يرجى مراجعة الإشعارات الجديدة.",
      type: "warning",
      reference_type: "admin_broadcast",
      reference_id: null,
      metadata: {
        audience: "all",
        source: "legacy_admin",
        recipient_name: "User Two",
        recipient_email: "two@example.com",
      },
    },
  ]);
});

test("buildNotificationRows should reject empty titles for single-recipient messages", () => {
  const hooks = loadNotificationHooks();

  assert.throws(
    () =>
      hooks.buildNotificationRows({
        audience: "single",
        title: "   ",
        body: "تفاصيل الرسالة",
        type: "info",
        recipients: [{ id: "user-1", fullName: "User One", email: "one@example.com" }],
      }),
    /أدخل عنوان الرسالة/
  );
});

test("buildInsertBatches should split large inserts into fixed-size chunks", () => {
  const hooks = loadNotificationHooks();
  const rows = Array.from({ length: 401 }, (_, index) => ({ user_id: `user-${index + 1}` }));
  const batches = hooks.buildInsertBatches(rows);

  assert.deepEqual(
    normalizeValue(batches.map((batch) => batch.length)),
    [200, 200, 1]
  );
});

test("getAudienceHint should describe the selected audience mode", () => {
  const hooks = loadNotificationHooks();

  assert.equal(
    hooks.getAudienceHint({
      audience: "single",
      selectedUser: { fullName: "User One" },
      totalRecipients: 10,
    }),
    "سيتم الإرسال إلى User One فقط."
  );
});
