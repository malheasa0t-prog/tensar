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

    async function approveDeposit(deposit) {
        if (!confirm('هل تريد الموافقة على هذا الإيداع وإضافة الرصيد للمستخدم؟')) return;

        var authUser = await TZ.getSupabaseUser();
        var adminId = authUser ? authUser.id : TZ.getSession()?.userId;
        var userId = deposit.user_id || deposit.userId;
        if (!adminId || !userId) { A.showToast('تعذر تحديد المدير أو المستخدم'); return; }

        var adjustRes = await TZ.supabase.rpc('admin_adjust_wallet_balance', {
            p_admin_user_id: adminId,
            p_target_user_id: userId,
            p_amount: Number(deposit.amount),
            p_reason: 'موافقة على طلب إيداع #' + deposit.id
        });
        if (adjustRes.error) { A.showToast('فشل إضافة الرصيد إلى المحفظة'); return; }

        var updateRes = await TZ.supabase.from('deposits').update({
            status: 'approved', reviewed_by: adminId, reviewed_at: new Date().toISOString()
        }).eq('id', deposit.id);
        if (updateRes.error) { A.showToast('فشل تحديث حالة الإيداع'); return; }

        /* Note: admin_adjust_wallet_balance RPC already sends a notification to the user */

        A.showToast('تمت الموافقة وإضافة الرصيد بنجاح');
        await TZ.refreshData();
        renderDeposits();
    }

    async function rejectDeposit(deposit) {
        var reason = prompt('سبب الرفض (اختياري):');
        if (!confirm('هل تريد رفض هذا الإيداع؟')) return;

        var authUser = await TZ.getSupabaseUser();
        var result = await TZ.supabase.from('deposits').update({
            status: 'rejected', admin_note: reason || null,
            reviewed_by: authUser ? authUser.id : TZ.getSession()?.userId,
            reviewed_at: new Date().toISOString()
        }).eq('id', deposit.id);

        if (result.error) { A.showToast('تعذر رفض الإيداع'); return; }

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

        html += '<div class="admin-panel"><div class="panel-body"><div class="table-wrap"><table class="data-table"><thead><tr>'
            + '<th>المستخدم</th><th>المبلغ</th><th>الطريقة</th><th>الإثبات</th><th>الحالة</th><th>التاريخ</th><th>إجراءات</th></tr></thead><tbody>';

        if (filtered.length === 0) {
            html += '<tr><td colspan="7"><div class="empty-state"><i class="fas fa-money-check-alt"></i><p>لا توجد طلبات إيداع</p></div></td></tr>';
        } else {
            filtered.forEach(function (d) {
                var uid = d.user_id || d.userId || '-';
                var proof = d.proof_url || d.proofUrl;
                var proofHtml = proof ? '<a href="' + esc(proof) + '" target="_blank" style="color:var(--primary-light);">عرض</a>' : '-';
                var method = d.method === 'manual' ? 'تحويل يدوي' : d.method === 'gateway' ? 'بوابة دفع' : d.method || '-';
                var actions = d.status === 'pending'
                    ? '<button class="action-btn approve-dep" data-id="' + d.id + '" style="color:#2ecc71;" title="موافقة"><i class="fas fa-check-circle"></i></button>'
                    + '<button class="action-btn danger reject-dep" data-id="' + d.id + '" title="رفض"><i class="fas fa-times-circle"></i></button>'
                    : '—';

                html += '<tr>'
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
    }

    A.sections.deposits = renderDeposits;
})();
