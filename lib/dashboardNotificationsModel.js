export const NOTIFICATION_TYPE_META = {
  info: { label: 'معلومة', color: '#3498db', icon: 'ℹ️' },
  success: { label: 'نجاح', color: '#2ecc71', icon: '✅' },
  warning: { label: 'تنبيه', color: '#f39c12', icon: '⚠️' },
  error: { label: 'مهم', color: '#e74c3c', icon: '🚨' },
};

/**
 * Formats notification timestamps using the local Arabic locale.
 *
 * @param {string | null | undefined} value
 * @returns {string}
 */
export function formatNotificationDateTime(value) {
  if (!value) {
    return 'غير متاح';
  }

  return new Date(value).toLocaleString('ar-JO');
}

/**
 * Resolves the linked dashboard route for a notification when available.
 *
 * @param {{ reference_type?: string | null }} notification
 * @returns {string}
 */
export function getNotificationLink(notification) {
  const referenceType = String(notification?.reference_type || '').trim().toLowerCase();

  if (referenceType === 'order') return '/dashboard/orders';
  if (referenceType === 'deposit') return '/dashboard/deposit';
  if (referenceType === 'wallet') return '/dashboard/wallet';
  if (referenceType === 'chat' || referenceType === 'support') return '/contact';

  return '';
}

/**
 * Builds the counters displayed above the notifications list.
 *
 * @param {Array<Record<string, unknown>>} notifications
 * @returns {{ total: number, unread: number, adminBroadcasts: number }}
 */
export function buildNotificationsStats(notifications = []) {
  return {
    total: notifications.length,
    unread: notifications.filter((item) => !item.is_read).length,
    adminBroadcasts: notifications.filter((item) => item.reference_type === 'admin_broadcast')
      .length,
  };
}
