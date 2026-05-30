/**
 * TechZone Admin — Refund Requests Section
 *
 * Lists pending refund requests and allows the admin to approve
 * (credit wallet) or reject them manually.
 */
(function () {
    'use strict';

    var A = window.AdminApp;
    if (!A) return;

    var TABLE = 'refund_requests';

    function esc(v) { return TZ.escapeHtml(v == null ? '' : String(v)); }

    /**
     * Loads refund requests with optional status filter.
     *
     * @param {string} [statusFilter]
     * @returns {Promise<Array>}
     */
    async function loadRefundRequests(statusFilter) {
        var query = TZ.supabase
            .from(TABLE)
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);

        if (statusFilter && statusFilter !== 'all') {
            query = query.eq('status', statusFilter);
        }

        var res = await query;
        return res.data || [];
    }

    /**
     * Approves a refund via the atomic, idempotent admin_approve_refund RPC.
     *
     * The wallet credit, transaction, status flip, notification and audit log all
     * run server-side in one transaction with a FOR UPDATE lock and a
     * status='pending' guard, so a double-click or concurrent approval cannot
     * double-credit the wallet.
     *
     * @param {{ id: string, amount: number }} req
     * @returns {Promise<boolean>}
     */
    async function approveRefund(req) {
        var authUser = await TZ.getSupabaseUser();
        if (!authUser) {
            A.showErrorToast('REF-300', 'انتهت الجلسة. أعد تسجيل الدخول.');
            return false;
        }

        var result = await TZ.supabase.rpc('admin_approve_refund', {
            p_admin_user_id: authUser.id,
            p_request_id: req.id
        });

        if (result.error) {
            var msg = String(result.error.message || '');
            if (msg.includes('already processed')) {
                A.showErrorToast('REF-305', 'تم معالجة هذا الطلب مسبقاً');
            } else {
                A.showErrorToast('REF-301', 'فشل استرجاع المبلغ: ' + msg);
            }
            return false;
        }

        A.showToast('تم استرجاع ' + Number(req.amount).toFixed(2) + ' د.أ بنجاح');
        return true;
    }

    /**
     * Rejects a refund request with an optional admin note.
     *
     * @param {string} reqId
     * @param {string} [note]
     * @returns {Promise<boolean>}
     */
    async function rejectRefund(reqId, note) {
        var res = await TZ.supabase
            .from(TABLE)
            .update({
                status: 'rejected',
                admin_note: note || '',
                processed_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', reqId)
            .eq('status', 'pending');

        if (res.error) {
            A.showErrorToast('REF-304', 'فشل رفض طلب الاسترجاع');
            return false;
        }

        A.showToast('تم رفض طلب الاسترجاع');
        return true;
    }

    /**
     * Returns a status badge HTML string.
     *
     * @param {string} status
     * @returns {string}
     */
    function statusBadge(status) {
        var map = {
            pending: { bg: 'rgba(245,158,11,0.1)', color: '#f59e0b', label: 'بانتظار المراجعة' },
            approved: { bg: 'rgba(0,184,148,0.1)', color: '#00b894', label: 'تمت الموافقة' },
            rejected: { bg: 'rgba(255,118,117,0.1)', color: '#ff7675', label: 'مرفوض' }
        };
        var s = map[status] || map.pending;
        return '<span class="status-badge" style="background:' + s.bg + ';color:' + s.color + ';">' + s.label + '</span>';
    }

    /**
     * Renders the refund requests listing.
     *
     * @param {string} [filter]
     */
    async function renderRefunds(filter) {
        var currentFilter = filter || 'pending';

        A.adminContent.innerHTML = '<div class="admin-section-header"><div><h2><i class="fas fa-undo-alt"></i> طلبات الاسترجاع</h2></div></div>'
            + '<div class="admin-panel"><div class="panel-body"><div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>جاري التحميل...</p></div></div></div>';

        var requests = await loadRefundRequests(currentFilter);

        var html = '<div class="admin-section-header"><div>'
            + '<h2><i class="fas fa-undo-alt"></i> طلبات الاسترجاع</h2>'
            + '</div></div>';

        html += '<div class="admin-tabs" id="refundTabs">'
            + '<button class="admin-tab' + (currentFilter === 'pending' ? ' active' : '') + '" data-rfilter="pending"><i class="fas fa-clock"></i> بانتظار المراجعة</button>'
            + '<button class="admin-tab' + (currentFilter === 'approved' ? ' active' : '') + '" data-rfilter="approved"><i class="fas fa-check-circle"></i> تمت الموافقة</button>'
            + '<button class="admin-tab' + (currentFilter === 'rejected' ? ' active' : '') + '" data-rfilter="rejected"><i class="fas fa-times-circle"></i> مرفوض</button>'
            + '<button class="admin-tab' + (currentFilter === 'all' ? ' active' : '') + '" data-rfilter="all"><i class="fas fa-list"></i> الكل</button>'
            + '</div>';

        if (requests.length === 0) {
            html += '<div class="admin-panel"><div class="panel-body"><div class="empty-state"><i class="fas fa-check-double"></i><p>لا توجد طلبات استرجاع</p></div></div></div>';
        } else {
            html += '<div class="admin-panel"><div class="panel-body"><div class="table-wrap"><table class="data-table"><thead><tr>'
                + '<th>الخدمة / الطلب</th><th>المبلغ</th><th>السبب</th><th>الحالة</th><th>التاريخ</th>';

            if (currentFilter === 'pending' || currentFilter === 'all') {
                html += '<th style="width:140px;">إجراءات</th>';
            }
            html += '</tr></thead><tbody>';

            requests.forEach(function (r) {
                html += '<tr>'
                    + '<td><div style="display:flex;flex-direction:column;gap:4px;"><strong>' + esc(r.service_name || 'طلب') + '</strong>'
                    + '<small style="color:var(--text-muted);">ID: ' + esc(r.order_id).substring(0, 8) + '...</small></div></td>'
                    + '<td><strong style="color:#87e4ff;">' + Number(r.amount).toFixed(2) + ' د.أ</strong></td>'
                    + '<td><small style="color:var(--text-muted);">' + esc(r.reason || '-') + '</small></td>'
                    + '<td>' + statusBadge(r.status) + '</td>'
                    + '<td><small style="color:var(--text-muted);">' + new Date(r.created_at).toLocaleDateString('ar-JO') + '</small></td>';

                if (currentFilter === 'pending' || currentFilter === 'all') {
                    if (r.status === 'pending') {
                        html += '<td><div style="display:flex;gap:6px;">'
                            + '<button class="btn btn-icon approve-ref-btn" data-id="' + esc(r.id) + '" title="قبول" style="color:#00b894;background:rgba(0,184,148,0.1);border:none;padding:6px 10px;border-radius:6px;cursor:pointer;"><i class="fas fa-check"></i></button>'
                            + '<button class="btn btn-icon reject-ref-btn" data-id="' + esc(r.id) + '" title="رفض" style="color:#ff7675;background:rgba(255,118,117,0.1);border:none;padding:6px 10px;border-radius:6px;cursor:pointer;"><i class="fas fa-times"></i></button>'
                            + '</div></td>';
                    } else {
                        html += '<td>-</td>';
                    }
                }
                html += '</tr>';
            });

            html += '</tbody></table></div></div></div>';
        }

        A.adminContent.innerHTML = html;

        document.querySelectorAll('#refundTabs .admin-tab').forEach(function (tab) {
            tab.addEventListener('click', function () {
                renderRefunds(tab.dataset.rfilter);
            });
        });

        document.querySelectorAll('.approve-ref-btn').forEach(function (btn) {
            btn.addEventListener('click', async function () {
                var id = this.dataset.id;
                var match = requests.find(function (r) { return r.id === id; });
                if (!match) return;
                if (!window.confirm('هل تريد استرجاع ' + Number(match.amount).toFixed(2) + ' د.أ إلى محفظة العميل؟')) return;
                this.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                var ok = await approveRefund(match);
                if (ok) renderRefunds(currentFilter);
                else this.innerHTML = '<i class="fas fa-check"></i>';
            });
        });

        document.querySelectorAll('.reject-ref-btn').forEach(function (btn) {
            btn.addEventListener('click', async function () {
                var id = this.dataset.id;
                var note = window.prompt('سبب الرفض (اختياري):');
                if (note === null) return;
                this.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                var ok = await rejectRefund(id, note);
                if (ok) renderRefunds(currentFilter);
                else this.innerHTML = '<i class="fas fa-times"></i>';
            });
        });
    }

    A.sections.refunds = function () { renderRefunds('pending'); };
})();
