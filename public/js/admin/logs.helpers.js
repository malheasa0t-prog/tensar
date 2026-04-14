// ===== TechZone Admin - Logs Helpers =====
(function () {
    'use strict';

    const CATEGORY_RULES = [
        { id: 'auth', label: 'الدخول والوصول', tone: 'info', match: ['login', 'logout', 'session'] },
        { id: 'orders', label: 'الطلبات', tone: 'warning', match: ['order', 'booking', 'refund'] },
        { id: 'catalog', label: 'المتجر', tone: 'success', match: ['product', 'category', 'coupon', 'service'] },
        { id: 'finance', label: 'المالية', tone: 'danger', match: ['deposit', 'wallet', 'payment'] },
        { id: 'system', label: 'النظام', tone: 'info', match: ['settings', 'backup', 'clear', 'log'] }
    ];
    const SENSITIVE_KEYWORDS = ['delete', 'clear', 'price', 'role', 'permission', 'refund'];

    function normalizeText(value) {
        return String(value || '').trim().toLowerCase();
    }

    function classifyAuditLog(log) {
        const actionText = normalizeText(log?.action);
        const category = CATEGORY_RULES.find((rule) => rule.match.some((part) => actionText.includes(part))) || CATEGORY_RULES[CATEGORY_RULES.length - 1];
        const isSensitive = SENSITIVE_KEYWORDS.some((keyword) => actionText.includes(keyword));

        return {
            categoryId: category.id,
            categoryLabel: category.label,
            isSensitive: isSensitive,
            tone: isSensitive ? 'danger' : category.tone
        };
    }

    function buildSearchText(log, actorName) {
        return normalizeText([
            log?.action,
            log?.details,
            actorName
        ].join(' '));
    }

    function filterAuditLogs(input) {
        const logs = Array.isArray(input?.logs) ? input.logs : [];
        const actorId = String(input?.actorId || '').trim();
        const categoryId = normalizeText(input?.categoryId);
        const searchQuery = normalizeText(input?.searchQuery);
        const startDate = input?.startDate ? new Date(input.startDate) : null;
        const endDate = input?.endDate ? new Date(input.endDate) : null;
        if (endDate) {
            endDate.setHours(23, 59, 59, 999);
        }

        return logs.filter((entry) => {
            const category = classifyAuditLog(entry);
            const timestamp = new Date(entry.timestamp || entry.createdAt || 0);
            const matchesActor = !actorId || String(entry.actorId || '') === actorId;
            const matchesCategory = !categoryId || categoryId === 'all' || category.categoryId === categoryId;
            const matchesSearch = !searchQuery || String(entry.searchText || '').includes(searchQuery);
            const matchesStart = !startDate || timestamp >= startDate;
            const matchesEnd = !endDate || timestamp <= endDate;
            return matchesActor && matchesCategory && matchesSearch && matchesStart && matchesEnd;
        });
    }

    function buildAuditExportRows(logs, resolveActorName) {
        return (Array.isArray(logs) ? logs : []).map((entry) => {
            const category = classifyAuditLog(entry);
            return {
                action: entry.action || '',
                actor: resolveActorName(entry.actorId),
                category: category.categoryLabel,
                details: entry.details || '',
                sensitive: category.isSensitive ? 'yes' : 'no',
                timestamp: entry.timestamp || entry.createdAt || ''
            };
        });
    }

    window.AdminLogsHelpers = {
        buildAuditExportRows: buildAuditExportRows,
        buildSearchText: buildSearchText,
        classifyAuditLog: classifyAuditLog,
        filterAuditLogs: filterAuditLogs
    };

    if (window.__ENABLE_ADMIN_LOGS_TEST_HOOKS__) {
        window.__adminLogsTestHooks = window.AdminLogsHelpers;
    }
})();
