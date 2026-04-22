// ===== TechZone Admin Data Engine - Sync =====
// Write operations, audit log sync, and refresh entry points.

import {
    assertAdminRuntimeAccess,
    db,
    generateId,
    legacyAdminWriteEnabled,
    nowIso,
    supabase
} from './core.js';
import { loadDataFromSupabaseByScope } from './loaders.js';
import { isRetryableNetworkError, queueOfflineCommit, syncQueuedCommits } from './offline.js';
import { fireDataUpdate } from './realtime.js';
import { fetchExistingProductSnapshot, syncProductRestockAlerts } from './restockAlerts.js';

const ERROR_CODE_PATTERN = /\[[A-Z]{2,4}-\d{3}\]/;

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
    if (!supabase) throw new Error(formatSyncMessage('DEN-304', 'Ø¹Ù…ÙŠÙ„ Supabase ØºÙŠØ± Ù…ØªØ§Ø­.'));
    const { error } = await queryPromise;
    if (error) throw createSyncError(code, error, fallbackMessage);
}

function commitLog(action, actorId, details) {
    const logEntry = { id: generateId('log-'), action, actorId, details, timestamp: nowIso() };
    db.logs.unshift(logEntry);
    if (!legacyAdminWriteEnabled || !supabase) return;

    supabase.from('audit_logs').insert([{
        id: logEntry.id,
        action: logEntry.action,
        actor_id: logEntry.actorId,
        details: logEntry.details
    }]).then(({ error }) => {
        if (error) console.error('[DEN-303] Log sync error:', error);
    });
}

async function syncProduct(product) {
    const previousProduct = await fetchExistingProductSnapshot({
        productId: product.id,
        supabase: supabase
    });

    await executeSync(
        supabase.from('products').upsert([{
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
            updated_at: nowIso()
        }]),
        'DEN-305',
        'ØªØ¹Ø°Ø± Ø­ÙØ¸ Ø§Ù„Ù…Ù†ØªØ¬ ÙÙŠ Ù‚Ø§Ø¹Ø¯Ø© Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª.'
    );

    await syncProductRestockAlerts({
        executeSync: executeSync,
        previousProduct: previousProduct,
        product: product,
        supabase: supabase
    });
}

async function syncOrder(order) {
    await executeSync(
        supabase.from('orders').upsert([{
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
        }]),
        'DEN-306',
        'ØªØ¹Ø°Ø± Ø­ÙØ¸ Ø§Ù„Ø·Ù„Ø¨ ÙÙŠ Ù‚Ø§Ø¹Ø¯Ø© Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª.'
    );
}

async function syncOrderItems(payload) {
    await executeSync(
        supabase.from('order_items').delete().eq('order_id', payload.orderId),
        'DEN-307',
        'ØªØ¹Ø°Ø± ØªØ­Ø¯ÙŠØ« Ø¹Ù†Ø§ØµØ± Ø§Ù„Ø·Ù„Ø¨.'
    );

    if (!Array.isArray(payload.items) || payload.items.length === 0) return;

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
        'ØªØ¹Ø°Ø± Ø­ÙØ¸ Ø¹Ù†Ø§ØµØ± Ø§Ù„Ø·Ù„Ø¨.'
    );
}

async function syncOrderDelete(payload) {
    await executeSync(
        supabase.from('order_items').delete().eq('order_id', payload.id),
        'DEN-308',
        'ØªØ¹Ø°Ø± Ø­Ø°Ù Ø¹Ù†Ø§ØµØ± Ø§Ù„Ø·Ù„Ø¨.'
    );
    await syncDelete('orders', payload.id);
}

async function syncCategory(category) {
    await executeSync(
        supabase.from('categories').upsert([{
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
        }]),
        'DEN-309',
        'ØªØ¹Ø°Ø± Ø­ÙØ¸ Ø§Ù„ÙØ¦Ø© ÙÙŠ Ù‚Ø§Ø¹Ø¯Ø© Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª.'
    );
}

async function syncCoupon(coupon) {
    await executeSync(
        supabase.from('coupons').upsert([{
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
        }]),
        'DEN-311',
        'ØªØ¹Ø°Ø± Ø­ÙØ¸ Ø§Ù„ÙƒÙˆØ¨ÙˆÙ† ÙÙŠ Ù‚Ø§Ø¹Ø¯Ø© Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª.'
    );
}

async function syncRepairService(service) {
    await executeSync(
        supabase.from('repair_services').upsert([{
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
        }]),
        'DEN-312',
        'ØªØ¹Ø°Ø± Ø­ÙØ¸ Ø®Ø¯Ù…Ø© Ø§Ù„ØµÙŠØ§Ù†Ø© ÙÙŠ Ù‚Ø§Ø¹Ø¯Ø© Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª.'
    );
}

async function syncRepairBooking(booking) {
    await executeSync(
        supabase.from('repair_bookings').upsert([{
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
        }]),
        'DEN-313',
        'ØªØ¹Ø°Ø± Ø­ÙØ¸ Ø·Ù„Ø¨ Ø§Ù„ØµÙŠØ§Ù†Ø© ÙÙŠ Ù‚Ø§Ø¹Ø¯Ø© Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª.'
    );
}

async function syncContactMessage(message) {
    await executeSync(
        supabase.from('contact_messages').upsert([{
            id: message.id,
            name: message.name,
            email: message.email,
            phone: message.phone,
            service_type: message.serviceType,
            message: message.message,
            status: message.status,
            created_at: message.createdAt || nowIso()
        }]),
        'DEN-314',
        'ØªØ¹Ø°Ø± Ø­ÙØ¸ Ø§Ù„Ø±Ø³Ø§Ù„Ø© ÙÙŠ Ù‚Ø§Ø¹Ø¯Ø© Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª.'
    );
}

async function syncUser(user) {
    await executeSync(
        supabase.from('app_users').upsert([{
            id: user.id,
            full_name: user.fullName,
            email: user.email,
            phone: user.phone,
            role: user.role,
            status: user.status,
            password_hash: user.passwordHash,
            created_at: user.createdAt || nowIso()
        }]),
        'DEN-315',
        'ØªØ¹Ø°Ø± Ø­ÙØ¸ Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù… ÙÙŠ Ù‚Ø§Ø¹Ø¯Ø© Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª.'
    );
}

async function syncSettings(settingsData) {
    await executeSync(
        supabase.from('settings').upsert([{ id: 1, data: settingsData }]),
        'DEN-316',
        'ØªØ¹Ø°Ø± Ø­ÙØ¸ Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª Ø§Ù„Ù…ÙˆÙ‚Ø¹.'
    );
}

async function syncDelete(table, id) {
    await executeSync(
        supabase.from(table).delete().eq('id', id),
        'DEN-317',
        'ØªØ¹Ø°Ø± Ø­Ø°Ù Ø§Ù„Ø¹Ù†ØµØ± Ù…Ù† Ù‚Ø§Ø¹Ø¯Ø© Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª.'
    );
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
    user: syncUser,
    user_delete: (payload) => syncDelete('app_users', payload.id)
};

function executeSyncHandler(resource) {
    const syncHandler = SYNC_HANDLERS[resource.type];
    return syncHandler ? syncHandler(resource.data) : Promise.resolve();
}

export function commitDb(action, actorId, details, resource) {
    assertAdminRuntimeAccess();
    commitLog(action, actorId, details);
    if (!legacyAdminWriteEnabled) {
        console.warn('Legacy admin write skipped (read-only mode). Migrate this action to the modern API routes.', action);
        return Promise.resolve();
    }
    if (!resource) return Promise.resolve();

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

