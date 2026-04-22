import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AdminOrderStatusError,
  normalizeAdminOrderStatusPayload,
  updateAdminOrderStatus,
} from './adminOrderStatusService.js';

function createAdminClient({ selectResponses = {}, updateResponses = {}, insertErrors = {} } = {}) {
  const updates = [];
  const inserts = [];

  return {
    updates,
    inserts,
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
    },
  };
}

test('normalizeAdminOrderStatusPayload should reject unsupported target types', () => {
  assert.throws(
    () => normalizeAdminOrderStatusPayload({ targetType: 'repair_booking', orderId: '1', status: 'completed' }),
    (error) => error instanceof AdminOrderStatusError
      && error.statusCode === 400
      && error.message.startsWith('[ORM-103]')
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

test('updateAdminOrderStatus should return early when the order is already in the same status', async () => {
  const { client, updates, inserts } = createAdminClient({
    selectResponses: {
      orders: [{ data: { id: 'ord-1', status: 'completed' }, error: null }],
    },
  });

  const result = await updateAdminOrderStatus({
    client,
    actor: { id: 'admin-1', email: 'admin@example.com' },
    payload: { targetType: 'physical_order', orderId: 'ord-1', status: 'completed' },
  });

  assert.equal(result.status, 'completed');
  assert.equal(updates.length, 0);
  assert.equal(inserts.length, 0);
});

test('updateAdminOrderStatus should reject missing physical orders', async () => {
  const { client } = createAdminClient({
    selectResponses: {
      orders: [{ data: null, error: null }],
    },
  });

  await assert.rejects(
    () =>
      updateAdminOrderStatus({
        client,
        actor: { id: 'admin-1' },
        payload: { targetType: 'physical_order', orderId: 'ord-404', status: 'completed' },
      }),
    (error) => error instanceof AdminOrderStatusError
      && error.statusCode === 404
      && error.message.startsWith('[ORM-302]')
  );
});
