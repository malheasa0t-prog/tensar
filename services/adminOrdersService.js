import { adminFetch } from '@/lib/adminClient';

/**
 * Loads the combined admin orders payload.
 *
 * @returns {Promise<{ productOrders: Array<Record<string, unknown>>, digitalOrders: Array<Record<string, unknown>> }>}
 */
export async function fetchAdminOrdersSnapshot() {
  const payload = await adminFetch('/api/admin/orders');

  return {
    productOrders: payload?.productOrders || [],
    digitalOrders: payload?.digitalOrders || [],
  };
}

/**
 * Persists a status change for either a physical or digital order.
 *
 * @param {{ orderType: string, id: string, status: string }} params
 * @returns {Promise<void>}
 */
export async function updateAdminOrderStatus({ orderType, id, status }) {
  await adminFetch('/api/admin/orders', {
    method: 'PATCH',
    body: JSON.stringify({
      order_type: orderType,
      id,
      status,
    }),
  });
}
