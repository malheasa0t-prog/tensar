import { adminFetch } from '@/lib/adminClient';

/**
 * Loads the products dashboard payload from the admin API.
 *
 * @returns {Promise<{ products: Array<Record<string, unknown>>, categories: Array<Record<string, unknown>> }>}
 */
export async function fetchAdminProductsData() {
  const payload = await adminFetch('/api/admin/products');

  return {
    products: payload?.products || [],
    categories: payload?.categories || [],
  };
}

/**
 * Creates a new catalog product through the admin API.
 *
 * @param {Record<string, unknown>} payload
 * @returns {Promise<unknown>}
 */
export async function createAdminProduct(payload) {
  return adminFetch('/api/admin/products', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Persists edits for an existing product through the admin API.
 *
 * @param {string} id
 * @param {Record<string, unknown>} payload
 * @returns {Promise<unknown>}
 */
export async function updateAdminProduct(id, payload) {
  return adminFetch('/api/admin/products', {
    method: 'PATCH',
    body: JSON.stringify({
      id,
      ...payload,
    }),
  });
}
