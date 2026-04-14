// ===== TechZone Admin Data Engine - Offline Queue =====
// IndexedDB-backed queue for legacy admin writes with online resync hooks.

const OFFLINE_DB_NAME = 'tz-admin-offline';
const OFFLINE_DB_VERSION = 1;
const OFFLINE_STORE_NAME = 'pending-commits';
const OFFLINE_QUEUE_EVENT = 'tz-offline-queue-updated';
const BACKGROUND_SYNC_TAG = 'tz-admin-sync';

let openDbPromise = null;
let memoryQueue = [];

function supportsIndexedDb() {
    return 'indexedDB' in window;
}

function openOfflineDb() {
    if (!supportsIndexedDb()) {
        return Promise.resolve(null);
    }
    if (openDbPromise) return openDbPromise;

    openDbPromise = new Promise((resolve, reject) => {
        const request = window.indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);

        request.onerror = () => reject(request.error || new Error('تعذر فتح قاعدة بيانات الأوفلاين.'));
        request.onupgradeneeded = () => {
            const database = request.result;
            if (!database.objectStoreNames.contains(OFFLINE_STORE_NAME)) {
                database.createObjectStore(OFFLINE_STORE_NAME, { keyPath: 'id' });
            }
        };
        request.onsuccess = () => resolve(request.result);
    });

    return openDbPromise;
}

function createTransaction(storeName, mode) {
    return openOfflineDb().then((database) => database?.transaction(storeName, mode).objectStore(storeName) || null);
}

function runStoreRequest(method, value) {
    if (!supportsIndexedDb()) {
        if (method === 'put') {
            memoryQueue = memoryQueue.filter((entry) => entry.id !== value.id).concat(value);
            return Promise.resolve(value.id);
        }
        return Promise.resolve(undefined);
    }

    return createTransaction(OFFLINE_STORE_NAME, 'readwrite').then((store) => new Promise((resolve, reject) => {
        const request = store[method](value);
        request.onerror = () => reject(request.error || new Error('تعذر حفظ العملية المؤجلة.'));
        request.onsuccess = () => resolve(request.result);
    }));
}

function readAllQueuedCommits() {
    if (!supportsIndexedDb()) {
        return Promise.resolve(memoryQueue.slice());
    }

    return createTransaction(OFFLINE_STORE_NAME, 'readonly').then((store) => new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onerror = () => reject(request.error || new Error('تعذر قراءة طابور العمليات المؤجلة.'));
        request.onsuccess = () => resolve(request.result || []);
    }));
}

function deleteQueuedCommit(id) {
    if (!supportsIndexedDb()) {
        memoryQueue = memoryQueue.filter((entry) => entry.id !== id);
        return Promise.resolve();
    }

    return createTransaction(OFFLINE_STORE_NAME, 'readwrite').then((store) => new Promise((resolve, reject) => {
        const request = store.delete(id);
        request.onerror = () => reject(request.error || new Error('تعذر حذف العملية المؤجلة.'));
        request.onsuccess = () => resolve();
    }));
}

async function emitQueueUpdateEvent() {
    const pendingCommits = await getQueuedCommits();
    window.dispatchEvent(new CustomEvent(OFFLINE_QUEUE_EVENT, {
        detail: { count: pendingCommits.length, items: pendingCommits }
    }));
    return pendingCommits;
}

function buildQueuedCommit(action, actorId, details, resource) {
    return {
        id: `offline-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        action,
        actorId: actorId || null,
        details: details || '',
        resource: resource || null,
        queuedAt: new Date().toISOString()
    };
}

function isRetryableNetworkError(error) {
    const errorMessage = String(error?.message || error?.cause?.message || '').toLowerCase();
    return errorMessage.includes('network')
        || errorMessage.includes('failed to fetch')
        || errorMessage.includes('fetch')
        || errorMessage.includes('timeout')
        || errorMessage.includes('offline');
}

async function queueOfflineCommit(action, actorId, details, resource) {
    const queuedCommit = buildQueuedCommit(action, actorId, details, resource);
    await runStoreRequest('put', queuedCommit);
    await emitQueueUpdateEvent();
    return queuedCommit;
}

async function getQueuedCommits() {
    const queuedCommits = await readAllQueuedCommits();
    return queuedCommits.sort((first, second) => new Date(first.queuedAt) - new Date(second.queuedAt));
}

async function syncQueuedCommits(processQueuedCommit) {
    const queuedCommits = await getQueuedCommits();
    let syncedCount = 0;

    for (const queuedCommit of queuedCommits) {
        try {
            await processQueuedCommit(queuedCommit);
            await deleteQueuedCommit(queuedCommit.id);
            syncedCount += 1;
        } catch (error) {
            if (isRetryableNetworkError(error)) break;
            console.error('Failed to sync queued admin commit.', error);
        }
    }

    await emitQueueUpdateEvent();
    return syncedCount;
}

async function registerBackgroundSync() {
    if (!('serviceWorker' in navigator)) return;
    try {
        const registration = await navigator.serviceWorker.ready;
        if (!registration.sync) return;
        await registration.sync.register(BACKGROUND_SYNC_TAG);
    } catch (error) {
        void error;
    }
}

function registerOfflineSyncListeners(processQueuedCommit) {
    const triggerSync = async () => {
        if (!navigator.onLine) return;
        const syncedCount = await syncQueuedCommits(processQueuedCommit);
        if (syncedCount > 0) {
            window.dispatchEvent(new CustomEvent('tz-offline-sync-complete', {
                detail: { syncedCount }
            }));
        }
    };

    window.addEventListener('online', () => {
        void triggerSync();
    });

    window.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            void triggerSync();
        }
    });

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data?.type === 'tz-admin-sync-request') {
                void triggerSync();
            }
        });
    }

    void emitQueueUpdateEvent();
    void registerBackgroundSync();
    return triggerSync;
}

export {
    BACKGROUND_SYNC_TAG,
    OFFLINE_QUEUE_EVENT,
    getQueuedCommits,
    isRetryableNetworkError,
    queueOfflineCommit,
    registerBackgroundSync,
    registerOfflineSyncListeners,
    syncQueuedCommits
};
