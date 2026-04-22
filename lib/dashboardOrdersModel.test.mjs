import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REPAIR_STATUS_MAP,
  buildDashboardOrdersStats,
  getDashboardRepairModeLabel,
} from './dashboardOrdersModel.js';

test('getDashboardRepairModeLabel should expose remote maintenance in Arabic', () => {
  assert.equal(getDashboardRepairModeLabel('remote'), 'صيانة عن بعد');
});

test('REPAIR_STATUS_MAP should include completed remote maintenance state', () => {
  assert.equal(REPAIR_STATUS_MAP.completed_remote.label, 'تمت الصيانة عن بعد');
});

test('buildDashboardOrdersStats should count product and repair groups', () => {
  assert.deepEqual(
    buildDashboardOrdersStats({
      productOrders: [{ id: '1' }],
      repairBookings: [{ id: '4' }],
    }),
    {
      total: 2,
      products: 1,
      repairs: 1,
    }
  );
});
