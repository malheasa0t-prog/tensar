export const NOTIFICATION_TYPE_META = {
  info: { label: "معلومة", color: "#3498db", icon: "ℹ️" },
  success: { label: "نجاح", color: "#2ecc71", icon: "✅" },
  warning: { label: "تنبيه", color: "#f39c12", icon: "⚠️" },
  error: { label: "مهم", color: "#e74c3c", icon: "🚨" },
};

const INTERNAL_REFERENCE_TYPES = new Set(["restock_subscription"]);

/**
 * Formats notification timestamps using the local Arabic locale.
 *
 * @param {string | null | undefined} value
 * @returns {string}
 */
export function formatNotificationDateTime(value) {
  if (!value) {
    return "غير متاح";
  }

  return new Date(value).toLocaleString("ar-JO");
}

/**
 * Returns whether the notification should be visible in the user-facing center.
 *
 * @param {{ reference_type?: string | null }} notification
 * @returns {boolean}
 */
export function isVisibleNotification(notification) {
  const referenceType = String(notification?.reference_type || "").trim().toLowerCase();
  return !INTERNAL_REFERENCE_TYPES.has(referenceType);
}

/**
 * Removes internal notification rows from a result list.
 *
 * @param {Array<Record<string, unknown>>} notifications
 * @returns {Array<Record<string, unknown>>}
 */
export function filterVisibleNotifications(notifications = []) {
  return (Array.isArray(notifications) ? notifications : []).filter(isVisibleNotification);
}

/**
 * Resolves the linked route for a notification when available.
 *
 * @param {{ reference_type?: string | null, reference_id?: string | null }} notification
 * @returns {string}
 */
export function getNotificationLink(notification) {
  const referenceType = String(notification?.reference_type || "").trim().toLowerCase();

  if (referenceType === "order") return "/dashboard/orders";
  if (referenceType === "deposit") return "/dashboard/deposit";
  if (referenceType === "wallet") return "/dashboard/wallet";
  if (referenceType === "chat" || referenceType === "support") return "/contact";
  if (referenceType === "product" && notification?.reference_id) return "/services";

  return "";
}

/**
 * Builds the counters displayed above the notifications list.
 *
 * @param {Array<Record<string, unknown>>} notifications
 * @returns {{ total: number, unread: number, adminBroadcasts: number }}
 */
export function buildNotificationsStats(notifications = []) {
  const visibleNotifications = filterVisibleNotifications(notifications);

  return {
    total: visibleNotifications.length,
    unread: visibleNotifications.filter((item) => !item.is_read).length,
    adminBroadcasts: visibleNotifications.filter((item) => item.reference_type === "admin_broadcast").length,
  };
}
