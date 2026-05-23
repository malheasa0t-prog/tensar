// ===== TechZone Admin Data Engine - Core =====
// Shared state, Supabase bootstrap, utilities, auth/session helpers, and catalog constants.

import {
    installSanitizedInnerHtmlGuard,
    sanitizeAdminHtmlMarkup
} from './htmlSanitizer.js';
import { createAdminSupabaseClient } from './adminWriteProxy.js?v=20260523-2';

const SUPABASE_URL = window.__TZ_SUPABASE_URL || '';
const SUPABASE_PUBLISHABLE_KEY = window.__TZ_SUPABASE_PUBLISHABLE_KEY || '';
const SUPABASE_ANON_KEY = SUPABASE_PUBLISHABLE_KEY || window.__TZ_SUPABASE_ANON_KEY || '';
const SESSION_STORAGE_KEY = 'tz_session';
const CART_STORAGE_KEY = 'tz_cart';
const ADMIN_ACCESS_ERROR = '[DEN-201] يلزم وجود جلسة إدارة موثقة للوصول إلى البيانات.';

export const isLegacyAdminPage = /(^|\/)(?:admin(?:\.html)?|__tz-panel\.html)$/i.test(window.location.pathname || '');
export const legacyAdminWriteEnabled = false;
let adminRuntimeAccessGranted = false;

if (isLegacyAdminPage && typeof window.Element === 'function') {
    installSanitizedInnerHtmlGuard({ elementCtor: window.Element, sanitizeHtml: sanitizeAdminHtmlMarkup });
}

export const engineStatus = {
    ready: Boolean(window.supabase && SUPABASE_URL && SUPABASE_ANON_KEY),
    error: !window.supabase
        ? 'Supabase JS client not loaded.'
        : !SUPABASE_URL || !SUPABASE_ANON_KEY
            ? 'Supabase config is missing. Load the legacy admin runtime config first.'
            : ''
};

export const HEALTH_UPDATE_EVENT = 'tz-health-updated';
export const health = {
    supabase: engineStatus.ready ? 'connected' : 'error',
    realtime: 'idle',
    lastRefreshAt: null,
    lastRealtimeEventAt: null,
    activeSessions: 0
};

const rawSupabaseClient = engineStatus.ready
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

export const supabase = createAdminSupabaseClient({
    adminPage: isLegacyAdminPage,
    baseClient: rawSupabaseClient
});

export const realtimeState = {
    activeScopedChannel: null
};

export const ROLES = {
    super_admin: { level: 10, label: 'مدير عام' },
    admin: { level: 8, label: 'مدير النظام' },
    technician: { level: 5, label: 'فني صيانة' },
    employee: { level: 3, label: 'موظف مبيعات' },
    seller: { level: 2, label: 'بائع' },
    customer: { level: 1, label: 'عميل' },
    user: { level: 1, label: 'مستخدم' }
};

export const ADMIN_SECTIONS = [
    { id: 'dashboard', minLevel: 3, icon: 'fa-chart-pie', label: 'لوحة المعلومات' },
    { id: 'orders', minLevel: 3, icon: 'fa-shopping-bag', label: 'الطلبات' },
    { id: 'product-orders', minLevel: 3, icon: 'fa-box', label: 'طلبات المنتجات' },
    { id: 'service-orders', minLevel: 3, icon: 'fa-bolt', label: 'طلبات الخدمات' },
    { id: 'accessory-orders', minLevel: 3, icon: 'fa-headphones', label: 'طلبات الإكسسوارات' },
    { id: 'repair-orders', minLevel: 3, icon: 'fa-screwdriver-wrench', label: 'حجوزات الصيانة' },
    { id: 'categories', minLevel: 8, icon: 'fa-tags', label: 'الفئات' },
    { id: 'services', minLevel: 8, icon: 'fa-bolt', label: 'الخدمات' },
    { id: 'deposits', minLevel: 8, icon: 'fa-money-check-alt', label: 'طلبات الإيداع' },
    { id: 'customers', minLevel: 3, icon: 'fa-users', label: 'العملاء' },
    { id: 'sellers', minLevel: 8, icon: 'fa-user-tag', label: 'البائعين' },
    { id: 'coupons', minLevel: 8, icon: 'fa-ticket-alt', label: 'الكوبونات' },
    { id: 'refunds', minLevel: 8, icon: 'fa-undo-alt', label: 'طلبات الاسترجاع' },
    { id: 'notifications', minLevel: 8, icon: 'fa-bell', label: 'إشعارات المستخدمين' },
    { id: 'chats', minLevel: 3, icon: 'fa-comments', label: 'الدردشات المباشرة' },
    { id: 'messages', minLevel: 3, icon: 'fa-envelope', label: 'رسائل التواصل' },
    { id: 'platform-updates', minLevel: 10, icon: 'fa-bullhorn', label: 'تحديثات المنصة' },
    { id: 'provider-alerts', minLevel: 10, icon: 'fa-satellite-dish', label: 'تنبيهات المزود' },
    { id: 'serva-catalog', minLevel: 8, icon: 'fa-cube', label: 'كتالوج المزود' },
    { id: 'settings', minLevel: 10, icon: 'fa-cog', label: 'الإعدادات' },
    { id: 'logs', minLevel: 10, icon: 'fa-history', label: 'سجل العمليات' }
];

const DEFAULT_SETTINGS = {
    company: { name: 'TechZone', phone: '', email: '', address: '' },
    payments: { mada: true, card: true, applepay: true, cod: true, bank_transfer: true },
    shipping: { standardFee: 20, expressFee: 35, freeShippingThreshold: 500, freeAbove: 500 },
    deliveryModes: [
        { id: 'delivery', name: 'توصيل للمنزل', fee: 20 },
        { id: 'pickup', name: 'استلام من المحل', fee: 0 }
    ]
};


function readJsonStorage(key, fallbackValue) {
    try {
        const rawValue = window.localStorage.getItem(key);
        return rawValue ? JSON.parse(rawValue) : fallbackValue;
    } catch (error) {
        void error;
        return fallbackValue;
    }
}

export const db = {
    users: [],
    categories: [],
    products: [],
    orders: [],
    serviceOrders: [],
    deposits: [],
    coupons: [],
    settings: clone(DEFAULT_SETTINGS),
    repairServices: [],
    repairBookings: [],
    contactMessages: [],
    logs: [],
    cart: readJsonStorage(CART_STORAGE_KEY, [])
};

const ADMIN_DB_FALLBACK = Object.freeze({
    users: Object.freeze([]),
    categories: Object.freeze([]),
    products: Object.freeze([]),
    orders: Object.freeze([]),
    serviceOrders: Object.freeze([]),
    deposits: Object.freeze([]),
    coupons: Object.freeze([]),
    settings: Object.freeze(clone(DEFAULT_SETTINGS)),
    repairServices: Object.freeze([]),
    repairBookings: Object.freeze([]),
    contactMessages: Object.freeze([]),
    logs: Object.freeze([]),
    cart: Object.freeze([])
});

export function hasAdminRuntimeAccess() {
    return !isLegacyAdminPage || adminRuntimeAccessGranted;
}

export function grantAdminRuntimeAccess() {
    adminRuntimeAccessGranted = true;
}

export function revokeAdminRuntimeAccess() {
    adminRuntimeAccessGranted = false;
}

export function assertAdminRuntimeAccess() {
    if (!hasAdminRuntimeAccess()) {
        throw new Error(ADMIN_ACCESS_ERROR);
    }
}

export const protectedDb = new Proxy(db, {
    get(target, property, receiver) {
        if (hasAdminRuntimeAccess()) {
            return Reflect.get(target, property, receiver);
        }
        return Reflect.get(ADMIN_DB_FALLBACK, property, receiver);
    },
    set(target, property, value, receiver) {
        assertAdminRuntimeAccess();
        return Reflect.set(target, property, value, receiver);
    },
    deleteProperty(target, property) {
        assertAdminRuntimeAccess();
        return Reflect.deleteProperty(target, property);
    }
});

export function saveDbLocal() {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(db.cart));
}

export function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

export function generateId(prefix = '') {
    return `${prefix}${Math.random().toString(36).slice(2, 11)}`;
}

export function nowIso() {
    return new Date().toISOString();
}

export function escapeHtml(value) {
    if (value == null) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export function formatPrice(price) {
    return `${Number(price || 0).toLocaleString('ar-JO')} د.أ`;
}

export function estimateActiveSessions(users = []) {
    const activeWindowMs = 24 * 60 * 60 * 1000;
    const now = Date.now();
    return users.filter((user) => {
        const timestamp = user?.lastLoginAt ? new Date(user.lastLoginAt).getTime() : 0;
        return Number.isFinite(timestamp) && timestamp > 0 && now - timestamp <= activeWindowMs;
    }).length;
}

export function updateHealthStatus(patch = {}) {
    Object.assign(health, patch);
    window.dispatchEvent(new CustomEvent(HEALTH_UPDATE_EVENT, { detail: { ...health } }));
}


export function detectDataScope() {
    const overrideScope = typeof window.__TZ_DATA_SCOPE === 'string'
        ? window.__TZ_DATA_SCOPE.toLowerCase().trim()
        : '';
    if (overrideScope) return overrideScope;

    const path = (window.location.pathname || '').toLowerCase();
    if (document.getElementById('adminLayout') || path.endsWith('/admin') || path.endsWith('/admin.html') || path.endsWith('/__tz-panel.html')) {
        return 'admin';
    }
    if (path.endsWith('/products')) return 'products';
    if (path.endsWith('/services')) return 'services';
    return 'storefront';
}

export const DATA_SCOPE = detectDataScope();

const DATA_SCOPE_CONFIG = {
    admin: {
        queries: [
            'profiles', 'legacyUsers', 'categories', 'products',
            'orders', 'orderItems', 'serviceOrders', 'settings', 'coupons', 'repairServices',
            'repairBookings', 'messages', 'logs', 'deposits'
        ],
        realtime: [
            'products', 'categories', 'orders', 'service_orders',
            'repair_services', 'repair_bookings', 'contact_messages', 'deposits',
            'coupons', 'settings'
        ]
    },
    storefront: {
        queries: ['categories', 'products', 'settings', 'repairServices'],
        realtime: ['products', 'categories', 'repair_services', 'settings']
    },
    products: {
        queries: ['categories', 'products', 'settings'],
        realtime: ['products', 'categories', 'settings']
    },
    services: {
        queries: ['settings', 'repairServices'],
        realtime: ['repair_services', 'settings']
    }
};

export function getDataScopeConfig() {
    return DATA_SCOPE_CONFIG[DATA_SCOPE] || DATA_SCOPE_CONFIG.storefront;
}

export function dispatchReadyEvent() {
    window.dispatchEvent(new Event('tz-ready'));
}

export async function supabaseSignIn(email, password) {
    if (!supabase) return { user: null, error: engineStatus.error };
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? { user: null, error: error.message } : { user: data.user, error: null };
}

export async function supabaseSignOut() {
    if (supabase) await supabase.auth.signOut();
}

export async function getSupabaseUser() {
    if (!supabase) return null;
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}

export function getSession() {
    return readJsonStorage(SESSION_STORAGE_KEY, null);
}

export function setSession(userId, role, name) {
    const session = { userId, role, name, expires: Date.now() + (24 * 60 * 60 * 1000) };
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    return session;
}

export function clearSession() {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
}
