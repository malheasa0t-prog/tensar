import assert from 'node:assert/strict';
import test from 'node:test';

import { createAdminOrderStatusHandlers } from './status.js';

/**
 * Creates a mock Cloudflare Pages context object.
 *
 * @param {Request} request
 * @returns {{ request: Request, env: Record<string, string> }}
 */
function createContext(request) {
  return { request, env: {} };
}

test('onRequestPost should forward auth failures from requireAdminAccess', async () => {
  const handlers = createAdminOrderStatusHandlers({
    requireAdminAccess: async () => ({
      user: null,
      errorResponse: Response.json({ success: false, error: '[ADM-203] صلاحيات غير كافية', code: 'ADM-203' }, { status: 403 }),
    }),
  });

  const response = await handlers.onRequestPost(
    createContext(new Request('https://tensr.systems/api/admin/orders/status', { method: 'POST' }))
  );
  const payload = await response.json();

  assert.equal(response.status, 403);
  assert.equal(payload.code, 'ADM-203');
});

test('onRequestPost should update admin order status through injected dependencies', async () => {
  const updates = [];
  const handlers = createAdminOrderStatusHandlers({
    requireAdminAccess: async () => ({
      user: { id: 'admin-1', email: 'admin@example.com' },
      errorResponse: null,
    }),
    createSupabaseAdmin: () => ({ tag: 'admin-client' }),
    updateAdminOrderStatus: async (input) => {
      updates.push(input);
      return {
        orderId: 'ord-1',
        targetType: 'physical_order',
        status: 'completed',
        auditError: null,
        notificationError: null,
      };
    },
  });

  const response = await handlers.onRequestPost(createContext(new Request(
    'https://tensr.systems/api/admin/orders/status',
    {
      method: 'POST',
      body: JSON.stringify({ orderId: 'ord-1', status: 'completed', targetType: 'physical_order' }),
      headers: { 'Content-Type': 'application/json' },
    }
  )));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.equal(payload.orderId, 'ord-1');
  assert.equal(updates[0].actor.email, 'admin@example.com');
  assert.equal(updates[0].client.tag, 'admin-client');
});

test('onRequestPost should return a coded validation error for invalid JSON bodies', async () => {
  const handlers = createAdminOrderStatusHandlers({
    requireAdminAccess: async () => ({
      user: { id: 'admin-1', email: 'admin@example.com' },
      errorResponse: null,
    }),
  });

  const response = await handlers.onRequestPost(createContext(new Request(
    'https://tensr.systems/api/admin/orders/status',
    {
      method: 'POST',
      body: '{invalid-json',
      headers: { 'Content-Type': 'application/json' },
    }
  )));
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.code, 'ORM-106');
});

test('onRequestPost should preserve coded business errors from the service layer', async () => {
  const handlers = createAdminOrderStatusHandlers({
    requireAdminAccess: async () => ({
      user: { id: 'admin-1', email: 'admin@example.com' },
      errorResponse: null,
    }),
    createSupabaseAdmin: () => ({}),
    updateAdminOrderStatus: async () => {
      throw new Error('[ORM-302] الطلب الفيزيائي غير موجود.');
    },
  });

  const response = await handlers.onRequestPost(createContext(new Request(
    'https://tensr.systems/api/admin/orders/status',
    {
      method: 'POST',
      body: JSON.stringify({ orderId: 'ord-404', status: 'completed', targetType: 'physical_order' }),
      headers: { 'Content-Type': 'application/json' },
    }
  )));
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.code, 'ORM-302');
});
