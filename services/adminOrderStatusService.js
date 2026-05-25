import { formatErrorMessage } from '../functions/_lib/errorCodes.js';

const ORDER_TARGET_TYPES = Object.freeze({
  physical: 'physical_order',
});

export const PHYSICAL_ORDER_TARGET_STATUSES = Object.freeze([
  'pending',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
]);

const PHYSICAL_ORDER_STATUS_SET = new Set(PHYSICAL_ORDER_TARGET_STATUSES);

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
 * Maps the database state-machine errors to stable admin API errors.
 *
 * @param {unknown} error
 * @returns {AdminOrderStatusError}
 */
function mapOrderStatusRpcError(error) {
  const message = String(error?.message || '').trim();

  if (message.includes('ORDER_NOT_FOUND')) {
    return createAdminOrderStatusError('ORM-302', 'الطلب الفيزيائي غير موجود.', 404);
  }

  if (message.includes('INVALID_STATUS') || message.includes('ILLEGAL_TRANSITION')) {
    return createAdminOrderStatusError('ORM-104', 'انتقال حالة الطلب الفيزيائي غير صالح.', 400);
  }

  return createAdminOrderStatusError('ORM-301', 'تعذر تحديث حالة الطلب الفيزيائي.', 500);
}

/**
 * Updates a physical-order status through the server.
 *
 * @param {{ client: { rpc: Function }, actor: { id?: string, email?: string }, orderId: string, status: string }} input
 * @returns {Promise<{ targetType: string, orderId: string, status: string, auditError: string | null }>}
 * @throws {AdminOrderStatusError}
 */
async function updatePhysicalOrderStatus({ client, actor, orderId, status }) {
  if (!PHYSICAL_ORDER_STATUS_SET.has(status)) {
    throw createAdminOrderStatusError('ORM-104', 'حالة الطلب الفيزيائي غير صالحة.', 400);
  }

  if (typeof client?.rpc !== 'function') {
    throw createAdminOrderStatusError('ORM-301', 'تعذر تحديث حالة الطلب الفيزيائي.', 500);
  }

  const { data, error } = await client.rpc('admin_set_order_status', {
    p_actor_email: actor?.email || null,
    p_actor_id: actor?.id || null,
    p_new_status: status,
    p_order_id: orderId,
    p_reason: 'admin_panel',
  });

  if (error) {
    throw mapOrderStatusRpcError(error);
  }

  const result = Array.isArray(data) ? data[0] : data;
  return {
    targetType: ORDER_TARGET_TYPES.physical,
    orderId,
    status: result?.current_status || status,
    auditError: null,
    applied: result?.applied === true,
    previousStatus: result?.previous_status || null,
  };
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
