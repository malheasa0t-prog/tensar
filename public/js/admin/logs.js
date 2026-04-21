/**
 * TechZone Admin — Audit Logs Section (Rebuilt)
 *
 * Displays audit trail from audit_logs table.
 * Uses mapper names: action, actorId, details, timestamp.
 */
(function () {
    'use strict';

    var A = window.AdminApp;
    if (!A) return;

    var searchQuery = '';
    var currentPage = 1;
    var PAGE_SIZE = 25;

    function esc(v) { return TZ.escapeHtml(v == null ? '' : String(v)); }

    function renderLogs() {
        var logs = TZ.db.logs || [];
        logs.sort(function (a, b) { return new Date(b.timestamp || 0) - new Date(a.timestamp || 0); });

        var filtered = logs;
        if (searchQuery) {
            var q = searchQuery.toLowerCase();
            filtered = logs.filter(function (l) {
                return (l.action || '').toLowerCase().includes(q)
                    || (l.actorId || '').toLowerCase().includes(q)
                    || (typeof l.details === 'string' && l.details.toLowerCase().includes(q));
            });
        }

        var start = (currentPage - 1) * PAGE_SIZE;
        var pageItems = filtered.slice(start, start + PAGE_SIZE);
        var totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;

        var html = '<div class="admin-section-header"><div><h2><i class="fas fa-clipboard-list"></i> سجل العمليات</h2><p>' + logs.length + ' سجل</p></div></div>';

        html += '<div class="filter-bar"><input type="search" id="logsSearch" placeholder="ابحث بالإجراء أو المنفذ..." value="' + esc(searchQuery) + '"></div>';

        html += '<div class="admin-panel"><div class="panel-body"><div class="table-wrap"><table class="data-table"><thead><tr>'
            + '<th>الإجراء</th><th>المنفذ</th><th>التفاصيل</th><th>التاريخ</th></tr></thead><tbody>';

        if (pageItems.length === 0) {
            html += '<tr><td colspan="4"><div class="empty-state"><i class="fas fa-clipboard-list"></i><p>لا توجد سجلات</p></div></td></tr>';
        } else {
            pageItems.forEach(function (l) {
                var detailStr = '';
                if (l.details) {
                    if (typeof l.details === 'string') detailStr = l.details;
                    else if (typeof l.details === 'object') detailStr = JSON.stringify(l.details).substring(0, 80);
                }
                html += '<tr>'
                    + '<td><strong>' + esc(l.action || '-') + '</strong></td>'
                    + '<td><small>' + esc(l.actorId || '-') + '</small></td>'
                    + '<td><small>' + esc(detailStr || '-') + '</small></td>'
                    + '<td><small>' + (l.timestamp ? new Date(l.timestamp).toLocaleString('ar-JO') : '-') + '</small></td>'
                    + '</tr>';
            });
        }
        html += '</tbody></table></div></div>';

        if (totalPages > 1) {
            html += '<div class="admin-table-pagination"><div class="admin-table-pagination-info">عرض ' + pageItems.length + ' من ' + filtered.length + '</div>';
            html += '<div class="admin-table-pagination-controls">';
            html += '<button data-page="' + (currentPage - 1) + '"' + (currentPage <= 1 ? ' disabled' : '') + '><i class="fas fa-chevron-right"></i></button>';
            for (var i = 1; i <= Math.min(totalPages, 10); i++) {
                html += '<button data-page="' + i + '" class="' + (i === currentPage ? 'active' : '') + '">' + i + '</button>';
            }
            html += '<button data-page="' + (currentPage + 1) + '"' + (currentPage >= totalPages ? ' disabled' : '') + '><i class="fas fa-chevron-left"></i></button>';
            html += '</div></div>';
        }
        html += '</div>';

        A.adminContent.innerHTML = html;

        document.getElementById('logsSearch')?.addEventListener('input', function () { searchQuery = this.value; currentPage = 1; renderLogs(); });
        document.querySelectorAll('[data-page]').forEach(function (b) {
            b.addEventListener('click', function () {
                var p = parseInt(b.dataset.page, 10);
                if (p >= 1) { currentPage = p; renderLogs(); }
            });
        });
    }

    A.sections.logs = renderLogs;
    A.sections['audit-logs'] = renderLogs;
})();
