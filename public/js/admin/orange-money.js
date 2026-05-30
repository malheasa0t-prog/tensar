/**
 * TechZone Admin — Orange Money SMS Operations.
 */
(function () {
    'use strict';

    var A = window.AdminApp;
    if (!A) return;

    var searchQuery = '';
    var filterStatus = '';

    /**
     * Escapes a value for safe admin HTML output.
     *
     * @param {unknown} value
     * @returns {string}
     */
    function esc(value) {
        return TZ.escapeHtml(value == null ? '' : String(value));
    }

    /**
     * Formats an amount for the Orange Money table.
     *
     * @param {unknown} amount
     * @returns {string}
     */
    function formatAmount(amount) {
        return Number(amount || 0).toFixed(2) + ' د.أ';
    }

    /**
     * Resolves display metadata for an operation status.
     *
     * @param {string} status
     * @returns {{ color: string, label: string }}
     */
    function getStatusMeta(status) {
        return {
            duplicate: { label: 'مكرر', color: '#94a3b8' },
            failed: { label: 'فشل', color: '#e74c3c' },
            ignored: { label: 'متجاهل', color: '#94a3b8' },
            processed: { label: 'تمت المعالجة', color: '#2ecc71' },
            received: { label: 'مستلم', color: '#3498db' },
            unmatched: { label: 'غير مطابق', color: '#f39c12' }
        }[status] || { label: status || '-', color: '#94a3b8' };
    }

    /**
     * Resolves the Arabic target type label.
     *
     * @param {string} targetType
     * @returns {string}
     */
    function getTargetLabel(targetType) {
        return {
            deposit: 'إيداع',
            direct_wallet_topup: 'شحن مباشر',
            order: 'طلب منتج',
            service_order: 'طلب خدمة'
        }[targetType] || '-';
    }

    /**
     * Builds the searchable text for one operation row.
     *
     * @param {Record<string, unknown>} log
     * @returns {string}
     */
    function getSearchableText(log) {
        return [
            log.referenceId,
            log.payerPhone,
            log.normalizedPhone,
            log.targetId,
            log.userId,
            log.errorMessage
        ].join(' ').toLowerCase();
    }

    /**
     * Filters Orange Money logs by status and search text.
     *
     * @param {Array<Record<string, unknown>>} logs
     * @param {{ query?: string, status?: string }} filters
     * @returns {Array<Record<string, unknown>>}
     */
    function filterOrangeMoneyLogs(logs, filters) {
        var query = String(filters?.query || '').trim().toLowerCase();
        var status = String(filters?.status || '').trim();

        return (Array.isArray(logs) ? logs : []).filter(function (log) {
            var matchesStatus = !status || log.status === status;
            var matchesQuery = !query || getSearchableText(log).includes(query);
            return matchesStatus && matchesQuery;
        });
    }

    /**
     * Renders one status badge.
     *
     * @param {string} status
     * @returns {string}
     */
    function renderStatusBadge(status) {
        var meta = getStatusMeta(status);
        return '<span class="status-badge" style="background:' + meta.color + '22;color:' + meta.color + ';">' + esc(meta.label) + '</span>';
    }

    /**
     * Renders the Orange Money operations section.
     *
     * @returns {void}
     */
    function renderOrangeMoneyLogs() {
        var logs = (TZ.db.orangeMoneyLogs || []).slice();
        logs.sort(function (a, b) { return new Date(b.createdAt || 0) - new Date(a.createdAt || 0); });
        var filtered = filterOrangeMoneyLogs(logs, { query: searchQuery, status: filterStatus });

        // Payments that arrived but could not be auto-credited (ambiguous match
        // skipped, no match, or a processing failure) need manual attention.
        var needsAttention = logs.filter(function (log) {
            return log.status === 'unmatched' || log.status === 'failed';
        });

        var html = '<div class="admin-section-header"><div><h2><i class="fas fa-mobile-screen-button"></i> عمليات Orange Money</h2><p>' + logs.length + ' عملية</p></div></div>';

        if (needsAttention.length > 0) {
            var attentionTotal = needsAttention.reduce(function (sum, log) { return sum + (Number(log.amount) || 0); }, 0);
            html += '<div class="admin-panel" style="border:1px solid #f39c12;background:#f39c1212;margin-bottom:1rem;">'
                + '<div class="panel-body padded" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">'
                + '<div style="display:flex;align-items:center;gap:10px;">'
                + '<i class="fas fa-triangle-exclamation" style="color:#f39c12;font-size:1.5rem;"></i>'
                + '<div><strong style="color:#f39c12;">' + needsAttention.length + ' دفعة تحتاج مطابقة يدوية</strong>'
                + '<div style="color:var(--text-muted);font-size:0.9rem;">بقيمة ' + esc(formatAmount(attentionTotal)) + ' — وصلت ولم تُربَط بإيداع أو طلب تلقائياً.</div></div></div>'
                + '<button class="btn btn-sm" id="orangeMoneyReviewBtn" style="background:#f39c12;color:#fff;">عرض غير المطابقة</button>'
                + '</div></div>';
        }

        html += '<div class="filter-bar"><input type="search" id="orangeMoneySearch" placeholder="ابحث بالرقم المرجعي أو الهاتف..." value="' + esc(searchQuery) + '">';
        html += '<select id="orangeMoneyStatus"><option value="">كل الحالات</option>'
            + '<option value="received"' + (filterStatus === 'received' ? ' selected' : '') + '>مستلم</option>'
            + '<option value="processed"' + (filterStatus === 'processed' ? ' selected' : '') + '>تمت المعالجة</option>'
            + '<option value="unmatched"' + (filterStatus === 'unmatched' ? ' selected' : '') + '>غير مطابق</option>'
            + '<option value="failed"' + (filterStatus === 'failed' ? ' selected' : '') + '>فشل</option>'
            + '<option value="duplicate"' + (filterStatus === 'duplicate' ? ' selected' : '') + '>مكرر</option>'
            + '</select></div>';

        html += '<div class="admin-panel"><div class="panel-body"><div class="table-wrap"><table class="data-table"><thead><tr>'
            + '<th>الرقم المرجعي</th><th>المبلغ</th><th>الهاتف</th><th>الحالة</th><th>الهدف</th><th>المستخدم</th><th>التاريخ</th><th>ملاحظة</th></tr></thead><tbody>';

        if (filtered.length === 0) {
            html += '<tr><td colspan="8"><div class="empty-state"><i class="fas fa-mobile-screen-button"></i><p>لا توجد عمليات Orange Money</p></div></td></tr>';
        } else {
            filtered.forEach(function (log) {
                var target = getTargetLabel(log.targetType);
                var note = log.errorMessage || (log.smsText ? String(log.smsText).slice(0, 80) : '-');
                var rowAttention = (log.status === 'unmatched' || log.status === 'failed');
                html += '<tr' + (rowAttention ? ' style="background:#f39c1212;border-right:3px solid #f39c12;"' : '') + '>'
                    + '<td><small dir="ltr">' + esc(log.referenceId || '-') + '</small></td>'
                    + '<td style="font-weight:700;color:#2ecc71;">' + esc(formatAmount(log.amount)) + '</td>'
                    + '<td><small dir="ltr">' + esc(log.normalizedPhone || log.payerPhone || '-') + '</small></td>'
                    + '<td>' + renderStatusBadge(log.status) + '</td>'
                    + '<td>' + esc(target) + (log.targetId ? '<br><small dir="ltr">' + esc(log.targetId) + '</small>' : '') + '</td>'
                    + '<td><small dir="ltr">' + esc(log.userId || '-') + '</small></td>'
                    + '<td><small>' + (log.createdAt ? new Date(log.createdAt).toLocaleString('ar-JO') : '-') + '</small></td>'
                    + '<td><small title="' + esc(note) + '">' + esc(note) + '</small></td></tr>';
            });
        }

        html += '</tbody></table></div></div></div>';
        A.adminContent.innerHTML = html;

        document.getElementById('orangeMoneySearch')?.addEventListener('input', function () {
            searchQuery = this.value;
            renderOrangeMoneyLogs();
        });
        document.getElementById('orangeMoneyStatus')?.addEventListener('change', function () {
            filterStatus = this.value;
            renderOrangeMoneyLogs();
        });
        document.getElementById('orangeMoneyReviewBtn')?.addEventListener('click', function () {
            filterStatus = 'unmatched';
            searchQuery = '';
            renderOrangeMoneyLogs();
        });
    }

    A.sections['orange-money'] = renderOrangeMoneyLogs;

    if (window.__ENABLE_ORANGE_MONEY_ADMIN_TEST_HOOKS__) {
        window.__orangeMoneyAdminTestHooks = {
            filterOrangeMoneyLogs: filterOrangeMoneyLogs,
            formatAmount: formatAmount,
            getStatusMeta: getStatusMeta,
            getTargetLabel: getTargetLabel
        };
    }
})();
