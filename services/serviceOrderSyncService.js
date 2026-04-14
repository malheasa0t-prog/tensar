const SERVICE_ORDER_SYNC_RPC_NAME = 'sync_service_order_status_tx';
const SYNC_PERSIST_ERROR_MESSAGE = 'تعذر حفظ نتيجة مزامنة الطلب.';

/**
 * Converts a provider counter value to a safe integer or null.
 *
 * @param {unknown} value
 * @returns {number | null}
 */
function normalizeOptionalCounter(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

/**
 * Builds the RPC payload used to persist a synced service-order status.
 *
 * @param {{
 *   order: { id: string, status: string },
 *   newStatus: string,
 *   providerResult: { startCount?: unknown, remains?: unknown },
 * }} input
 * @returns {{
 *   p_order_id: string,
 *   p_expected_status: string,
 *   p_new_status: string,
 *   p_start_count: number | null,
 *   p_remains: number | null,
 * }}
 */
export function buildServiceOrderSyncRpcParams({ order, newStatus, providerResult }) {
  return {
    p_order_id: String(order?.id || '').trim(),
    p_expected_status: String(order?.status || '').trim(),
    p_new_status: String(newStatus || '').trim(),
    p_start_count: normalizeOptionalCounter(providerResult?.startCount),
    p_remains: normalizeOptionalCounter(providerResult?.remains),
  };
}

/**
 * Persists the synced status using the DB-side transactional RPC.
 *
 * @param {{
 *   order: { id: string, status: string },
 *   newStatus: string,
 *   providerResult: { startCount?: unknown, remains?: unknown },
 *   client: { rpc: (name: string, args: Record<string, unknown>) => Promise<{ data?: unknown, error?: unknown }> },
 * }} input
 * @returns {Promise<{ applied: boolean, finalStatus: string, refundAmount: number }>}
 * @throws {Error}
 */
export async function persistServiceOrderSyncState({ order, newStatus, providerResult, client }) {
  const args = buildServiceOrderSyncRpcParams({ order, newStatus, providerResult });
  const response = await client.rpc(SERVICE_ORDER_SYNC_RPC_NAME, args);

  if (response?.error) {
    throw new Error(SYNC_PERSIST_ERROR_MESSAGE);
  }

  const payload = Array.isArray(response?.data) ? response.data[0] : response?.data;
  return {
    applied: payload?.applied === true,
    finalStatus: typeof payload?.final_status === 'string' && payload.final_status.trim()
      ? payload.final_status.trim()
      : String(newStatus || '').trim(),
    refundAmount: Number(payload?.refund_amount || 0),
  };
}
