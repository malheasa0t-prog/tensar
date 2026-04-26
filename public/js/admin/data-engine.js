// ===== TechZone Admin Data Engine =====
// ES module entry point that wires shared state into the legacy window.TZ API.

import {
    ADMIN_SECTIONS,
    DATA_SCOPE,
    ROLES,
    clone,
    db,
    protectedDb,
    dispatchReadyEvent,
    engineStatus,
    escapeHtml,
    formatPrice,
    grantAdminRuntimeAccess,
    generateId,
    getSession,
    getSupabaseUser,
    HEALTH_UPDATE_EVENT,
    hasAdminRuntimeAccess,
    health,
    legacyAdminWriteEnabled,
    nowIso,
    revokeAdminRuntimeAccess,
    saveDbLocal,
    setSession,
    supabase,
    supabaseSignIn,
    supabaseSignOut,
    clearSession
} from './data-engine/core.js?v=20260426-5';
import { loadDataFromSupabaseByScope } from './data-engine/loaders.js?v=20260426-5';
import {
    OFFLINE_QUEUE_EVENT,
    getQueuedCommits,
    registerOfflineSyncListeners
} from './data-engine/offline.js?v=20260426-5';
import { getAdminSessionUser } from './data-engine/adminSession.js?v=20260426-5';
import {
    getActiveRepairServices,
    getBrands,
    getCatalogProducts,
    getCategoryIcon,
    getCategoryName,
    getFeaturedProducts,
    getFilteredProducts,
    getLatestProducts,
    getProductById,
    getVisibleCatalogCategories
} from './data-engine/products.js?v=20260426-5';
import { fireDataUpdate, setupScopedRealtime } from './data-engine/realtime.js?v=20260426-5';
import { commitDb, refreshData, syncOfflineQueue } from './data-engine/sync.js?v=20260426-5';
import {
    canAccessAdmin,
    canAccessSection,
    findUserByAuthUser,
    getUserById,
    isCustomerUser
} from './data-engine/users.js?v=20260426-5';

function notifyCartChange() {
    if (typeof window.TZ.onCartChange === 'function') {
        window.TZ.onCartChange();
    }
}

function addToCart(productId, qty) {
    const quantity = parseInt(qty, 10) || 1;
    const product = getProductById(productId);
    if (!product || product.quantity < quantity) return;
    const existingItem = db.cart.find((item) => item.productId === productId);
    if (existingItem) {
        existingItem.qty += quantity;
    } else {
        db.cart.push({ productId, qty: quantity });
    }
    saveDbLocal();
    notifyCartChange();
}

async function syncOfflineQueueIfAuthorized() {
    if (!hasAdminRuntimeAccess()) {
        return 0;
    }

    return syncOfflineQueue();
}

function removeFromCart(productId) {
    db.cart = db.cart.filter((item) => item.productId !== productId);
    saveDbLocal();
    notifyCartChange();
}

function getCartTotal() {
    return db.cart.reduce((total, item) => {
        const product = getProductById(item.productId);
        return product ? total + (product.discountPrice || product.price) * item.qty : total;
    }, 0);
}

function getCartCount() {
    return db.cart.reduce((total, item) => total + item.qty, 0);
}

function applyAdminTextOverrides() {
    const roleLabels = {
        super_admin: '\u0645\u062F\u064A\u0631 \u0639\u0627\u0645',
        admin: '\u0645\u062F\u064A\u0631 \u0627\u0644\u0646\u0638\u0627\u0645',
        technician: '\u0641\u0646\u064A \u0635\u064A\u0627\u0646\u0629',
        employee: '\u0645\u0648\u0638\u0641 \u0645\u0628\u064A\u0639\u0627\u062A',
        customer: '\u0639\u0645\u064A\u0644',
        user: '\u0645\u0633\u062A\u062E\u062F\u0645'
    };
    const sectionLabels = {
        dashboard: '\u0644\u0648\u062D\u0629 \u0627\u0644\u0645\u0639\u0644\u0648\u0645\u0627\u062A',
        orders: '\u0627\u0644\u0637\u0644\u0628\u0627\u062A',
        'product-orders': '\u0637\u0644\u0628\u0627\u062A \u0627\u0644\u0645\u0646\u062A\u062C\u0627\u062A',
        products: '\u0627\u0644\u0645\u0646\u062A\u062C\u0627\u062A',
        categories: '\u0627\u0644\u0641\u0626\u0627\u062A',
        services: '\u0627\u0644\u062E\u062F\u0645\u0627\u062A',
        deposits: '\u0637\u0644\u0628\u0627\u062A \u0627\u0644\u0625\u064A\u062F\u0627\u0639',
        customers: '\u0627\u0644\u0639\u0645\u0644\u0627\u0621',
        coupons: '\u0627\u0644\u0643\u0648\u0628\u0648\u0646\u0627\u062A',
        notifications: '\u0625\u0634\u0639\u0627\u0631\u0627\u062A \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645\u064A\u0646',
        chats: '\u0627\u0644\u062F\u0631\u062F\u0634\u0627\u062A \u0627\u0644\u0645\u0628\u0627\u0634\u0631\u0629',
        messages: '\u0631\u0633\u0627\u0626\u0644 \u0627\u0644\u062A\u0648\u0627\u0635\u0644',
        settings: '\u0627\u0644\u0625\u0639\u062F\u0627\u062F\u0627\u062A',
        logs: '\u0633\u062C\u0644 \u0627\u0644\u0639\u0645\u0644\u064A\u0627\u062A'
    };

    Object.entries(roleLabels).forEach(([role, label]) => {
        if (window.TZ.ROLES?.[role]) {
            window.TZ.ROLES[role].label = label;
        }
    });

    if (Array.isArray(window.TZ.ADMIN_SECTIONS)) {
        window.TZ.ADMIN_SECTIONS.forEach((section) => {
            if (sectionLabels[section.id]) {
                section.label = sectionLabels[section.id];
            }
        });
    }
}

window.TZ = {
    db: protectedDb,
    supabase,
    saveDb: saveDbLocal,
    commitDb,
    refreshData,
    startRealtime: setupScopedRealtime,
    health,
    healthEventName: HEALTH_UPDATE_EVENT,
    generateId,
    nowIso,
    clone,
    escapeHtml,
    formatPrice,
    supabaseSignIn,
    supabaseSignOut,
    getSupabaseUser,
    getAdminSessionUser,
    getSession,
    setSession,
    clearSession,
    getCategoryName,
    getCategoryIcon,
    getProductById,
    getUserById,
    findUserByAuthUser,
    isCustomerUser,
    getFilteredProducts,
    getFeaturedProducts,
    getLatestProducts,
    getBrands,
    getVisibleCatalogCategories,
    getCatalogProducts,
    getActiveRepairServices,
    ROLES,
    ADMIN_SECTIONS,
    canAccessAdmin,
    canAccessSection,
    addToCart,
    removeFromCart,
    getCartTotal,
    getCartCount,
    getQueuedCommits,
    syncOfflineQueue,
    offlineQueueEventName: OFFLINE_QUEUE_EVENT,
    onCartChange: null,
    legacyWriteEnabled: legacyAdminWriteEnabled
};

applyAdminTextOverrides();

export {
    grantAdminRuntimeAccess,
    revokeAdminRuntimeAccess
};

if (!engineStatus.ready) {
    console.error('[DEN-500] Data engine init failed:', engineStatus.error);
    dispatchReadyEvent();
} else if (DATA_SCOPE === 'admin') {
    registerOfflineSyncListeners(syncOfflineQueueIfAuthorized);
    window.setTimeout(() => {
        dispatchReadyEvent();
    }, 0);
} else {
    loadDataFromSupabaseByScope()
        .then(() => {
            setupScopedRealtime();
            registerOfflineSyncListeners(syncOfflineQueueIfAuthorized);
        })
        .catch((error) => {
            console.error('[DEN-301] Data engine bootstrap failed:', error);
            fireDataUpdate('all');
        });
}
