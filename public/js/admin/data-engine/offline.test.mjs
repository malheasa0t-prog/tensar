import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const OFFLINE_MODULE_PATH = pathToFileURL(
    path.resolve('D:/New folder (12)/new wpeeeeeeee/public/js/admin/data-engine/offline.js')
).href;

function createBrowserMocks() {
    const noop = () => {};
    globalThis.window = {
        addEventListener: noop,
        dispatchEvent: noop
    };
    globalThis.document = { hidden: false };
    Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        value: { onLine: false }
    });
    globalThis.CustomEvent = class CustomEvent {
        constructor(type, init = {}) {
            this.type = type;
            this.detail = init.detail;
        }
    };
}

test('queueOfflineCommit should fall back to in-memory storage when IndexedDB is unavailable', async () => {
    createBrowserMocks();
    const moduleUrl = `${OFFLINE_MODULE_PATH}?memory-fallback=${Date.now()}`;
    const offlineModule = await import(moduleUrl);

    await offlineModule.queueOfflineCommit('product_create', 'admin-1', 'created product', {
        type: 'product',
        data: { id: 'p-1' }
    });

    const queuedCommits = await offlineModule.getQueuedCommits();
    assert.equal(queuedCommits.length, 1);
    assert.equal(queuedCommits[0].action, 'product_create');
    assert.equal(queuedCommits[0].resource.type, 'product');
});

test('isRetryableNetworkError should detect transient connectivity failures', async () => {
    createBrowserMocks();
    const moduleUrl = `${OFFLINE_MODULE_PATH}?retryable=${Date.now()}`;
    const offlineModule = await import(moduleUrl);

    assert.equal(offlineModule.isRetryableNetworkError(new Error('Failed to fetch')), true);
    assert.equal(offlineModule.isRetryableNetworkError(new Error('Permanent validation failure')), false);
});
