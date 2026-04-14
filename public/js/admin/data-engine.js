// ===== TechZone Admin Data Engine =====
// ES module entry point that wires shared state into the legacy window.TZ API.

import {
    ACCESSORY_MAIN_CATEGORY,
    ACCESSORY_MAIN_CATEGORY_ID,
    ACCESSORY_PUBLIC_LABEL,
    ACCESSORY_SECTION_NAME,
    ACCESSORY_SUBCATEGORY,
    ACCESSORY_SUBCATEGORY_ID,
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
    isAccessoryCatalogCategoryId,
    isAccessoryProduct,
    isAccessoryProductCategoryId,
    legacyAdminWriteEnabled,
    nowIso,
    revokeAdminRuntimeAccess,
    saveDbLocal,
    setSession,
    supabase,
    supabaseSignIn,
    supabaseSignOut,
    clearSession
} from './data-engine/core.js';
import { loadDataFromSupabaseByScope } from './data-engine/loaders.js';
import {
    OFFLINE_QUEUE_EVENT,
    getQueuedCommits,
    registerOfflineSyncListeners
} from './data-engine/offline.js';
import {
    getActiveRepairServices,
    getAccessoryProducts,
    getBrands,
    getCatalogProducts,
    getCategoryIcon,
    getCategoryName,
    getFeaturedProducts,
    getFilteredProducts,
    getLatestProducts,
    getProductById,
    getVisibleCatalogCategories
} from './data-engine/products.js';
import { fireDataUpdate, setupScopedRealtime } from './data-engine/realtime.js';
import { commitDb, refreshData, syncOfflineQueue } from './data-engine/sync.js';
import {
    canAccessAdmin,
    canAccessSection,
    findUserByAuthUser,
    getUserById,
    isCustomerUser
} from './data-engine/users.js';

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
    getAccessoryProducts,
    isAccessoryCatalogCategoryId,
    isAccessoryProductCategoryId,
    isAccessoryProduct,
    getActiveRepairServices,
    ROLES,
    ADMIN_SECTIONS,
    canAccessAdmin,
    canAccessSection,
    accessoryCatalog: {
        sectionName: ACCESSORY_SECTION_NAME,
        publicLabel: ACCESSORY_PUBLIC_LABEL,
        mainCategoryId: ACCESSORY_MAIN_CATEGORY_ID,
        subcategoryId: ACCESSORY_SUBCATEGORY_ID,
        mainCategorySeed: clone(ACCESSORY_MAIN_CATEGORY),
        subcategorySeed: clone(ACCESSORY_SUBCATEGORY),
        isAccessoryCatalogCategoryId,
        isAccessoryProductCategoryId,
        isAccessoryProduct
    },
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

export {
    grantAdminRuntimeAccess,
    revokeAdminRuntimeAccess
};

if (!engineStatus.ready) {
    console.error(engineStatus.error);
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
            console.error('Data engine bootstrap failed:', error);
            fireDataUpdate('all');
        });
}
