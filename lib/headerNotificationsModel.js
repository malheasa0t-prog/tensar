export const HEADER_NOTIFICATIONS_PREVIEW_LIMIT = 5;

const RELATIVE_TIME_FORMATTER = new Intl.RelativeTimeFormat("ar", { numeric: "auto" });

const HEADER_NOTIFICATION_META = Object.freeze({
  admin_broadcast: { color: "#f59e0b", icon: "sparkles", label: "عروض" },
  chat: { color: "#06b6d4", icon: "message-circle", label: "رسائل" },
  deposit: { color: "#10b981", icon: "wallet", label: "محفظة" },
  order: { color: "#8b5cf6", icon: "package", label: "طلبات" },
  support: { color: "#06b6d4", icon: "message-circle", label: "رسائل" },
  wallet: { color: "#10b981", icon: "wallet", label: "محفظة" },
});

const FALLBACK_NOTIFICATION_META = Object.freeze({
  error: { color: "#ef4444", icon: "circle-alert", label: "تنبيه مهم" },
  info: { color: "#38bdf8", icon: "info", label: "تحديث" },
  success: { color: "#22c55e", icon: "badge-check", label: "نجاح" },
  warning: { color: "#f59e0b", icon: "triangle-alert", label: "تنبيه" },
});

/**
 * Builds a short Arabic label for the unread notifications counter.
 *
 * @param {number} count
 * @returns {string}
 */
export function getUnreadNotificationsLabel(count) {
  if (count <= 0) return "لا توجد إشعارات جديدة";
  if (count === 1) return "لديك إشعار جديد";
  if (count === 2) return "لديك إشعاران جديدان";
  if (count <= 10) return `لديك ${count} إشعارات جديدة`;
  return `لديك ${count} إشعارًا جديدًا`;
}

/**
 * Resolves the header bell tooltip according to auth and unread state.
 *
 * @param {{ authLoading: boolean, isAuthenticated: boolean, unreadCount: number }} options
 * @returns {string}
 */
export function getHeaderNotificationTitle(options) {
  if (options?.authLoading) {
    return "جارٍ تحميل الإشعارات...";
  }

  if (!options?.isAuthenticated) {
    return "سجل الدخول لعرض إشعاراتك";
  }

  return getUnreadNotificationsLabel(Number(options?.unreadCount || 0));
}

/**
 * Chooses the bell target route for unauthenticated users.
 *
 * @param {boolean} isAuthenticated
 * @returns {string}
 */
export function getHeaderNotificationHref(isAuthenticated) {
  return isAuthenticated ? "/dashboard/notifications" : "/auth/login";
}

/**
 * Returns a compact preview list for the header modal.
 *
 * @param {Array<Record<string, unknown>>} notifications
 * @param {number} [limit]
 * @returns {Array<Record<string, unknown>>}
 */
export function getHeaderNotificationsPreview(
  notifications,
  limit = HEADER_NOTIFICATIONS_PREVIEW_LIMIT
) {
  if (!Array.isArray(notifications) || limit <= 0) {
    return [];
  }

  return notifications.slice(0, limit);
}

/**
 * Builds the visual metadata used by each quick notification card.
 *
 * @param {Record<string, unknown>} notification
 * @returns {{ color: string, icon: string, label: string }}
 */
export function getHeaderNotificationVisualMeta(notification) {
  const referenceType = String(notification?.reference_type || "").trim().toLowerCase();
  const notificationType = String(notification?.type || "").trim().toLowerCase();

  return (
    HEADER_NOTIFICATION_META[referenceType] ||
    FALLBACK_NOTIFICATION_META[notificationType] ||
    FALLBACK_NOTIFICATION_META.info
  );
}

/**
 * Formats notification timestamps as relative Arabic time labels.
 *
 * @param {string | null | undefined} value
 * @param {number} [now]
 * @returns {string}
 */
export function formatRelativeNotificationTime(value, now = Date.now()) {
  if (!value) {
    return "غير متاح";
  }

  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) {
    return "غير متاح";
  }

  const deltaSeconds = Math.round((timestamp - now) / 1000);
  const absoluteSeconds = Math.abs(deltaSeconds);

  if (absoluteSeconds < 45) {
    return "الآن";
  }

  if (absoluteSeconds < 3600) {
    return RELATIVE_TIME_FORMATTER.format(Math.round(deltaSeconds / 60), "minute");
  }

  if (absoluteSeconds < 86400) {
    return RELATIVE_TIME_FORMATTER.format(Math.round(deltaSeconds / 3600), "hour");
  }

  if (absoluteSeconds < 604800) {
    return RELATIVE_TIME_FORMATTER.format(Math.round(deltaSeconds / 86400), "day");
  }

  if (absoluteSeconds < 2592000) {
    return RELATIVE_TIME_FORMATTER.format(Math.round(deltaSeconds / 604800), "week");
  }

  return RELATIVE_TIME_FORMATTER.format(Math.round(deltaSeconds / 2592000), "month");
}

/**
 * Checks whether the unread count increased and should trigger a bell animation.
 *
 * @param {number} previousCount
 * @param {number} nextCount
 * @returns {boolean}
 */
export function hasUnreadNotificationsChanged(previousCount, nextCount) {
  return Number(nextCount || 0) > Number(previousCount || 0);
}
