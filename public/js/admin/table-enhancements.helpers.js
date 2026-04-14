// ===== TechZone Admin - Table Enhancements Helpers =====
(function () {
    'use strict';

    const DEFAULT_PAGE_SIZE = 25;

    function normalizePageSize(value, options) {
        const supportedSizes = Array.isArray(options) && options.length ? options : [10, 25, 50];
        const numericValue = Number(value || 0);
        return supportedSizes.includes(numericValue) ? numericValue : supportedSizes.includes(DEFAULT_PAGE_SIZE) ? DEFAULT_PAGE_SIZE : supportedSizes[0];
    }

    function buildPaginationState(totalItems, currentPage, pageSize) {
        const safePageSize = Math.max(1, Number(pageSize || DEFAULT_PAGE_SIZE));
        const totalPages = Math.max(1, Math.ceil(Math.max(0, totalItems) / safePageSize));
        const safeCurrentPage = Math.min(Math.max(1, Number(currentPage || 1)), totalPages);
        const startIndex = totalItems === 0 ? 0 : (safeCurrentPage - 1) * safePageSize;
        const endIndex = totalItems === 0 ? 0 : Math.min(startIndex + safePageSize, totalItems);

        return {
            currentPage: safeCurrentPage,
            endIndex: endIndex,
            pageSize: safePageSize,
            startIndex: startIndex,
            totalItems: Math.max(0, totalItems),
            totalPages: totalPages
        };
    }

    function buildVisiblePageNumbers(currentPage, totalPages, maxButtons) {
        const safeMaxButtons = Math.max(3, Number(maxButtons || 5));
        const safeCurrentPage = Math.min(Math.max(1, Number(currentPage || 1)), Math.max(1, Number(totalPages || 1)));
        const safeTotalPages = Math.max(1, Number(totalPages || 1));
        const half = Math.floor(safeMaxButtons / 2);
        const start = Math.max(1, Math.min(safeCurrentPage - half, safeTotalPages - safeMaxButtons + 1));
        const end = Math.min(safeTotalPages, start + safeMaxButtons - 1);

        return Array.from({ length: end - start + 1 }, function (_, index) {
            return start + index;
        });
    }

    function buildRangeLabel(state, itemLabel) {
        if (!state || state.totalItems === 0) {
            return `لا توجد ${itemLabel || 'عناصر'} مطابقة حالياً`;
        }

        return `عرض ${state.startIndex + 1}-${state.endIndex} من ${state.totalItems} ${itemLabel || 'عنصر'}`;
    }

    window.AdminTableEnhancementHelpers = {
        buildPaginationState: buildPaginationState,
        buildRangeLabel: buildRangeLabel,
        buildVisiblePageNumbers: buildVisiblePageNumbers,
        normalizePageSize: normalizePageSize
    };

    if (window.__ENABLE_ADMIN_TABLE_TEST_HOOKS__) {
        window.__adminTableTestHooks = window.AdminTableEnhancementHelpers;
    }
})();
