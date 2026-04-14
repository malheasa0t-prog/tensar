import test from "node:test";
import assert from "node:assert/strict";
import {
  HEADER_NOTIFICATIONS_PREVIEW_LIMIT,
  formatRelativeNotificationTime,
  getHeaderNotificationHref,
  getHeaderNotificationsPreview,
  getHeaderNotificationTitle,
  getHeaderNotificationVisualMeta,
  getUnreadNotificationsLabel,
  hasUnreadNotificationsChanged,
} from "./headerNotificationsModel.js";

test("getUnreadNotificationsLabel should return zero-state copy", () => {
  assert.equal(getUnreadNotificationsLabel(0), "لا توجد إشعارات جديدة");
});

test("getHeaderNotificationTitle should respect loading and auth state", () => {
  assert.equal(
    getHeaderNotificationTitle({ authLoading: true, isAuthenticated: true, unreadCount: 3 }),
    "جارٍ تحميل الإشعارات..."
  );
  assert.equal(
    getHeaderNotificationTitle({ authLoading: false, isAuthenticated: false, unreadCount: 0 }),
    "سجل الدخول لعرض إشعاراتك"
  );
});

test("getHeaderNotificationHref should route guests to login", () => {
  assert.equal(getHeaderNotificationHref(true), "/dashboard/notifications");
  assert.equal(getHeaderNotificationHref(false), "/auth/login");
});

test("getHeaderNotificationsPreview should keep only the preview limit", () => {
  const items = Array.from({ length: HEADER_NOTIFICATIONS_PREVIEW_LIMIT + 2 }, (_, index) => ({
    id: index + 1,
  }));

  assert.equal(getHeaderNotificationsPreview(items).length, HEADER_NOTIFICATIONS_PREVIEW_LIMIT);
  assert.deepEqual(getHeaderNotificationsPreview(null), []);
});

test("getHeaderNotificationVisualMeta should prioritize the reference type category", () => {
  assert.deepEqual(getHeaderNotificationVisualMeta({ reference_type: "order", type: "info" }), {
    color: "#8b5cf6",
    icon: "package",
    label: "طلبات",
  });
});

test("formatRelativeNotificationTime should expose human-friendly labels", () => {
  const now = Date.UTC(2026, 3, 7, 12, 0, 0);
  assert.equal(formatRelativeNotificationTime(new Date(now).toISOString(), now), "الآن");
  assert.notEqual(
    formatRelativeNotificationTime(new Date(now - 5 * 60 * 1000).toISOString(), now),
    "غير متاح"
  );
});

test("hasUnreadNotificationsChanged should detect unread increases only", () => {
  assert.equal(hasUnreadNotificationsChanged(1, 3), true);
  assert.equal(hasUnreadNotificationsChanged(3, 3), false);
  assert.equal(hasUnreadNotificationsChanged(3, 1), false);
});
