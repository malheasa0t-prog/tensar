import { persistServiceOrderSyncState } from './serviceOrderSyncService.js';
import {
  buildServiceOrderNotifications,
  insertServiceOrderNotifications,
} from './serviceOrderNotificationService.js';

const ORDER_TARGET_TYPES = {
  physical: 'physical_order',
  service: 'service_order',
};
const PHYSICAL_ORDER_TARGET_STATUSES = new Set(['awaiting_delivery', 'processing', 'completed', 'cancelled', 'failed']);
const SERVICE_ORDER_TARGET_STATUSES = new Set(['processing', 'in_progress', 'completed', 'failed', 'cancelled']);

/**
 * Error type used for expected admin order-status failures.
 */
export class AdminOrderStatusError extends Error {
  /**
   * @param {string} message
   * @param {number} statusCode
   */
  constructor(message, statusCode) {
    super(message);
    this.name = 'AdminOrderStatusError';
    this.statusCode = statusCode;
  }
}

/**
 * Normalizes a text input to a trimmed lowercase string.
 *
 * @param {unknown} value
 * @returns {string}
 */
function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

/**
 * Normalizes an order identifier to a trimmed string.
 *
 * @param {unknown} value
 * @returns {string}
 */
function normalizeOrderId(value) {
  return String(value || '').trim();
}

/**
 * Validates the admin mutation payload.
 *
 * @param {unknown} payload
 * @returns {{ targetType: string, orderId: string, status: string }}
 * @throws {AdminOrderStatusError}
 */
export function normalizeAdminOrderStatusPayload(payload) {
  const targetType = normalizeText(payload?.targetType);
  const orderId = normalizeOrderId(payload?.orderId || payload?.id);
  const status = normalizeText(payload?.status);

  if (!Object.values(ORDER_TARGET_TYPES).includes(targetType)) {
    throw new AdminOrderStatusError('نوع الطلب غير مدعوم.', 400);
  }
  if (!orderId) {
    throw new AdminOrderStatusError('معرف الطلب مطلوب.', 400);
  }
  if (!status) {
    throw new AdminOrderStatusError('حالة الطلب مطلوبة.', 400);
  }

  return { targetType, orderId, status };
}

/**
 * Loads a single row by id from the requested table.
 *
 * @param {{ client: { from: Function }, tableName: string, orderId: string, columns: string, missingMessage: string }} input
 * @returns {Promise<Record<string, unknown>>}
 * @throws {AdminOrderStatusError}
 */
async function loadOrderRecord({ client, tableName, orderId, columns, missingMessage }) {
  const { data, error } = await client.from(tableName).select(columns).eq('id', orderId).maybeSingle();
  if (error) {
    throw new AdminOrderStatusError('تعذر تحميل الطلب.', 500);
  }
  if (!data) {
    throw new AdminOrderStatusError(missingMessage, 404);
  }
  return data;
}

/**
 * Writes an audit log entry without blocking the main mutation on failure.
 *
 * @param {{
 *   client: { from: Function },
 *   actor: { id?: string, email?: string },
 *   action: string,
 *   targetTable: string,
 *   targetId: string,
 *   details: Record<string, unknown>,
 * }} input
 * @returns {Promise<string | null>}
 */
async function insertAuditLog({ client, actor, action, targetTable, targetId, details }) {
  const { error } = await client.from('audit_logs').insert([
    {
      action,
      actor_id: actor?.id || null,
      actor_email: actor?.email || null,
      target_table: targetTable,
      target_id: targetId,
      details,
    },
  ]);

  return error?.message || null;
}

/**
 * Updates a physical-order status through the server.
 *
 * @param {{ client: { from: Function }, actor: { id?: string, email?: string }, orderId: string, status: string }} input
 * @returns {Promise<{ targetType: string, orderId: string, status: string, auditError: string | null }>}
 * @throws {AdminOrderStatusError}
 */
async function updatePhysicalOrderStatus({ client, actor, orderId, status }) {
  if (!PHYSICAL_ORDER_TARGET_STATUSES.has(status)) {
    throw new AdminOrderStatusError('حالة الطلب الفيزيائي غير صالحة.', 400);
  }

  const order = await loadOrderRecord({
    client,
    tableName: 'orders',
    orderId,
    columns: 'id, status',
    missingMessage: 'الطلب الفيزيائي غير موجود.',
  });

  if (order.status === status) {
    return { targetType: ORDER_TARGET_TYPES.physical, orderId, status, auditError: null };
  }

  const { data, error } = await client.from('orders').update({ status }).eq('id', orderId).select('id, status').maybeSingle();
  if (error || !data) {
    throw new AdminOrderStatusError('تعذر تحديث حالة الطلب الفيزيائي.', 500);
  }

  const auditError = await insertAuditLog({
    client,
    actor,
    action: 'admin_order_status_update',
    targetTable: 'orders',
    targetId: orderId,
    details: { from_status: order.status, to_status: data.status },
  });

  return { targetType: ORDER_TARGET_TYPES.physical, orderId: data.id, status: data.status, auditError };
}

/**
 * Updates a service-order status through the transactional RPC.
 *
 * @param {{ client: { from: Function, rpc: Function }, actor: { id?: string, email?: string }, orderId: string, status: string }} input
 * @returns {Promise<{ targetType: string, orderId: string, status: string, refundAmount: number, notificationError: string | null, auditError: string | null }>}
 * @throws {AdminOrderStatusError}
 */
async function updateServiceOrderStatus({ client, actor, orderId, status }) {
  if (!SERVICE_ORDER_TARGET_STATUSES.has(status)) {
    throw new AdminOrderStatusError('حالة الطلب الرقمي غير صالحة.', 400);
  }

  const order = await loadOrderRecord({
    client,
    tableName: 'service_orders',
    orderId,
    columns: 'id, user_id, service_name, status, total',
    missingMessage: 'الطلب الرقمي غير موجود.',
  });

  if (order.status === status) {
    return {
      targetType: ORDER_TARGET_TYPES.service,
      orderId,
      status,
      refundAmount: 0,
      notificationError: null,
      auditError: null,
    };
  }

  const persistResult = await persistServiceOrderSyncState({
    order,
    newStatus: status,
    providerResult: {},
    client,
  });

  if (!persistResult.applied) {
    throw new AdminOrderStatusError('تم تحديث حالة الطلب من جلسة أخرى. أعد تحميل البيانات.', 409);
  }

  const notificationError = await insertServiceOrderNotifications({
    client,
    notifications: buildServiceOrderNotifications({
      order,
      requestedStatus: status,
      finalStatus: persistResult.finalStatus,
      refundAmount: persistResult.refundAmount,
    }),
  });
  const auditError = await insertAuditLog({
    client,
    actor,
    action: 'admin_service_order_status_update',
    targetTable: 'service_orders',
    targetId: orderId,
    details: {
      from_status: order.status,
      requested_status: status,
      final_status: persistResult.finalStatus,
      refund_amount: persistResult.refundAmount,
    },
  });

  return {
    targetType: ORDER_TARGET_TYPES.service,
    orderId,
    status: persistResult.finalStatus,
    refundAmount: persistResult.refundAmount,
    notificationError,
    auditError,
  };
}

/**
 * Applies an admin-driven order-status mutation.
 *
 * @param {{ client: { from: Function, rpc?: Function }, actor: { id?: string, email?: string }, payload: unknown }} input
 * @returns {Promise<Record<string, unknown>>}
 * @throws {AdminOrderStatusError}
 */
export async function updateAdminOrderStatus({ client, actor, payload }) {
  const normalized = normalizeAdminOrderStatusPayload(payload);

  if (normalized.targetType === ORDER_TARGET_TYPES.physical) {
    return updatePhysicalOrderStatus({ client, actor, orderId: normalized.orderId, status: normalized.status });
  }

  return updateServiceOrderStatus({ client, actor, orderId: normalized.orderId, status: normalized.status });
}
