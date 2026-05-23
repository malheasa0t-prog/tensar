// ===== TechZone Admin Data Engine - Loaders =====
// Scoped Supabase loading and DB hydration.

import {
    db,
    dispatchReadyEvent,
    estimateActiveSessions,
    getDataScopeConfig,
    nowIso,
    supabase,
    updateHealthStatus
} from './core.js?v=20260523-2';
import {
    buildItemsByOrder,
    mapAuditLog,
    mapContactMessage,
    mapCoupon,
    mapDeposit,
    mapOrder,
    mapRepairBooking,
    mapServiceOrder
} from './orders.js?v=20260523-2';
import { mapCategory, mapProduct, mapRepairService } from './products.js?v=20260523-2';
import { mergeUsers } from './users.js?v=20260523-2';

const LEGACY_USER_SAFE_FIELDS = 'id,auth_user_id,full_name,email,phone,role,status,created_at,updated_at';
const PROFILE_SAFE_FIELDS = [
    'id',
    'user_id',
    'full_name',
    'email',
    'phone',
    'country',
    'bio',
    'avatar_url',
    'preferred_language',
    'preferred_currency',
    'last_login_at',
    'role',
    'status',
    'created_at',
    'updated_at'
].join(',');

const QUERY_BUILDERS = {
    profiles: () => supabase.from('user_profiles').select(PROFILE_SAFE_FIELDS).order('created_at', { ascending: false }),
    legacyUsers: () => supabase.from('app_users').select(LEGACY_USER_SAFE_FIELDS),
    categories: () => supabase.from('categories').select('*').order('sort_order', { ascending: true }),
    products: () => supabase.from('products').select('*'),
    orders: () => supabase.from('orders').select('*').order('created_at', { ascending: false }),
    orderItems: () => supabase.from('order_items').select('*'),
    settings: () => supabase.from('settings').select('*').limit(1),
    coupons: () => supabase.from('coupons').select('*'),
    repairServices: () => supabase.from('repair_services').select('*').order('created_at', { ascending: true }),
    serviceOrders: () => supabase.from('service_orders').select('*').order('created_at', { ascending: false }),
    repairBookings: () => supabase.from('repair_bookings').select('*').order('created_at', { ascending: false }),
    messages: () => supabase.from('contact_messages').select('*').order('created_at', { ascending: false }),
    logs: () => supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200),
    deposits: () => supabase.from('deposits').select('*').order('created_at', { ascending: false })
};

function buildScopedQueries(queryKeys) {
    return queryKeys.reduce((queries, key) => {
        const queryBuilder = QUERY_BUILDERS[key];
        if (queryBuilder) queries[key] = queryBuilder();
        return queries;
    }, {});
}

async function resolveScopedQueries(queries) {
    const entries = await Promise.all(
        Object.entries(queries).map(async ([key, query]) => [key, await query])
    );
    return Object.fromEntries(entries);
}

function hydrateUsers(results) {
    if (!results.profiles && !results.legacyUsers) return;
    db.users = mergeUsers(results.profiles?.data || [], results.legacyUsers?.data || []);
}

function hydrateCatalog(results) {
    if (results.categories?.data) db.categories = results.categories.data.map(mapCategory);
    if (results.products?.data) db.products = results.products.data.map(mapProduct);
    if (results.repairServices?.data) db.repairServices = results.repairServices.data.map(mapRepairService);
}

function hydrateOrders(results) {
    if (results.orders?.data) {
        const itemsByOrder = buildItemsByOrder(results.orderItems?.data || []);
        db.orders = results.orders.data.map((order) => mapOrder(order, itemsByOrder[order.id] || []));
    }
    if (results.serviceOrders?.data) db.serviceOrders = results.serviceOrders.data.map(mapServiceOrder);
    if (results.repairBookings?.data) db.repairBookings = results.repairBookings.data.map(mapRepairBooking);
    if (results.deposits?.data) db.deposits = results.deposits.data.map(mapDeposit);
}

function hydrateContent(results) {
    if (results.settings?.data?.length) {
        db.settings = { ...db.settings, ...results.settings.data[0].data };
    }
    if (results.coupons?.data) db.coupons = results.coupons.data.map(mapCoupon);
    if (results.messages?.data) db.contactMessages = results.messages.data.map(mapContactMessage);
    if (results.logs?.data) db.logs = results.logs.data.map(mapAuditLog);
}

function hydrateDb(results) {
    hydrateUsers(results);
    hydrateCatalog(results);
    hydrateOrders(results);
    hydrateContent(results);
    updateHealthStatus({
        supabase: 'connected',
        lastRefreshAt: nowIso(),
        activeSessions: estimateActiveSessions(db.users)
    });
}

export async function loadDataFromSupabaseByScope() {
    if (!supabase) {
        dispatchReadyEvent();
        return;
    }

    try {
        const queries = buildScopedQueries(getDataScopeConfig().queries);
        const results = await resolveScopedQueries(queries);
        hydrateDb(results);
    } catch (error) {
        console.error('[DEN-301] Scoped Supabase fetch failed:', error);
        updateHealthStatus({ supabase: 'error' });
    }

    dispatchReadyEvent();
}

export async function loadDataFromSupabase() {
    await loadDataFromSupabaseByScope();
}
