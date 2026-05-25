import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AdminOrderStatusError,
  normalizeAdminOrderStatusPayload,
  updateAdminOrderStatus,
} from './adminOrderStatusService.js';

function createAdminClient({ rpcResponses = {} } = {}) {
  const rpcCalls = [];

  return {
    rpcCalls,
    client: {
      async rpc(functionName, args) {
        rpcCalls.push({ functionName, args });
        const queue = rpcResponses[functionName] || [];
        return queue.length
          ? queue.shift()
          : {
              data: [{ applied: true, current_status: args.p_new_status, previous_status: 'processing' }],
              error: null,
            };
      },
    },
  };
}

test('normalizeAdminOrderStatusPayload should reject unsupported target types', () => {
  assert.throws(
    () => normalizeAdminOrderStatusPayload({ targetType: 'repair_booking', orderId: '1', status: 'delivered' }),
    (error) => error instanceof AdminOrderStatusError
      && error.statusCode === 400
      && error.message.startsWith('[ORM-103]')
  );
});

test('updateAdminOrderStatus should reject legacy physical-order statuses', async () => {
  const { client } = createAdminClient();

  await assert.rejects(
    () => updateAdminOrderStatus({
      client,
      actor: { id: 'admin-1', email: 'admin@example.com' },
      payload: { targetType: 'physical_order', orderId: '1', status: 'completed' },
    }),
    (error) => error instanceof AdminOrderStatusError
      && error.statusCode === 400
      && error.message.startsWith('[ORM-104]')
  );
});

test('updateAdminOrderStatus should update physical orders through the state-machine RPC', async () => {
  const { client, rpcCalls } = createAdminClient();

  const result = await updateAdminOrderStatus({
    client,
    actor: { id: 'admin-1', email: 'admin@example.com' },
    payload: { targetType: 'physical_order', orderId: 'ord-1', status: 'delivered' },
  });

  assert.equal(result.status, 'delivered');
  assert.deepEqual(rpcCalls, [
    {
      functionName: 'admin_set_order_status',
      args: {
        p_actor_email: 'admin@example.com',
        p_actor_id: 'admin-1',
        p_new_status: 'delivered',
        p_order_id: 'ord-1',
        p_reason: 'admin_panel',
      },
    },
  ]);
});

test('updateAdminOrderStatus should surface no-op state-machine responses', async () => {
  const { client } = createAdminClient({
    rpcResponses: {
      admin_set_order_status: [
        { data: [{ applied: false, previous_status: 'delivered', current_status: 'delivered' }], error: null },
      ],
    },
  });

  const result = await updateAdminOrderStatus({
    client,
    actor: { id: 'admin-1', email: 'admin@example.com' },
    payload: { targetType: 'physical_order', orderId: 'ord-1', status: 'delivered' },
  });

  assert.equal(result.status, 'delivered');
  assert.equal(result.applied, false);
  assert.equal(result.previousStatus, 'delivered');
});

test('updateAdminOrderStatus should reject missing physical orders', async () => {
  const { client } = createAdminClient({
    rpcResponses: {
      admin_set_order_status: [
        { data: null, error: { message: 'ORDER_NOT_FOUND' } },
      ],
    },
  });

  await assert.rejects(
    () =>
      updateAdminOrderStatus({
        client,
        actor: { id: 'admin-1' },
        payload: { targetType: 'physical_order', orderId: 'ord-404', status: 'delivered' },
      }),
    (error) => error instanceof AdminOrderStatusError
      && error.statusCode === 404
      && error.message.startsWith('[ORM-302]')
  );
});
