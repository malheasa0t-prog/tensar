import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const SCRIPT_SOURCE = fs.readFileSync(new URL('./orders.js', import.meta.url), 'utf8');

/**
 * Normalizes cross-context values for strict assertions.
 *
 * @param {unknown} value
 * @returns {unknown}
 */
function normalizeValue(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * Creates a stable HTML-escaping stub for the legacy admin script.
 *
 * @param {unknown} value
 * @returns {string}
 */
function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * Loads the admin orders script and exposes its test hooks.
 *
 * @returns {{
 *   buildPhysicalStatusActionsMarkup: Function,
 *   getOrderDisplayStatus: Function,
 *   getStatusLabel: Function,
 *   getStatusOptionsForTab: Function,
 *   normalizePhysicalOrderStatus: Function,
 * }}
 */
function loadOrderHooks() {
  const window = {
    __ENABLE_ORDER_ADMIN_TEST_HOOKS__: true,
    AdminApp: {
      sections: {},
    },
  };
  const context = vm.createContext({
    window,
    document: {
      getElementById() {
        return null;
      },
      querySelectorAll() {
        return [];
      },
    },
    TZ: {
      db: {},
      escapeHtml,
    },
  });

  vm.runInContext(SCRIPT_SOURCE, context, { filename: 'public/js/admin/orders.js' });
  return window.__orderAdminTestHooks;
}

test('normalizePhysicalOrderStatus should map legacy statuses into the simplified order workflow', () => {
  const hooks = loadOrderHooks();

  assert.equal(hooks.normalizePhysicalOrderStatus('awaiting_delivery'), 'processing');
  assert.equal(hooks.normalizePhysicalOrderStatus('completed'), 'delivered');
  assert.equal(hooks.normalizePhysicalOrderStatus('refunded'), 'cancelled');
  assert.equal(hooks.normalizePhysicalOrderStatus('pending'), 'pending');
});

test('getStatusOptionsForTab should expose only four statuses for physical orders', () => {
  const hooks = loadOrderHooks();

  assert.deepEqual(
    normalizeValue(hooks.getStatusOptionsForTab('physical')),
    ['pending', 'processing', 'delivered', 'cancelled']
  );
  assert.deepEqual(
    normalizeValue(hooks.getStatusOptionsForTab('repair')),
    ['pending', 'in_progress', 'ready', 'completed', 'cancelled']
  );
});

test('getOrderDisplayStatus should keep repair statuses untouched and simplify product statuses', () => {
  const hooks = loadOrderHooks();

  assert.equal(hooks.getOrderDisplayStatus({ status: 'shipped' }, 'physical'), 'processing');
  assert.equal(hooks.getOrderDisplayStatus({ status: 'ready' }, 'repair'), 'ready');
});

test('buildPhysicalStatusActionsMarkup should render four inline status buttons', () => {
  const hooks = loadOrderHooks();
  const html = hooks.buildPhysicalStatusActionsMarkup({
    orderId: 'ord-1',
    currentStatus: 'completed',
    isPending: false,
  });

  assert.equal((html.match(/data-status="/g) || []).length, 4);
  assert.match(html, /order-status-action--delivered is-active/);
  assert.match(html, /data-order-id="ord-1"/);
  assert.match(html, />\u0641\u064a \u0627\u0644\u0627\u0646\u062a\u0638\u0627\u0631</);
});

test('buildPhysicalStatusActionsMarkup should disable buttons while a status update is pending', () => {
  const hooks = loadOrderHooks();
  const html = hooks.buildPhysicalStatusActionsMarkup({
    orderId: 'ord-2',
    currentStatus: 'processing',
    isPending: true,
  });

  assert.equal((html.match(/ disabled/g) || []).length, 4);
});
