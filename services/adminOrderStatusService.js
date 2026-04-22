import { formatErrorMessage } from '../functions/_lib/errorCodes.js';

const ORDER_TARGET_TYPES = Object.freeze({
  physical: 'physical_order',
});

const PHYSICAL_ORDER_TARGET_STATUSES = new Set([
  'pending',
  'awaiting_delivery',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'completed',
  'cancelled',
  'failed',
  'refunded',
]);

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
 * Creates a coded admin order-status error.
 *
 * @param {string} code
 * @param {string} message
 * @param {number} statusCode
 * @returns {AdminOrderStatusError}
 */
function createAdminOrderStatusError(code, message, statusCode) {
  return new AdminOrderStatusError(formatErrorMessage(code, message), statusCode);
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
    throw createAdminOrderStatusError('ORM-103', 'نوع الطلب غير مدعوم.', 400);
  }
  if (!orderId) {
    throw createAdminOrderStatusError('ORM-101', 'معرف الطلب مطلوب.', 400);
  }
  if (!status) {
    throw createAdminOrderStatusError('ORM-102', 'حالة الطلب مطلوبة.', 400);
  }

  return { targetType, orderId, status };
}

/**
 * Loads a single row by id from the requested table.
 *
 * @param {{ client: { from: Function }, orderId: string }} input
 * @returns {Promise<Record<string, unknown>>}
 * @throws {AdminOrderStatusError}
 */
async function loadOrderRecord({ client, orderId }) {
  const { data, error } = await client.from('orders').select('id, status').eq('id', orderId).maybeSingle();

  if (error) {
    throw createAdminOrderStatusError('ORM-304', 'تعذر تحميل بيانات الطلب.', 500);
  }
  if (!data) {
    throw new AdminOrderStatusError(formatErrorMessage('ORM-302', 'الطلب الفيزيائي غير موجود.'), 404);
  }

  return data;
}

/**
 * Writes an audit log entry without blocking the main mutation on failure.
 *
 * @param {{
 *   client: { from: Function },
 *   actor: { id?: string, email?: string },
 *   targetId: string,
 *   details: Record<string, unknown>,
 * }} input
 * @returns {Promise<string | null>}
 */
async function insertAuditLog({ client, actor, targetId, details }) {
  const { error } = await client.from('audit_logs').insert([
    {
      action: 'admin_order_status_update',
      actor_id: actor?.id || null,
      actor_email: actor?.email || null,
      target_table: 'orders',
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
    throw createAdminOrderStatusError('ORM-104', 'حالة الطلب الفيزيائي غير صالحة.', 400);
  }

  const order = await loadOrderRecord({ client, orderId });

  if (order.status === status) {
    return { targetType: ORDER_TARGET_TYPES.physical, orderId, status, auditError: null };
  }

  const { data, error } = await client.from('orders').update({ status }).eq('id', orderId).select('id, status').maybeSingle();
  if (error || !data) {
    throw createAdminOrderStatusError('ORM-301', 'تعذر تحديث حالة الطلب الفيزيائي.', 500);
  }

  const auditError = await insertAuditLog({
    client,
    actor,
    targetId: orderId,
    details: { from_status: order.status, to_status: data.status },
  });

  return { targetType: ORDER_TARGET_TYPES.physical, orderId: data.id, status: data.status, auditError };
}

/**
 * Applies an admin-driven order-status mutation.
 *
 * @param {{ client: { from: Function }, actor: { id?: string, email?: string }, payload: unknown }} input
 * @returns {Promise<Record<string, unknown>>}
 * @throws {AdminOrderStatusError}
 */
export async function updateAdminOrderStatus({ client, actor, payload }) {
  const normalized = normalizeAdminOrderStatusPayload(payload);
  return updatePhysicalOrderStatus({ client, actor, orderId: normalized.orderId, status: normalized.status });
}
