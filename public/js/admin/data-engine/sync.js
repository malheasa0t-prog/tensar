// ===== TechZone Admin Data Engine - Sync =====
// Write operations, audit log sync, and refresh entry points.

import {
    assertAdminRuntimeAccess,
    db,
    generateId,
    nowIso,
    supabase
} from './core.js?v=20260530-2';
import { loadDataFromSupabaseByScope } from './loaders.js?v=20260530-2';
import { isRetryableNetworkError, queueOfflineCommit, syncQueuedCommits } from './offline.js?v=20260530-2';
import { fireDataUpdate } from './realtime.js?v=20260530-2';
import { fetchExistingProductSnapshot, syncProductRestockAlerts } from './restockAlerts.js?v=20260530-2';

const ERROR_CODE_PATTERN = /\[[A-Z]{2,4}-\d{3}\]/;
const ERROR_MESSAGES = Object.freeze({
    DEN_304: 'Supabase client is not available.',
    DEN_305: 'Failed to save the product to the database.',
    DEN_306: 'Failed to save the order to the database.',
    DEN_307: 'Failed to update the order items.',
    DEN_308_DELETE: 'Failed to delete the order items.',
    DEN_308_SAVE: 'Failed to save the order items.',
    DEN_309: 'Failed to save the category to the database.',
    DEN_311: 'Failed to save the coupon to the database.',
    DEN_312: 'Failed to save the repair service to the database.',
    DEN_313: 'Failed to save the repair booking to the database.',
    DEN_314: 'Failed to save the contact message to the database.',
    DEN_315: 'Legacy admin user synchronization is disabled. Use the dedicated admin route.',
    DEN_316: 'Failed to save the site settings.',
    DEN_317: 'Failed to delete the record from the database.'
});

function formatSyncMessage(code, message) {
    const normalizedMessage = String(message || '').trim();
    if (ERROR_CODE_PATTERN.test(normalizedMessage)) {
        return normalizedMessage;
    }

    return `[${code}] ${normalizedMessage}`;
}

function createSyncError(code, error, fallbackMessage) {
    const message = error?.message || error?.details || fallbackMessage;
    const syncError = new Error(message);
    syncError.message = formatSyncMessage(code, syncError.message);
    syncError.cause = error;
    return syncError;
}

async function executeSync(queryPromise, code, fallbackMessage) {
    if (!supabase) {
        throw new Error(formatSyncMessage('DEN-304', ERROR_MESSAGES.DEN_304));
    }

    const { error } = await queryPromise;
    if (error) {
        throw createSyncError(code, error, fallbackMessage);
    }
}

function commitLog(action, actorId, details) {
    const logEntry = { id: generateId('log-'), action, actorId, details, timestamp: nowIso() };
    db.logs.unshift(logEntry);

    if (!supabase) {
        return;
    }

    supabase.from('audit_logs').insert([{
        id: logEntry.id,
        action: logEntry.action,
        actor_id: logEntry.actorId,
        details: logEntry.details
    }]).then(({ error }) => {
        if (error) {
            console.error('[DEN-303] Log sync error:', error);
        }
    }).catch((error) => {
        console.error('[DEN-303] Log sync error:', error);
    });
}

async function syncUpsert(table, row, code, fallbackMessage) {
    await executeSync(
        supabase.from(table).upsert([row]),
        code,
        fallbackMessage
    );
}

async function syncDelete(table, id) {
    await executeSync(
        supabase.from(table).delete().eq('id', id),
        'DEN-317',
        ERROR_MESSAGES.DEN_317
    );
}

async function syncProduct(product) {
    const previousProduct = await fetchExistingProductSnapshot({
        productId: product.id,
        supabase: supabase
    });

    await syncUpsert('products', {
        id: product.id,
        name: product.name,
        category_id: product.categoryId,
        brand: product.brand,
        product_type: product.productType || 'physical',
        price: product.price,
        discount_price: product.discountPrice,
        quantity: product.quantity,
        rating: product.rating,
        sold: product.sold,
        status: product.status,
        description: product.description,
        specs: product.specs,
        images: product.images,
        variants: product.variants,
        low_stock_alert: product.lowStockAlert,
        sku: product.sku || null,
        slug: product.slug || null,
        icon: product.icon || null,
        is_featured: Boolean(product.isFeatured),
        updated_at: nowIso()
    }, 'DEN-305', ERROR_MESSAGES.DEN_305);

    await syncProductRestockAlerts({
        executeSync,
        previousProduct,
        product,
        supabase
    });
}

async function syncOrder(order) {
    await syncUpsert('orders', {
        id: order.id,
        user_id: order.userId || null,
        customer_name: order.customerName,
        customer_phone: order.customerPhone,
        customer_email: order.customerEmail,
        total: order.total,
        status: order.status,
        delivery_method: order.deliveryMethod || null,
        payment_method: order.paymentMethod || null,
        shipping_fee: order.shippingFee || 0,
        notes: order.notes || null,
        metadata: order.metadata || {}
    }, 'DEN-306', ERROR_MESSAGES.DEN_306);
}

async function syncOrderItems(payload) {
    await executeSync(
        supabase.from('order_items').delete().eq('order_id', payload.orderId),
        'DEN-307',
        ERROR_MESSAGES.DEN_307
    );

    if (!Array.isArray(payload.items) || payload.items.length === 0) {
        return;
    }

    await executeSync(
        supabase.from('order_items').insert(payload.items.map((item) => ({
            order_id: payload.orderId,
            product_id: item.productId,
            product_name: item.productName || '',
            qty: item.qty,
            price: item.price,
            snapshot: item.snapshot || {}
        }))),
        'DEN-308',
        ERROR_MESSAGES.DEN_308_SAVE
    );
}

async function syncOrderDelete(payload) {
    await executeSync(
        supabase.from('order_items').delete().eq('order_id', payload.id),
        'DEN-308',
        ERROR_MESSAGES.DEN_308_DELETE
    );
    await syncDelete('orders', payload.id);
}

async function syncCategory(category) {
    await syncUpsert('categories', {
        id: category.id,
        name: category.name,
        icon: category.icon,
        parent_id: category.parentId,
        image: category.image,
        description: category.description || null,
        status: category.status || 'active',
        sort_order: category.sortOrder || 0,
        slug: category.slug || null,
        show_in_navbar: category.showInNavbar !== false,
        updated_at: nowIso()
    }, 'DEN-309', ERROR_MESSAGES.DEN_309);
}

async function syncCoupon(coupon) {
    await syncUpsert('coupons', {
        id: coupon.id,
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
        min_order: coupon.minOrder,
        max_uses: coupon.maxUses,
        used_count: coupon.usedCount,
        status: coupon.status,
        expires_at: coupon.expiresAt,
        created_at: coupon.createdAt || nowIso()
    }, 'DEN-311', ERROR_MESSAGES.DEN_311);
}

async function syncRepairService(service) {
    await syncUpsert('repair_services', {
        id: service.id,
        name: service.name,
        category: service.category,
        description: service.description,
        price: service.price,
        duration: service.duration,
        icon: service.icon,
        image: service.image || '',
        status: service.status,
        created_at: service.createdAt || nowIso()
    }, 'DEN-312', ERROR_MESSAGES.DEN_312);
}

async function syncRepairBooking(booking) {
    await syncUpsert('repair_bookings', {
        id: booking.id,
        name: booking.name,
        phone: booking.phone,
        email: booking.email,
        service_id: booking.serviceId,
        service_name: booking.serviceName,
        device: booking.device,
        description: booking.description,
        preferred_date: booking.preferredDate,
        mode: booking.mode,
        address: booking.address || '',
        status: booking.status,
        created_at: booking.createdAt || nowIso()
    }, 'DEN-313', ERROR_MESSAGES.DEN_313);
}

async function syncContactMessage(message) {
    await syncUpsert('contact_messages', {
        id: message.id,
        name: message.name,
        email: message.email,
        phone: message.phone,
        service_type: message.serviceType,
        message: message.message,
        status: message.status,
        created_at: message.createdAt || nowIso()
    }, 'DEN-314', ERROR_MESSAGES.DEN_314);
}

function rejectLegacyUserSync() {
    throw new Error(formatSyncMessage('DEN-315', ERROR_MESSAGES.DEN_315));
}

async function syncSettings(settingsData) {
    await syncUpsert('settings', {
        id: 1,
        data: settingsData
    }, 'DEN-316', ERROR_MESSAGES.DEN_316);
}

const SYNC_HANDLERS = {
    product: syncProduct,
    product_delete: (payload) => syncDelete('products', payload.id),
    order: syncOrder,
    order_delete: syncOrderDelete,
    order_items: syncOrderItems,
    category: syncCategory,
    category_delete: (payload) => syncDelete('categories', payload.id),
    settings_update: syncSettings,
    coupon: syncCoupon,
    coupon_delete: (payload) => syncDelete('coupons', payload.id),
    repair_service: syncRepairService,
    repair_service_delete: (payload) => syncDelete('repair_services', payload.id),
    repair_booking: syncRepairBooking,
    repair_booking_delete: (payload) => syncDelete('repair_bookings', payload.id),
    contact_message: syncContactMessage,
    contact_message_delete: (payload) => syncDelete('contact_messages', payload.id),
    user: rejectLegacyUserSync,
    user_delete: rejectLegacyUserSync
};

function executeSyncHandler(resource) {
    const syncHandler = SYNC_HANDLERS[resource.type];
    return syncHandler ? syncHandler(resource.data) : Promise.resolve();
}

export function commitDb(action, actorId, details, resource) {
    assertAdminRuntimeAccess();
    commitLog(action, actorId, details);
    if (!resource) {
        return Promise.resolve();
    }

    if (!navigator.onLine) {
        return queueOfflineCommit(action, actorId, details, resource);
    }

    return executeSyncHandler(resource).catch(async (error) => {
        if (!isRetryableNetworkError(error)) {
            throw error;
        }
        return queueOfflineCommit(action, actorId, details, resource);
    });
}

export async function refreshData() {
    assertAdminRuntimeAccess();
    await loadDataFromSupabaseByScope();
    fireDataUpdate('all');
}

export async function syncOfflineQueue() {
    assertAdminRuntimeAccess();
    return syncQueuedCommits((queuedCommit) => executeSyncHandler(queuedCommit.resource));
}
