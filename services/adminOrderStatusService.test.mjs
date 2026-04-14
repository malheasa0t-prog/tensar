import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AdminOrderStatusError,
  normalizeAdminOrderStatusPayload,
  updateAdminOrderStatus,
} from './adminOrderStatusService.js';

function createAdminClient({ selectResponses = {}, updateResponses = {}, insertErrors = {}, rpcResponse } = {}) {
  const updates = [];
  const inserts = [];
  const rpcCalls = [];

  return {
    updates,
    inserts,
    rpcCalls,
    client: {
      from(tableName) {
        return {
          select() {
            return {
              eq() {
                return {
                  async maybeSingle() {
                    const queue = selectResponses[tableName] || [];
                    return queue.length ? queue.shift() : { data: null, error: null };
                  },
                };
              },
            };
          },
          update(values) {
            updates.push({ tableName, values });
            return {
              eq(columnName, columnValue) {
                return {
                  select() {
                    return {
                      async maybeSingle() {
                        const queue = updateResponses[tableName] || [];
                        return queue.length
                          ? queue.shift()
                          : { data: { id: columnValue, status: values.status }, error: null };
                      },
                    };
                  },
                };
              },
            };
          },
          async insert(rows) {
            inserts.push({ tableName, rows });
            const queue = insertErrors[tableName] || [];
            return { error: queue.length ? queue.shift() : null };
          },
        };
      },
      async rpc(name, args) {
        rpcCalls.push({ name, args });
        return typeof rpcResponse === 'function' ? rpcResponse(name, args) : rpcResponse;
      },
    },
  };
}

test('normalizeAdminOrderStatusPayload should reject unsupported target types', () => {
  assert.throws(
    () => normalizeAdminOrderStatusPayload({ targetType: 'repair_booking', orderId: '1', status: 'completed' }),
    (error) => error instanceof AdminOrderStatusError && error.statusCode === 400
  );
});

test('updateAdminOrderStatus should update physical orders through the server client', async () => {
  const { client, updates, inserts } = createAdminClient({
    selectResponses: {
      orders: [{ data: { id: 'ord-1', status: 'processing' }, error: null }],
    },
    updateResponses: {
      orders: [{ data: { id: 'ord-1', status: 'completed' }, error: null }],
    },
  });

  const result = await updateAdminOrderStatus({
    client,
    actor: { id: 'admin-1', email: 'admin@example.com' },
    payload: { targetType: 'physical_order', orderId: 'ord-1', status: 'completed' },
  });

  assert.equal(result.status, 'completed');
  assert.deepEqual(updates, [{ tableName: 'orders', values: { status: 'completed' } }]);
  assert.equal(inserts[0].tableName, 'audit_logs');
  assert.equal(inserts[0].rows[0].target_table, 'orders');
});

test('updateAdminOrderStatus should refund digital orders through the transactional RPC', async () => {
  const { client, inserts, rpcCalls } = createAdminClient({
    selectResponses: {
      service_orders: [{
        data: {
          id: 'so-1',
          user_id: 'user-1',
          service_name: 'Instagram Followers',
          status: 'processing',
          total: 20,
        },
        error: null,
      }],
    },
    rpcResponse: {
      data: [{ applied: true, final_status: 'refunded', refund_amount: 20 }],
      error: null,
    },
  });

  const result = await updateAdminOrderStatus({
    client,
    actor: { id: 'admin-1', email: 'admin@example.com' },
    payload: { targetType: 'service_order', orderId: 'so-1', status: 'cancelled' },
  });

  assert.equal(result.status, 'refunded');
  assert.equal(result.refundAmount, 20);
  assert.equal(rpcCalls[0].name, 'sync_service_order_status_tx');
  assert.equal(inserts[0].tableName, 'notifications');
  assert.equal(inserts[1].tableName, 'audit_logs');
});

test('updateAdminOrderStatus should reject stale digital updates', async () => {
  const { client } = createAdminClient({
    selectResponses: {
      service_orders: [{
        data: { id: 'so-1', user_id: 'user-1', service_name: 'Likes', status: 'processing', total: 10 },
        error: null,
      }],
    },
    rpcResponse: {
      data: [{ applied: false, final_status: 'completed', refund_amount: 0 }],
      error: null,
    },
  });

  await assert.rejects(
    () =>
      updateAdminOrderStatus({
        client,
        actor: { id: 'admin-1' },
        payload: { targetType: 'service_order', orderId: 'so-1', status: 'completed' },
      }),
    (error) => error instanceof AdminOrderStatusError && error.statusCode === 409
  );
});
