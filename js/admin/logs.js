// ===== TechZone Admin - Logs =====
(function () {
    'use strict';
    const A = window.AdminApp;

    // ===== LOGS =====
    function renderLogs() {
        const logs = TZ.clone(TZ.db.logs || []).reverse();
        A.adminContent.innerHTML = `
                            <div class="filter-bar">
                                <input type="text" id="logSearch" placeholder="بحث في السجلات..." style="flex:1;min-width:200px;">
                                    <button class="btn btn-outline btn-sm" id="exportLogsBtn"><i class="fas fa-download"></i> تصدير CSV</button>
                                    <button class="btn btn-outline btn-sm" id="clearLogsBtn" style="color:var(--danger);border-color:var(--danger);"><i class="fas fa-trash"></i> مسح السجلات</button>
                            </div>
                            <div class="admin-panel">
                                <div class="panel-header"><h2><i class="fas fa-history"></i> سجل العمليات (${logs.length})</h2></div>
                                <div class="panel-body" id="logsContainer">
                                    ${logs.length === 0 ? '<div class="empty-state"><i class="fas fa-history"></i><p>لا توجد سجلات</p></div>' :
                logs.map(l => {
                    const user = TZ.getUserById(l.actorId);
                    return `<div class="log-entry" data-text="${TZ.escapeHtml((l.action + ' ' + l.details).toLowerCase())}">
                            <span class="log-time">${A.formatDateTime(l.timestamp)}</span>
                            <span class="log-action">${TZ.escapeHtml(l.action)}</span>
                            <span class="log-details">${user ? TZ.escapeHtml(user.fullName) + ' — ' : ''}${TZ.escapeHtml(l.details)}</span>
                        </div>`;
                }).join('')}
                                </div>
                            </div>
                            `;

        document.getElementById('logSearch').addEventListener('input', function () {
            const q = this.value.toLowerCase();
            document.querySelectorAll('.log-entry').forEach(el => {
                el.style.display = el.dataset.text.includes(q) ? '' : 'none';
            });
        });

        document.getElementById('exportLogsBtn').addEventListener('click', function () {
            const csv = 'الوقت,الإجراء,التفاصيل\n' + logs.map(l => `"${l.timestamp}","${l.action}","${l.details}"`).join('\n');
            const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'audit-logs.csv';
            a.click();
        });

        document.getElementById('clearLogsBtn').addEventListener('click', function () {
            A.showConfirmModal('مسح السجلات', 'مسح جميع السجلات؟ هذا الإجراء لا يمكن التراجع عنه.', () => {
                TZ.db.logs = [];
                TZ.commitDb('clear_logs', TZ.getSession()?.userId, 'مسح السجلات');
                renderLogs();
                A.showToast('تم مسح السجلات');
            });
        });
    }

    A.sections.logs = renderLogs;
})();
