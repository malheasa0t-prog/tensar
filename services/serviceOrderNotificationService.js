const REFUNDABLE_ORDER_STATUSES = new Set(['failed', 'cancelled']);
const STATUS_LABELS = {
  completed: 'تم إكمال طلبك بنجاح! ✅',
  partial: 'تم تنفيذ طلبك جزئيًا ⚠️',
  failed: 'فشل تنفيذ طلبك ❌',
  cancelled: 'تم إلغاء طلبك 🚫',
  in_progress: 'بدأ تنفيذ طلبك ⚙️',
};
const STATUS_NOTIFICATION_TYPES = { completed: 'success', failed: 'error' };
const NOTIFICATION_INSERT_ERROR_MESSAGE = 'تعذر حفظ إشعار تحديث الطلب.';

/**
 * Builds a user-facing notification for a service-order status transition.
 *
 * @param {{ order: { id: string, user_id: string, service_name: string }, status: string }} input
 * @returns {Record<string, unknown> | null}
 */
function buildStatusNotification({ order, status }) {
  const title = STATUS_LABELS[status];
  if (!title) {
    return null;
  }

  return {
    user_id: order.user_id,
    title,
    body: `الخدمة: ${order.service_name}`,
    type: STATUS_NOTIFICATION_TYPES[status] || 'info',
    reference_type: 'order',
    reference_id: order.id,
  };
}

/**
 * Builds a wallet-refund notification for service orders.
 *
 * @param {{ order: { id: string, user_id: string }, refundAmount: number }} input
 * @returns {Record<string, unknown> | null}
 */
function buildRefundNotification({ order, refundAmount }) {
  if (!(refundAmount > 0)) {
    return null;
  }

  return {
    user_id: order.user_id,
    title: 'تم استرجاع رصيدك 💰',
    body: `تم إعادة ${refundAmount.toFixed(2)} د.أ إلى محفظتك بسبب تحديث حالة الطلب.`,
    type: 'success',
    reference_type: 'order',
    reference_id: order.id,
  };
}

/**
 * Produces the notification set for a service-order status update.
 *
 * @param {{
 *   order: { id: string, user_id: string, service_name: string },
 *   requestedStatus: string,
 *   finalStatus: string,
 *   refundAmount: number,
 * }} input
 * @returns {Array<Record<string, unknown>>}
 */
export function buildServiceOrderNotifications({ order, requestedStatus, finalStatus, refundAmount }) {
  const statusForNotification =
    finalStatus === 'refunded' && REFUNDABLE_ORDER_STATUSES.has(requestedStatus)
      ? requestedStatus
      : finalStatus;
  const notifications = [];
  const statusNotification = buildStatusNotification({ order, status: statusForNotification });
  const refundNotification = buildRefundNotification({ order, refundAmount });

  if (statusNotification) {
    notifications.push(statusNotification);
  }
  if (refundNotification) {
    notifications.push(refundNotification);
  }

  return notifications;
}

/**
 * Stores notifications without breaking the caller if delivery fails.
 *
 * @param {{
 *   client: { from: (tableName: string) => { insert: (rows: Array<Record<string, unknown>>) => Promise<{ error?: { message?: string } | null }> } },
 *   notifications: Array<Record<string, unknown>>,
 * }} input
 * @returns {Promise<string | null>}
 */
export async function insertServiceOrderNotifications({ client, notifications }) {
  if (!Array.isArray(notifications) || notifications.length === 0) {
    return null;
  }

  const { error } = await client.from('notifications').insert(notifications);
  return error ? NOTIFICATION_INSERT_ERROR_MESSAGE : null;
}
