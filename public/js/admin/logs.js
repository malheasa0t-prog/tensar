// ===== TechZone Admin - Logs =====
(function () {
    'use strict';

    const A = window.AdminApp;
    const H = window.AdminLogsHelpers;
    const state = { actorId: '', categoryId: 'all', searchQuery: '', startDate: '', endDate: '' };

    if (!A || !H) return;

    function getActorName(actorId) {
        return TZ.getUserById(actorId)?.fullName || 'النظام';
    }

    function buildPreparedLogs() {
        return TZ.clone(TZ.db.logs || []).map((log) => ({
            ...log,
            actorName: getActorName(log.actorId),
            meta: H.classifyAuditLog(log),
            searchText: H.buildSearchText(log, getActorName(log.actorId))
        })).sort((first, second) => new Date(second.timestamp || 0) - new Date(first.timestamp || 0));
    }

    function buildActorOptions(logs) {
        const options = Array.from(new Map(logs
            .filter((log) => log.actorId)
            .map((log) => [String(log.actorId), log.actorName]))
            .entries());

        return ['<option value="">كل المستخدمين</option>']
            .concat(options.map(([id, name]) => `<option value="${TZ.escapeHtml(id)}" ${state.actorId === id ? 'selected' : ''}>${TZ.escapeHtml(name)}</option>`))
            .join('');
    }

    function exportLogs(logs) {
        const rows = H.buildAuditExportRows(logs, getActorName);
        const csv = ['الوقت,المستخدم,التصنيف,الإجراء,التفاصيل,حساس']
            .concat(rows.map((row) => `"${row.timestamp}","${row.actor}","${row.category}","${row.action}","${row.details}","${row.sensitive}"`))
            .join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'audit-logs.csv';
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(link.href);
    }

    function bindFilters(logs) {
        document.getElementById('logSearch')?.addEventListener('input', function () {
            state.searchQuery = String(this.value || '');
            renderLogs();
        });
        document.getElementById('logCategoryFilter')?.addEventListener('change', function () {
            state.categoryId = String(this.value || 'all');
            renderLogs();
        });
        document.getElementById('logActorFilter')?.addEventListener('change', function () {
            state.actorId = String(this.value || '');
            renderLogs();
        });
        document.getElementById('logStartDate')?.addEventListener('change', function () {
            state.startDate = String(this.value || '');
            renderLogs();
        });
        document.getElementById('logEndDate')?.addEventListener('change', function () {
            state.endDate = String(this.value || '');
            renderLogs();
        });
        document.getElementById('exportLogsBtn')?.addEventListener('click', function () {
            exportLogs(logs);
        });
        document.getElementById('clearLogsBtn')?.addEventListener('click', async function () {
            const confirmed = await A.showConfirmModal({
                type: 'danger',
                title: 'مسح السجلات',
                message: 'مسح جميع سجلات التدقيق؟ هذا الإجراء لا يمكن التراجع عنه.',
                confirmText: 'مسح',
                cancelText: 'إلغاء'
            });
            if (!confirmed) return;
            TZ.db.logs = [];
            await Promise.resolve(TZ.commitDb('clear_logs', TZ.getSession()?.userId, 'مسح السجلات'));
            renderLogs();
            A.showToast('تم مسح السجلات');
        });
    }

    function renderLogs() {
        const preparedLogs = buildPreparedLogs();
        const filteredLogs = H.filterAuditLogs({
            actorId: state.actorId,
            categoryId: state.categoryId,
            endDate: state.endDate,
            logs: preparedLogs,
            searchQuery: state.searchQuery,
            startDate: state.startDate
        });

        A.adminContent.innerHTML = `
            <div class="filter-bar">
                <input type="text" id="logSearch" placeholder="بحث في السجلات..." value="${TZ.escapeHtml(state.searchQuery)}" style="flex:1;min-width:220px;">
                <select id="logCategoryFilter">
                    <option value="all" ${state.categoryId === 'all' ? 'selected' : ''}>كل التصنيفات</option>
                    <option value="auth" ${state.categoryId === 'auth' ? 'selected' : ''}>الدخول والوصول</option>
                    <option value="orders" ${state.categoryId === 'orders' ? 'selected' : ''}>الطلبات</option>
                    <option value="catalog" ${state.categoryId === 'catalog' ? 'selected' : ''}>المتجر</option>
                    <option value="finance" ${state.categoryId === 'finance' ? 'selected' : ''}>المالية</option>
                    <option value="system" ${state.categoryId === 'system' ? 'selected' : ''}>النظام</option>
                </select>
                <select id="logActorFilter">${buildActorOptions(preparedLogs)}</select>
                <input type="date" id="logStartDate" value="${TZ.escapeHtml(state.startDate)}">
                <input type="date" id="logEndDate" value="${TZ.escapeHtml(state.endDate)}">
                <button class="btn btn-outline btn-sm" id="exportLogsBtn"><i class="fas fa-download"></i> تصدير CSV</button>
                <button class="btn btn-outline btn-sm" id="clearLogsBtn"><i class="fas fa-trash"></i> مسح السجلات</button>
            </div>
            <div class="admin-panel">
                <div class="panel-header"><h2><i class="fas fa-history"></i> سجل العمليات (${filteredLogs.length})</h2></div>
                <div class="panel-body padded">
                    <div class="admin-logs-list">
                        ${filteredLogs.length === 0 ? '<div class="admin-customer-empty">لا توجد سجلات مطابقة للفلاتر الحالية.</div>' : filteredLogs.map((log) => `
                            <article class="admin-log-entry admin-log-entry--${log.meta.tone}">
                                <div class="admin-log-entry__meta">
                                    <span class="admin-log-badge">${TZ.escapeHtml(log.meta.categoryLabel)}</span>
                                    ${log.meta.isSensitive ? '<span class="admin-log-badge admin-log-badge--danger">حساس</span>' : ''}
                                    <small>${A.formatDateTime(log.timestamp)}</small>
                                </div>
                                <div class="admin-log-entry__body">
                                    <strong>${TZ.escapeHtml(log.action)}</strong>
                                    <p>${TZ.escapeHtml(log.actorName)} • ${TZ.escapeHtml(log.details || '-')}</p>
                                </div>
                            </article>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;

        bindFilters(filteredLogs);
    }

    A.sections.logs = renderLogs;
})();
