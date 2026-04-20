import assert from "node:assert/strict";
import test from "node:test";
import {
  buildNotificationsStats,
  filterVisibleNotifications,
  getNotificationLink,
  isVisibleNotification,
} from "./dashboardNotificationsModel.js";

test("isVisibleNotification should hide internal restock subscription rows", () => {
  assert.equal(isVisibleNotification({ reference_type: "restock_subscription" }), false);
  assert.equal(isVisibleNotification({ reference_type: "order" }), true);
});

test("filterVisibleNotifications should remove hidden internal rows", () => {
  assert.deepEqual(
    filterVisibleNotifications([
      { id: "1", reference_type: "restock_subscription" },
      { id: "2", reference_type: "order" },
    ]).map((item) => item.id),
    ["2"]
  );
});

test("getNotificationLink should route product notifications to their product page", () => {
  assert.equal(getNotificationLink({ reference_type: "product", reference_id: "prd-7" }), "/products/prd-7");
});

test("buildNotificationsStats should count visible rows only", () => {
  assert.deepEqual(
    buildNotificationsStats([
      { id: "1", reference_type: "restock_subscription", is_read: true },
      { id: "2", reference_type: "admin_broadcast", is_read: false },
      { id: "3", reference_type: "order", is_read: true },
    ]),
    {
      total: 2,
      unread: 1,
      adminBroadcasts: 1,
    }
  );
});
