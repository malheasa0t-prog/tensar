import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildServiceOrderNotifications,
  insertServiceOrderNotifications,
} from './serviceOrderNotificationService.js';

test('buildServiceOrderNotifications should keep the requested cancelled label when the final status becomes refunded', () => {
  const notifications = buildServiceOrderNotifications({
    order: { id: 'so-1', user_id: 'user-1', service_name: 'TikTok Likes' },
    requestedStatus: 'cancelled',
    finalStatus: 'refunded',
    refundAmount: 12.5,
  });

  assert.equal(notifications.length, 2);
  assert.equal(notifications[0].title, 'تم إلغاء طلبك 🚫');
  assert.match(notifications[1].body, /12\.50/);
});

test('insertServiceOrderNotifications should skip empty notification lists', async () => {
  const client = {
    from() {
      throw new Error('should not insert');
    },
  };

  const result = await insertServiceOrderNotifications({ client, notifications: [] });
  assert.equal(result, null);
});

test('insertServiceOrderNotifications should return a stable error message when the insert fails', async () => {
  const client = {
    from(tableName) {
      assert.equal(tableName, 'notifications');
      return {
        async insert() {
          return { error: { message: 'db failed' } };
        },
      };
    },
  };

  const result = await insertServiceOrderNotifications({
    client,
    notifications: [{ user_id: 'user-1', title: 'x' }],
  });

  assert.equal(result, 'تعذر حفظ إشعار تحديث الطلب.');
});
