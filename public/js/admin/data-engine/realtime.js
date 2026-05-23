// ===== TechZone Admin Data Engine - Realtime =====
// Scoped realtime subscriptions with shared DB mutation helpers.

import {
    assertAdminRuntimeAccess,
    DATA_SCOPE,
    db,
    getDataScopeConfig,
    nowIso,
    realtimeState,
    supabase,
    updateHealthStatus
} from './core.js?v=20260523-2';
import {
    mapAuditLog,
    mapContactMessage,
    mapCoupon,
    mapDeposit,
    mapOrder,
    mapRepairBooking,
    mapServiceOrder
} from './orders.js?v=20260523-2';
import { mapCategory, mapProduct, mapRepairService } from './products.js?v=20260523-2';

const CATEGORY_SORTER = (first, second) => (first.sortOrder || 0) - (second.sortOrder || 0);

const REALTIME_BINDINGS = {
    products: { collectionKey: 'products', eventName: 'products', mapper: (row) => mapProduct(row) },
    categories: {
        collectionKey: 'categories',
        eventName: 'categories',
        mapper: (row) => mapCategory(row),
        sortRecords: CATEGORY_SORTER
    },
    orders: {
        collectionKey: 'orders',
        eventName: 'orders',
        mapper: (row, existingRecord) => mapOrder(row, existingRecord?.items || []),
        prepend: true
    },
    service_orders: {
        collectionKey: 'serviceOrders',
        eventName: 'service_orders',
        mapper: (row) => mapServiceOrder(row),
        prepend: true
    },
    repair_services: {
        collectionKey: 'repairServices',
        eventName: 'repair_services',
        mapper: (row) => mapRepairService(row)
    },
    repair_bookings: {
        collectionKey: 'repairBookings',
        eventName: 'repair_bookings',
        mapper: (row) => mapRepairBooking(row),
        prepend: true
    },
    contact_messages: {
        collectionKey: 'contactMessages',
        eventName: 'contact_messages',
        mapper: (row) => mapContactMessage(row),
        prepend: true
    },
    deposits: {
        collectionKey: 'deposits',
        eventName: 'deposits',
        mapper: (row) => mapDeposit(row),
        prepend: true
    },
    coupons: { collectionKey: 'coupons', eventName: 'coupons', mapper: (row) => mapCoupon(row) },
    settings: { eventName: 'settings', isSettings: true },
    audit_logs: { collectionKey: 'logs', eventName: 'logs', mapper: (row) => mapAuditLog(row), prepend: true }
};

function removeRecord(collectionKey, recordId) {
    db[collectionKey] = db[collectionKey].filter((record) => record.id !== recordId);
}

function upsertRecord(collectionKey, mappedRecord, options = {}) {
    const prependRecord = options.prepend === true;
    const currentRecords = db[collectionKey];
    const existingIndex = currentRecords.findIndex((record) => record.id === mappedRecord.id);

    if (existingIndex >= 0) {
        currentRecords[existingIndex] = mappedRecord;
    } else if (prependRecord) {
        currentRecords.unshift(mappedRecord);
    } else {
        currentRecords.push(mappedRecord);
    }

    if (typeof options.sortRecords === 'function') {
        currentRecords.sort(options.sortRecords);
    }
}

function applySettingsUpdate(payload) {
    if (payload.new?.data) {
        db.settings = { ...db.settings, ...payload.new.data };
    }
}

function applyRealtimeMutation(binding, payload) {
    updateHealthStatus({ realtime: 'connected', lastRealtimeEventAt: nowIso() });
    if (binding.isSettings) {
        applySettingsUpdate(payload);
        fireDataUpdate(binding.eventName);
        return;
    }

    if (payload.eventType === 'DELETE') {
        removeRecord(binding.collectionKey, payload.old.id);
        fireDataUpdate(binding.eventName);
        return;
    }

    const currentRecords = db[binding.collectionKey] || [];
    const existingRecord = currentRecords.find((record) => record.id === payload.new.id) || null;
    const mappedRecord = binding.mapper(payload.new, existingRecord);
    upsertRecord(binding.collectionKey, mappedRecord, binding);
    fireDataUpdate(binding.eventName);
}

function subscribeTable(channel, tableName) {
    const binding = REALTIME_BINDINGS[tableName];
    if (!binding) return;

    channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: tableName },
        (payload) => applyRealtimeMutation(binding, payload)
    );
}

export function fireDataUpdate(table) {
    window.dispatchEvent(new CustomEvent('tz-data-updated', { detail: { table } }));
}

export function setupScopedRealtime() {
    assertAdminRuntimeAccess();
    if (!supabase || realtimeState.activeScopedChannel) return;

    const realtimeTables = getDataScopeConfig().realtime;
    if (!Array.isArray(realtimeTables) || realtimeTables.length === 0) return;

    const channel = supabase.channel(`tz-realtime-${DATA_SCOPE}`);
    realtimeState.activeScopedChannel = channel;
    realtimeTables.forEach((tableName) => subscribeTable(channel, tableName));
    channel.subscribe((status) => {
        const realtimeStatus = status === 'SUBSCRIBED'
            ? 'connected'
            : (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED')
                ? 'error'
                : 'connecting';
        updateHealthStatus({ realtime: realtimeStatus });
    });
}

export const setupRealtime = setupScopedRealtime;
