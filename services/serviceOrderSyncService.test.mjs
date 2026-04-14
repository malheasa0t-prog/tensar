import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildServiceOrderSyncRpcParams,
  persistServiceOrderSyncState,
} from './serviceOrderSyncService.js';

test('buildServiceOrderSyncRpcParams should normalize the RPC payload', () => {
  const result = buildServiceOrderSyncRpcParams({
    order: { id: ' so-1 ', status: 'processing' },
    newStatus: 'partial',
    providerResult: {
      startCount: '25',
      remains: '3',
    },
  });

  assert.deepEqual(result, {
    p_order_id: 'so-1',
    p_expected_status: 'processing',
    p_new_status: 'partial',
    p_start_count: 25,
    p_remains: 3,
  });
});

test('buildServiceOrderSyncRpcParams should discard invalid counters', () => {
  const result = buildServiceOrderSyncRpcParams({
    order: { id: 'so-2', status: 'pending' },
    newStatus: 'completed',
    providerResult: {
      startCount: 'not-a-number',
      remains: -2,
    },
  });

  assert.equal(result.p_start_count, null);
  assert.equal(result.p_remains, null);
});

test('persistServiceOrderSyncState should call the transactional RPC and return its payload', async () => {
  const calls = [];
  const client = {
    async rpc(name, args) {
      calls.push({ name, args });
      return {
        data: [{ applied: true, final_status: 'refunded', refund_amount: 12.5 }],
        error: null,
      };
    },
  };

  const result = await persistServiceOrderSyncState({
    order: { id: 'so-3', status: 'processing' },
    newStatus: 'failed',
    providerResult: { remains: 0 },
    client,
  });

  assert.deepEqual(calls, [
    {
      name: 'sync_service_order_status_tx',
      args: {
        p_order_id: 'so-3',
        p_expected_status: 'processing',
        p_new_status: 'failed',
        p_start_count: null,
        p_remains: 0,
      },
    },
  ]);
  assert.deepEqual(result, {
    applied: true,
    finalStatus: 'refunded',
    refundAmount: 12.5,
  });
});

test('persistServiceOrderSyncState should throw a stable error when the RPC fails', async () => {
  const client = {
    async rpc() {
      return { data: null, error: { message: 'db failed' } };
    },
  };

  await assert.rejects(
    () =>
      persistServiceOrderSyncState({
        order: { id: 'so-4', status: 'processing' },
        newStatus: 'completed',
        providerResult: {},
        client,
      }),
    /تعذر حفظ نتيجة مزامنة الطلب\./
  );
});
