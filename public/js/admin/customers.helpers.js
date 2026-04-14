// ===== TechZone Admin - Customers Helpers =====
(function () {
    'use strict';

    function normalizeText(value) {
        return String(value || '').trim().toLowerCase();
    }

    function collectOrderActivity(userId, orders, serviceOrders) {
        const physicalOrders = (Array.isArray(orders) ? orders : [])
            .filter((order) => String(order?.userId || '') === String(userId || ''))
            .map((order) => ({
                createdAt: order.createdAt,
                id: order.id,
                label: order.customerName || order.id || 'طلب',
                section: 'orders',
                status: order.status || 'pending',
                total: Number(order.total || 0),
                type: 'physical'
            }));
        const digitalOrders = (Array.isArray(serviceOrders) ? serviceOrders : [])
            .filter((order) => String(order?.userId || '') === String(userId || ''))
            .map((order) => ({
                createdAt: order.createdAt,
                id: order.id,
                label: order.serviceName || order.id || 'طلب رقمي',
                section: 'orders',
                status: order.status || 'pending',
                total: Number(order.total || 0),
                type: 'digital'
            }));

        return physicalOrders
            .concat(digitalOrders)
            .sort((first, second) => new Date(second.createdAt || 0) - new Date(first.createdAt || 0));
    }

    function buildCustomerProfile(input) {
        const user = input?.user || {};
        const activity = collectOrderActivity(user.id, input?.orders, input?.serviceOrders);
        const totalSpend = activity.reduce((sum, item) => sum + Number(item.total || 0), 0);
        const searchableText = normalizeText([
            user.fullName,
            user.email,
            user.phone,
            activity[0]?.label
        ].join(' '));

        return {
            customer: user,
            createdAt: user.createdAt || null,
            lastLoginAt: user.lastLoginAt || null,
            lastOrderAt: activity[0]?.createdAt || null,
            orderCount: activity.length,
            recentOrders: activity.slice(0, 6),
            searchableText: searchableText,
            status: String(user.status || 'active').toLowerCase(),
            totalSpend: totalSpend
        };
    }

    function filterCustomerProfiles(input) {
        const searchQuery = normalizeText(input?.searchQuery);
        const statusFilter = normalizeText(input?.statusFilter);
        const profiles = Array.isArray(input?.profiles) ? input.profiles : [];

        return profiles.filter((profile) => {
            const matchesStatus = !statusFilter || statusFilter === 'all' || profile.status === statusFilter;
            const matchesQuery = !searchQuery || String(profile.searchableText || '').includes(searchQuery);
            return matchesStatus && matchesQuery;
        });
    }

    window.AdminCustomerHelpers = {
        buildCustomerProfile: buildCustomerProfile,
        collectOrderActivity: collectOrderActivity,
        filterCustomerProfiles: filterCustomerProfiles
    };

    if (window.__ENABLE_ADMIN_CUSTOMERS_TEST_HOOKS__) {
        window.__adminCustomerTestHooks = window.AdminCustomerHelpers;
    }
})();
