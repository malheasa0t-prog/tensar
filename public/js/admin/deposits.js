/**
 * TechZone Admin — Deposits Section (Rebuilt)
 *
 * Manages deposit requests with approve/reject workflow via Supabase RPC.
 */
(function () {
    'use strict';

    var A = window.AdminApp;
    if (!A) return;

    var filterStatus = '';

    function esc(v) { return TZ.escapeHtml(v == null ? '' : String(v)); }

    /**
     * Returns the Orange Money payer phone saved with a deposit request.
     *
     * @param {Record<string, unknown>} deposit
     * @returns {string}
     */
    function getDepositPayerPhone(deposit) {
        var metadata = deposit && typeof deposit.metadata === 'object' ? deposit.metadata : {};
        return String(metadata.orange_money_payer_phone || metadata.orange_money_confirmed_phone || '').trim();
    }

    function getRpcAdjustmentRow(result) {
        return Array.isArray(result?.data) ? (result.data[0] || null) : (result?.data || null);
    }

    function buildApprovedDepositNotification(input) {
        return {
            user_id: input.userId,
            title: 'تم شحن رصيدك بنجاح!',
            body: 'تم إضافة ' + Number(input.amount || 0).toFixed(2) + ' د.أ إلى محفظتك.',
            type: 'success',
            reference_type: 'deposit',
            reference_id: input.depositId
        };
    }

    async function updateWalletNotificationReference(input) {
        if (!input.transactionId) {
            return false;
        }

        var result = await input.client.from('notifications')
            .update(input.payload)
            .eq('user_id', input.userId)
            .eq('reference_type', 'wallet_transaction')
            .eq('reference_id', input.transactionId)
            .select('id');

        if (result.error) {
            throw new Error('تعذر تحديث إشعار المحفظة');
        }

        return Array.isArray(result.data) && result.data.length > 0;
    }

    async function insertApprovedDepositNotification(input) {
        var result = await input.client.from('notifications').insert([input.payload]);
        if (result.error) {
            throw new Error('تعذر إنشاء إشعار الإيداع');
        }
    }

    async function ensureApprovedDepositNotification(input) {
        var payload = buildApprovedDepositNotification({
            userId: input.userId,
            amount: input.amount,
            depositId: input.depositId
        });
        var updated = await updateWalletNotificationReference({
            client: input.client,
            payload: payload,
            transactionId: input.transactionId,
            userId: input.userId
        });

        if (!updated) {
            await insertApprovedDepositNotification({
                client: input.client,
                payload: payload
            });
        }
    }

    async function approveDeposit(deposit) {
        if (!confirm('هل تريد الموافقة على هذا الإيداع وإضافة الرصيد للمستخدم؟')) return;

        var authUser = await TZ.getSupabaseUser();
        if (!authUser) { A.showErrorToast('DPM-200', 'انتهت الجلسة. أعد تسجيل الدخول.'); return; }

        var result = await TZ.supabase.rpc('admin_approve_deposit', {
            p_admin_user_id: authUser.id,
            p_deposit_id: deposit.id
        });

        if (result.error) {
            var msg = String(result.error.message || '');
            if (msg.includes('already processed')) {
                A.showErrorToast('DPM-304', 'تم معالجة هذا الإيداع مسبقاً');
            } else {
                A.showErrorToast('DPM-301', 'فشل الموافقة: ' + msg);
            }
            return;
        }

        A.showToast('تمت الموافقة وإضافة الرصيد بنجاح');
        await TZ.refreshData();
        renderDeposits();
    }

    async function bulkApproveDeposits(ids) {
        if (!Array.isArray(ids) || ids.length === 0) return;
        if (!confirm('الموافقة على ' + ids.length + ' إيداع وإضافة الرصيد لأصحابها؟')) return;

        var authUser = await TZ.getSupabaseUser();
        if (!authUser) { A.showErrorToast('DPM-200', 'انتهت الجلسة. أعد تسجيل الدخول.'); return; }

        var approved = 0;
        var failed = 0;
        for (var i = 0; i < ids.length; i++) {
            var result = await TZ.supabase.rpc('admin_approve_deposit', {
                p_admin_user_id: authUser.id,
                p_deposit_id: ids[i]
            });
            if (result.error) { failed++; } else { approved++; }
        }

        A.showToast('تمت الموافقة على ' + approved + ' إيداع' + (failed ? ' — تعذّر ' + failed : ''));
        await TZ.refreshData();
        renderDeposits();
    }

    async function rejectDeposit(deposit) {
        var reason = prompt('سبب الرفض (اختياري):');
        if (!confirm('هل تريد رفض هذا الإيداع؟')) return;

        var authUser = await TZ.getSupabaseUser();
        if (!authUser) { A.showErrorToast('DPM-200', 'انتهت الجلسة. أعد تسجيل الدخول.'); return; }
        var result = await TZ.supabase.from('deposits').update({
            status: 'rejected', admin_note: reason || null,
            reviewed_by: authUser.id,
            reviewed_at: new Date().toISOString()
        }).eq('id', deposit.id).eq('status', 'pending');

        if (result.error) { A.showErrorToast('DPM-303', 'تعذر رفض الإيداع'); return; }

        await TZ.supabase.from('notifications').insert([{
            user_id: deposit.user_id || deposit.userId,
            title: 'تم رفض طلب الشحن',
            body: reason ? 'السبب: ' + reason : 'لم يتم قبول إثبات التحويل.',
            type: 'error', reference_type: 'deposit', reference_id: String(deposit.id)
        }]);

        A.showToast('تم رفض الإيداع');
        await TZ.refreshData();
        renderDeposits();
    }

    function renderDeposits() {
        var deposits = TZ.db.deposits || [];
        var filtered = filterStatus ? deposits.filter(function (d) { return d.status === filterStatus; }) : deposits;
        filtered.sort(function (a, b) { return new Date(b.created_at || b.createdAt) - new Date(a.created_at || a.createdAt); });

        var statusBadges = {
            pending: '<span class="status-badge pending">قيد المراجعة</span>',
            approved: '<span class="status-badge approved">تمت الموافقة</span>',
            rejected: '<span class="status-badge rejected">مرفوض</span>'
        };

        var html = '<div class="admin-section-header"><div><h2><i class="fas fa-money-check-alt"></i> طلبات الإيداع</h2><p>' + deposits.length + ' طلب</p></div></div>';

        html += '<div class="filter-bar"><select id="depStatusFilter">'
            + '<option value="">كل الحالات</option>'
            + '<option value="pending"' + (filterStatus === 'pending' ? ' selected' : '') + '>قيد المراجعة</option>'
            + '<option value="approved"' + (filterStatus === 'approved' ? ' selected' : '') + '>تمت الموافقة</option>'
            + '<option value="rejected"' + (filterStatus === 'rejected' ? ' selected' : '') + '>مرفوض</option>'
            + '</select></div>';

        var pendingCount = filtered.filter(function (d) { return d.status === 'pending'; }).length;
        if (pendingCount > 0) {
            html += '<div id="depBulkBar" style="display:flex;align-items:center;gap:10px;margin-bottom:0.75rem;">'
                + '<button class="btn btn-sm" id="depBulkApproveBtn" disabled style="background:#2ecc71;color:#fff;"><i class="fas fa-check-double"></i> اعتماد المحدد (<span id="depSelCount">0</span>)</button>'
                + '<small style="color:var(--text-muted);">حدّد عدة طلبات معلّقة لاعتمادها دفعة واحدة.</small>'
                + '</div>';
        }

        html += '<div class="admin-panel"><div class="panel-body"><div class="table-wrap"><table class="data-table"><thead><tr>'
            + '<th style="width:34px;"><input type="checkbox" id="depSelectAll" title="تحديد الكل"></th>'
            + '<th>المستخدم</th><th>المبلغ</th><th>الطريقة</th><th>الإثبات</th><th>الحالة</th><th>التاريخ</th><th>إجراءات</th></tr></thead><tbody>';

        if (filtered.length === 0) {
            html += '<tr><td colspan="8"><div class="empty-state"><i class="fas fa-money-check-alt"></i><p>لا توجد طلبات إيداع</p></div></td></tr>';
        } else {
            filtered.forEach(function (d) {
                var uid = d.user_id || d.userId || '-';
                var proof = d.proof_url || d.proofUrl;
                var payerPhone = getDepositPayerPhone(d);
                var proofHtml = proof ? '<a href="' + esc(proof) + '" target="_blank" style="color:var(--primary-light);">عرض</a>' : '-';
                proofHtml = payerPhone ? '<small dir="ltr">' + esc(payerPhone) + '</small>' : proofHtml;
                var method = d.method === 'manual'
                    ? 'تحويل يدوي'
                    : d.method === 'gateway'
                        ? 'بوابة دفع'
                        : d.method === 'orange_money'
                            ? 'Orange Money'
                            : d.method || '-';
                var actions = d.status === 'pending'
                    ? '<button class="action-btn approve-dep" data-id="' + d.id + '" style="color:#2ecc71;" title="موافقة"><i class="fas fa-check-circle"></i></button>'
                    + '<button class="action-btn danger reject-dep" data-id="' + d.id + '" title="رفض"><i class="fas fa-times-circle"></i></button>'
                    : '—';

                var checkboxCell = d.status === 'pending'
                    ? '<input type="checkbox" class="dep-check" data-id="' + d.id + '">'
                    : '';

                html += '<tr>'
                    + '<td>' + checkboxCell + '</td>'
                    + '<td><small>' + esc(uid) + '</small></td>'
                    + '<td style="font-weight:700;color:#2ecc71;">' + TZ.formatPrice(d.amount) + '</td>'
                    + '<td>' + method + '</td>'
                    + '<td>' + proofHtml + '</td>'
                    + '<td>' + (statusBadges[d.status] || d.status) + '</td>'
                    + '<td><small>' + new Date(d.created_at || d.createdAt).toLocaleDateString('ar-JO') + '</small></td>'
                    + '<td class="actions-cell">' + actions + '</td></tr>';
            });
        }
        html += '</tbody></table></div></div></div>';

        A.adminContent.innerHTML = html;

        document.getElementById('depStatusFilter')?.addEventListener('change', function () { filterStatus = this.value; renderDeposits(); });
        document.querySelectorAll('.approve-dep').forEach(function (b) {
            b.addEventListener('click', function () {
                var dep = deposits.find(function (d) { return String(d.id) === b.dataset.id; });
                if (dep) approveDeposit(dep);
            });
        });
        document.querySelectorAll('.reject-dep').forEach(function (b) {
            b.addEventListener('click', function () {
                var dep = deposits.find(function (d) { return String(d.id) === b.dataset.id; });
                if (dep) rejectDeposit(dep);
            });
        });

        /* ── bulk approve wiring ── */
        var bulkBtn = document.getElementById('depBulkApproveBtn');
        var selectAll = document.getElementById('depSelectAll');
        function syncBulkState() {
            var checked = document.querySelectorAll('.dep-check:checked');
            var countEl = document.getElementById('depSelCount');
            if (countEl) countEl.textContent = String(checked.length);
            if (bulkBtn) bulkBtn.disabled = checked.length === 0;
        }
        document.querySelectorAll('.dep-check').forEach(function (cb) {
            cb.addEventListener('change', syncBulkState);
        });
        selectAll?.addEventListener('change', function () {
            document.querySelectorAll('.dep-check').forEach(function (cb) { cb.checked = selectAll.checked; });
            syncBulkState();
        });
        bulkBtn?.addEventListener('click', function () {
            var ids = Array.prototype.map.call(document.querySelectorAll('.dep-check:checked'), function (cb) { return cb.dataset.id; });
            bulkApproveDeposits(ids);
        });
    }

    A.sections.deposits = renderDeposits;

    if (window.__ENABLE_DEPOSIT_ADMIN_TEST_HOOKS__) {
        window.__depositAdminTestHooks = {
            buildApprovedDepositNotification: buildApprovedDepositNotification,
            ensureApprovedDepositNotification: ensureApprovedDepositNotification,
            getRpcAdjustmentRow: getRpcAdjustmentRow,
            insertApprovedDepositNotification: insertApprovedDepositNotification,
            updateWalletNotificationReference: updateWalletNotificationReference,
            getDepositPayerPhone: getDepositPayerPhone
        };
    }
})();
