// ===== TechZone Admin Data Engine - Core =====
// Shared state, Supabase bootstrap, utilities, auth/session helpers, and catalog constants.

const SUPABASE_URL = window.__TZ_SUPABASE_URL || '';
const SUPABASE_PUBLISHABLE_KEY = window.__TZ_SUPABASE_PUBLISHABLE_KEY || '';
const SUPABASE_ANON_KEY = SUPABASE_PUBLISHABLE_KEY || window.__TZ_SUPABASE_ANON_KEY || '';
const SESSION_STORAGE_KEY = 'tz_session';
const CART_STORAGE_KEY = 'tz_cart';
const ADMIN_ACCESS_ERROR = 'Legacy admin access requires a verified admin session.';

export const isLegacyAdminPage = /(^|\/)admin(?:\.html)?$/i.test(window.location.pathname || '');
export const legacyAdminWriteEnabled =
    window.__TZ_LEGACY_ADMIN_WRITE_ENABLED === true && isLegacyAdminPage;
let adminRuntimeAccessGranted = false;

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

export const supabase = engineStatus.ready
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

export const realtimeState = {
    activeScopedChannel: null
};

export const ROLES = {
    super_admin: { level: 10, label: 'مدير عام' },
    admin: { level: 8, label: 'مدير النظام' },
    technician: { level: 5, label: 'فني صيانة' },
    employee: { level: 3, label: 'موظف مبيعات' },
    customer: { level: 1, label: 'عميل' },
    user: { level: 1, label: 'مستخدم' }
};

export const ADMIN_SECTIONS = [
    { id: 'dashboard', minLevel: 3, icon: 'fa-chart-pie', label: 'لوحة المعلومات' },
    { id: 'orders', minLevel: 3, icon: 'fa-shopping-bag', label: 'الطلبات' },
    { id: 'product-orders', minLevel: 3, icon: 'fa-box', label: 'طلبات المنتجات' },
    { id: 'accessory-orders', minLevel: 3, icon: 'fa-headphones', label: 'طلبات الإكسسوارات' },
    { id: 'products', minLevel: 8, icon: 'fa-box-open', label: 'المنتجات' },
    { id: 'accessories', minLevel: 8, icon: 'fa-headphones', label: 'الإكسسوارات' },
    { id: 'categories', minLevel: 8, icon: 'fa-tags', label: 'الفئات' },
    { id: 'services', minLevel: 8, icon: 'fa-bolt', label: 'الخدمات' },
    { id: 'deposits', minLevel: 8, icon: 'fa-money-check-alt', label: 'طلبات الإيداع' },
    { id: 'customers', minLevel: 3, icon: 'fa-users', label: 'العملاء' },
    { id: 'coupons', minLevel: 8, icon: 'fa-ticket-alt', label: 'الكوبونات' },
    { id: 'notifications', minLevel: 8, icon: 'fa-bell', label: 'إشعارات المستخدمين' },
    { id: 'chats', minLevel: 3, icon: 'fa-comments', label: 'الدردشات المباشرة' },
    { id: 'messages', minLevel: 3, icon: 'fa-envelope', label: 'رسائل التواصل' },
    { id: 'settings', minLevel: 10, icon: 'fa-cog', label: 'الإعدادات' },
    { id: 'logs', minLevel: 10, icon: 'fa-history', label: 'سجل العمليات' },
    { id: 'serva-catalog', minLevel: 8, icon: 'fa-cloud-download-alt', label: 'كتالوج Serva-S' }
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

export const ACCESSORY_SECTION_NAME = 'منتجات اكسسوارات';
export const ACCESSORY_PUBLIC_LABEL = 'إكسسوارات';
export const ACCESSORY_MAIN_CATEGORY_ID = 'cat-accessories-direct-root';
export const ACCESSORY_SUBCATEGORY_ID = 'cat-accessories-direct-items';
export const ACCESSORY_MAIN_CATEGORY_SLUG = 'accessories-direct-root';
export const ACCESSORY_SUBCATEGORY_SLUG = 'accessories-direct-items';
const ACCESSORY_LEGACY_CATEGORY_SLUG = 'accessories';

export const ACCESSORY_MAIN_CATEGORY = {
    id: ACCESSORY_MAIN_CATEGORY_ID,
    name: ACCESSORY_SECTION_NAME,
    parentId: null,
    status: 'active',
    sortOrder: 9991,
    icon: 'fa-headphones',
    image: '',
    description: 'فئة داخلية مخصصة لمنتجات الإكسسوارات المباشرة.',
    slug: ACCESSORY_MAIN_CATEGORY_SLUG,
    showInNavbar: false
};

export const ACCESSORY_SUBCATEGORY = {
    id: ACCESSORY_SUBCATEGORY_ID,
    name: 'قسم مباشر',
    parentId: ACCESSORY_MAIN_CATEGORY_ID,
    status: 'active',
    sortOrder: 9992,
    icon: 'fa-box-open',
    image: '',
    description: 'فئة فرعية داخلية تحفظ منتجات الإكسسوارات التي تظهر مباشرة في صفحة المنتجات.',
    slug: ACCESSORY_SUBCATEGORY_SLUG,
    showInNavbar: false
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
    services: [],
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
    services: Object.freeze([]),
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

export function normalizeAccessoryCategorySlug(value) {
    return String(value || '').trim().toLowerCase();
}

function getAccessoryCategoryById(categoryId) {
    const normalizedId = String(categoryId || '').trim();
    if (!normalizedId) return null;
    return db.categories.find((category) => category.id === normalizedId) || null;
}

export function isAccessoryCategorySlug(slug) {
    const normalizedSlug = normalizeAccessoryCategorySlug(slug);
    return normalizedSlug === ACCESSORY_LEGACY_CATEGORY_SLUG
        || normalizedSlug === ACCESSORY_MAIN_CATEGORY_SLUG
        || normalizedSlug === ACCESSORY_SUBCATEGORY_SLUG;
}

export function isAccessoryCatalogCategoryId(categoryId) {
    return isAccessoryCategorySlug(getAccessoryCategoryById(categoryId)?.slug);
}

export function isAccessoryProductCategoryId(categoryId) {
    return isAccessoryCatalogCategoryId(categoryId);
}

export function isAccessoryProduct(product) {
    return Boolean(product) && (
        product.productType === 'accessory'
        || !product.categoryId
        || isAccessoryCategorySlug(product.categorySlug)
        || isAccessoryProductCategoryId(product.categoryId)
    );
}

export function detectDataScope() {
    const overrideScope = typeof window.__TZ_DATA_SCOPE === 'string'
        ? window.__TZ_DATA_SCOPE.toLowerCase().trim()
        : '';
    if (overrideScope) return overrideScope;

    const path = (window.location.pathname || '').toLowerCase();
    if (document.getElementById('adminLayout') || path.endsWith('/admin') || path.endsWith('/admin.html')) {
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
            'profiles', 'legacyUsers', 'categories', 'products', 'digitalServices',
            'orders', 'orderItems', 'settings', 'coupons', 'repairServices',
            'repairBookings', 'messages', 'logs', 'deposits', 'serviceOrders'
        ],
        realtime: [
            'products', 'categories', 'services', 'service_orders', 'orders',
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
