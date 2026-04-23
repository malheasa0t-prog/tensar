// ===== TechZone Admin Data Engine - Orders =====
// Mapping helpers for orders, coupons, deposits, and contact records.

export function mapOrder(row, items) {
    return {
        id: row.id,
        displayNumber: Number(row.display_number || 0) || null,
        userId: row.user_id,
        customerName: row.customer_name,
        customerPhone: row.customer_phone,
        customerEmail: row.customer_email,
        total: parseFloat(row.total),
        status: row.status,
        deliveryMethod: row.delivery_method,
        paymentMethod: row.payment_method,
        shippingFee: parseFloat(row.shipping_fee) || 0,
        notes: row.notes,
        metadata: row.metadata || {},
        createdAt: row.created_at,
        items: items || []
    };
}

export function mapCoupon(row) {
    return {
        id: row.id,
        code: row.code,
        type: row.type,
        value: parseFloat(row.value),
        minOrder: parseFloat(row.min_order),
        maxUses: row.max_uses,
        usedCount: row.used_count,
        status: row.status,
        expiresAt: row.expires_at,
        createdAt: row.created_at
    };
}

export function mapServiceOrder(row) {
    return {
        id: row.id,
        userId: row.user_id,
        serviceId: row.service_id,
        serviceName: row.service_name,
        link: row.link,
        quantity: Number(row.quantity || 0),
        price: parseFloat(row.price || 0),
        costPrice: parseFloat(row.cost_price || 0),
        total: parseFloat(row.total || 0),
        status: row.status,
        externalOrderId: row.external_order_id || '',
        providerName: row.provider_name || '',
        adminNote: row.admin_note || '',
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

export function mapRepairBooking(row) {
    return {
        id: row.id,
        name: row.name,
        phone: row.phone,
        email: row.email,
        serviceId: row.service_id,
        serviceName: row.service_name,
        device: row.device,
        description: row.description,
        preferredDate: row.preferred_date,
        mode: row.mode,
        address: row.address || '',
        status: row.status,
        createdAt: row.created_at
    };
}

export function mapContactMessage(row) {
    return {
        id: row.id,
        name: row.name,
        email: row.email,
        phone: row.phone,
        serviceType: row.service_type,
        message: row.message,
        status: row.status,
        createdAt: row.created_at
    };
}

export function mapAuditLog(row) {
    return {
        id: row.id,
        action: row.action,
        actorId: row.actor_id,
        details: row.details,
        timestamp: row.created_at || row.timestamp
    };
}

export function mapDeposit(row) {
    return {
        ...row,
        amount: parseFloat(row.amount || 0)
    };
}

export function buildItemsByOrder(rows = []) {
    return rows.reduce((itemsByOrder, item) => {
        const orderId = item.order_id;
        if (!itemsByOrder[orderId]) itemsByOrder[orderId] = [];
        itemsByOrder[orderId].push({
            productId: item.product_id,
            productName: item.product_name,
            qty: item.qty,
            price: parseFloat(item.price),
            snapshot: item.snapshot || {}
        });
        return itemsByOrder;
    }, {});
}
