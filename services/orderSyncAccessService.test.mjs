import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MISSING_SYNC_SECRET_ERROR,
  UNAUTHORIZED_SYNC_TRIGGER_ERROR,
  resolveOrderSyncAccess,
} from './orderSyncAccessService.js';

test('resolveOrderSyncAccess should reject sync when CRON_SECRET is missing', () => {
  const result = resolveOrderSyncAccess({
    expectedSecret: '',
    providedSecret: 'secret',
  });

  assert.deepEqual(result, {
    isAuthorized: false,
    status: 503,
    error: MISSING_SYNC_SECRET_ERROR,
  });
});

test('resolveOrderSyncAccess should reject requests with an invalid secret', () => {
  const result = resolveOrderSyncAccess({
    expectedSecret: 'secret',
    providedSecret: 'wrong',
  });

  assert.deepEqual(result, {
    isAuthorized: false,
    status: 401,
    error: UNAUTHORIZED_SYNC_TRIGGER_ERROR,
  });
});

test('resolveOrderSyncAccess should authorize requests with the matching secret', () => {
  const result = resolveOrderSyncAccess({
    expectedSecret: ' secret ',
    providedSecret: 'secret',
  });

  assert.deepEqual(result, {
    isAuthorized: true,
    status: 200,
    error: '',
  });
});
