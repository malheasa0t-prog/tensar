// ===== TechZone Admin - Global Search Helpers =====
(function () {
    'use strict';

    const RESULT_LIMIT = 8;

    function normalizeText(value) {
        return String(value || '').trim().toLowerCase();
    }

    function buildSearchText(parts) {
        return normalizeText((Array.isArray(parts) ? parts : []).filter(Boolean).join(' '));
    }

    function resolvePhysicalOrderSection(order, helpers) {
        const metadataKind = normalizeText(order?.metadata?.catalog_kind || order?.metadata?.catalogKind);
        if (metadataKind === 'accessories') return 'accessory-orders';
        if (metadataKind === 'products') return 'product-orders';

        const items = Array.isArray(order?.items) ? order.items : [];
        const hasRegularProduct = items.some(function (item) {
            const categoryId = item?.snapshot?.category_id || item?.snapshot?.categoryId || '';
            if (categoryId && typeof helpers?.isAccessoryProductCategoryId === 'function') {
                return !helpers.isAccessoryProductCategoryId(categoryId);
            }

            const product = typeof helpers?.getProductById === 'function' ? helpers.getProductById(item?.productId) : null;
            return product ? !helpers.isAccessoryProduct(product) : true;
        });

        return hasRegularProduct ? 'product-orders' : 'accessory-orders';
    }

    function countCustomerOrders(userId, orders, serviceOrders) {
        const normalizedUserId = String(userId || '').trim();
        if (!normalizedUserId) return 0;

        return (Array.isArray(orders) ? orders : []).filter(function (order) {
            return String(order?.userId || '').trim() === normalizedUserId;
        }).length + (Array.isArray(serviceOrders) ? serviceOrders : []).filter(function (order) {
            return String(order?.userId || '').trim() === normalizedUserId;
        }).length;
    }

    function buildAdminSearchIndex(input) {
        const products = Array.isArray(input?.products) ? input.products : [];
        const orders = Array.isArray(input?.orders) ? input.orders : [];
        const serviceOrders = Array.isArray(input?.serviceOrders) ? input.serviceOrders : [];
        const customers = Array.isArray(input?.users) ? input.users : [];
        const services = Array.isArray(input?.services) ? input.services : [];
        const categoryNameById = typeof input?.getCategoryName === 'function' ? input.getCategoryName : function () { return ''; };
        const helpers = input?.helpers || {};

        const productResults = products.map(function (product) {
            return {
                id: `product:${product.id}`,
                entityId: product.id,
                section: 'products',
                rowSelector: `[data-product-id="${product.id}"]`,
                kind: 'product',
                icon: 'fa-box',
                title: product.name || 'منتج بدون اسم',
                subtitle: `منتج • مخزون: ${Number(product.quantity || 0)}`,
                meta: categoryNameById(product.categoryId) || 'بدون فئة',
                searchText: buildSearchText([product.name, product.brand, product.id, categoryNameById(product.categoryId)])
            };
        });

        const physicalOrderResults = orders.map(function (order) {
            const section = resolvePhysicalOrderSection(order, helpers);
            return {
                id: `order:${order.id}`,
                entityId: order.id,
                section: section,
                rowSelector: `[data-order-id="${order.id}"]`,
                kind: 'order',
                icon: 'fa-shopping-bag',
                title: `طلب #${order.id}`,
                subtitle: `${order.customerName || 'عميل'} • ${Number(order.total || 0).toFixed(2)} د.أ`,
                meta: order.status || 'pending',
                searchText: buildSearchText([order.id, order.customerName, order.customerPhone, order.customerEmail])
            };
        });

        const digitalOrderResults = serviceOrders.map(function (order) {
            return {
                id: `digital-order:${order.id}`,
                entityId: order.id,
                section: 'orders',
                rowSelector: `[data-service-order-id="${order.id}"]`,
                kind: 'digital-order',
                icon: 'fa-bolt',
                title: `طلب رقمي #${order.id}`,
                subtitle: `${order.serviceName || order.serviceId || 'خدمة رقمية'} • ${Number(order.total || 0).toFixed(2)} د.أ`,
                meta: order.status || 'pending',
                searchText: buildSearchText([order.id, order.serviceName, order.serviceId, order.userId])
            };
        });

        const customerResults = customers.map(function (user) {
            const orderCount = countCustomerOrders(user.id, orders, serviceOrders);
            return {
                id: `customer:${user.id}`,
                entityId: user.id,
                section: 'customers',
                rowSelector: `[data-customer-id="${user.id}"]`,
                kind: 'customer',
                icon: 'fa-user',
                title: user.fullName || 'عميل',
                subtitle: `عميل • ${orderCount} طلبات`,
                meta: user.email || user.phone || user.status || 'active',
                searchText: buildSearchText([user.fullName, user.email, user.phone, user.id])
            };
        });

        const serviceResults = services.map(function (service) {
            return {
                id: `service:${service.id}`,
                entityId: service.id,
                section: 'services',
                rowSelector: `[data-service-id="${service.id}"]`,
                kind: 'service',
                icon: 'fa-screwdriver-wrench',
                title: service.name || 'خدمة',
                subtitle: `خدمة صيانة • ${Number(service.price || 0).toFixed(2)} د.أ`,
                meta: service.category || 'خدمات الصيانة',
                searchText: buildSearchText([service.name, service.description, service.category, service.id])
            };
        });

        return productResults
            .concat(physicalOrderResults)
            .concat(digitalOrderResults)
            .concat(customerResults)
            .concat(serviceResults);
    }

    function scoreSearchItem(item, query) {
        const normalizedQuery = normalizeText(query);
        if (!normalizedQuery) return 0;

        const title = normalizeText(item?.title);
        const meta = normalizeText(item?.meta);
        const subtitle = normalizeText(item?.subtitle);
        const searchText = normalizeText(item?.searchText);

        if (title.startsWith(normalizedQuery)) return 140;
        if (searchText.startsWith(normalizedQuery)) return 120;
        if (title.includes(normalizedQuery)) return 100;
        if (meta.includes(normalizedQuery)) return 70;
        if (subtitle.includes(normalizedQuery)) return 60;
        if (searchText.includes(normalizedQuery)) return 50;
        return 0;
    }

    function searchAdminIndex(index, query, limit) {
        const normalizedQuery = normalizeText(query);
        if (!normalizedQuery) return [];

        return (Array.isArray(index) ? index : [])
            .map(function (item) {
                return { item: item, score: scoreSearchItem(item, normalizedQuery) };
            })
            .filter(function (entry) {
                return entry.score > 0;
            })
            .sort(function (first, second) {
                return second.score - first.score || normalizeText(first.item.title).localeCompare(normalizeText(second.item.title));
            })
            .slice(0, Number(limit || RESULT_LIMIT))
            .map(function (entry) {
                return entry.item;
            });
    }

    window.AdminGlobalSearchHelpers = {
        RESULT_LIMIT: RESULT_LIMIT,
        normalizeText: normalizeText,
        buildSearchText: buildSearchText,
        resolvePhysicalOrderSection: resolvePhysicalOrderSection,
        countCustomerOrders: countCustomerOrders,
        buildAdminSearchIndex: buildAdminSearchIndex,
        scoreSearchItem: scoreSearchItem,
        searchAdminIndex: searchAdminIndex
    };

    if (window.__ENABLE_ADMIN_GLOBAL_SEARCH_TEST_HOOKS__) {
        window.__adminGlobalSearchTestHooks = window.AdminGlobalSearchHelpers;
    }
})();
