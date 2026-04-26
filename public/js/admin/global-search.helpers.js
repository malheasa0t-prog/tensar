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

    function formatOrderLabel(order) {
        const helper = window.AdminCoreHelpers?.formatOrderNumber;
        if (typeof helper === 'function') {
            return helper(order);
        }

        const displayNumber = Number(order?.displayNumber ?? order?.display_number);
        if (Number.isInteger(displayNumber) && displayNumber > 0) {
            return `#${displayNumber}`;
        }

        return String(order?.id || '').trim();
    }

    function resolvePhysicalOrderSection() {
        return 'product-orders';
    }

    function buildAdminSearchIndex(input) {
        const orders = Array.isArray(input?.orders) ? input.orders : [];
        const helpers = input?.helpers || {};

        return orders.map(function (order) {
            const section = resolvePhysicalOrderSection(order, helpers);
            const orderLabel = formatOrderLabel(order);
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
                title: `طلب ${orderLabel}`,
                searchText: buildSearchText([
                    order.id,
                    order.displayNumber,
                    orderLabel,
                    order.customerName,
                    order.customerPhone,
                    order.customerEmail
                ])
            };
        });
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
        formatOrderLabel: formatOrderLabel,
        buildSearchText: buildSearchText,
        resolvePhysicalOrderSection: resolvePhysicalOrderSection,
        buildAdminSearchIndex: buildAdminSearchIndex,
        scoreSearchItem: scoreSearchItem,
        searchAdminIndex: searchAdminIndex
    };

    if (window.__ENABLE_ADMIN_GLOBAL_SEARCH_TEST_HOOKS__) {
        window.__adminGlobalSearchTestHooks = window.AdminGlobalSearchHelpers;
    }
})();
