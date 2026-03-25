// ===== TechZone Admin - Deposits Management =====
(function () {
    'use strict';
    const A = window.AdminApp;

    function renderDeposits() {
        const deposits = TZ.db.deposits || [];

        const statusBadge = {
            pending: '<span class="status-badge" style="background:#f39c12;color:#fff;">قيد المراجعة</span>',
            approved: '<span class="status-badge" style="background:#2ecc71;color:#fff;">تمت الموافقة</span>',
            rejected: '<span class="status-badge" style="background:#e74c3c;color:#fff;">مرفوض</span>'
        };

        let tableRows = '';
        deposits.forEach(function(d) {
            const userId = d.userId || d.user_id || '-';
            const proofLink = d.proofUrl || d.proof_url;
            const proofCell = proofLink ? '<a href="' + proofLink + '" target="_blank" style="color:var(--primary);">عرض الإثبات</a>' : '-';
            const methodLabel = d.method === 'manual' ? 'تحويل يدوي' : 'بوابة دفع';
            const dateStr = new Date(d.createdAt || d.created_at).toLocaleDateString('ar-JO');
            const actionsHtml = d.status === 'pending'
                ? '<button class="action-btn approve-deposit-btn" data-id="' + d.id + '" title="موافقة" style="color:#2ecc71;"><i class="fas fa-check-circle"></i></button>'
                  + '<button class="action-btn danger reject-deposit-btn" data-id="' + d.id + '" title="رفض"><i class="fas fa-times-circle"></i></button>'
                : '—';

            tableRows += '<tr data-deposit-id="' + d.id + '">'
                + '<td><small>' + TZ.escapeHtml(userId) + '</small></td>'
                + '<td style="font-weight:bold; color:#2ecc71;">' + TZ.formatPrice(d.amount) + '</td>'
                + '<td>' + methodLabel + '</td>'
                + '<td>' + proofCell + '</td>'
                + '<td>' + (statusBadge[d.status] || d.status) + '</td>'
                + '<td><small>' + dateStr + '</small></td>'
                + '<td class="actions-cell">' + actionsHtml + '</td>'
                + '</tr>';
        });

        A.adminContent.innerHTML = ''
            + '<div class="filter-bar">'
            + '    <select id="depositStatusFilter">'
            + '        <option value="">كل الحالات</option>'
            + '        <option value="pending">قيد المراجعة</option>'
            + '        <option value="approved">تمت الموافقة</option>'
            + '        <option value="rejected">مرفوض</option>'
            + '    </select>'
            + '</div>'
            + '<div class="admin-panel">'
            + '    <div class="panel-header"><h2><i class="fas fa-money-check-alt"></i> إدارة الإيداعات (' + deposits.length + ')</h2></div>'
            + '    <div class="panel-body">'
            + '        <div class="table-wrap">'
            + '        <table class="data-table">'
            + '            <thead><tr>'
            + '                <th>المستخدم</th>'
            + '                <th>المبلغ</th>'
            + '                <th>الطريقة</th>'
            + '                <th>إثبات التحويل</th>'
            + '                <th>الحالة</th>'
            + '                <th>التاريخ</th>'
            + '                <th>إجراءات</th>'
            + '            </tr></thead>'
            + '            <tbody id="depositsTableBody">' + tableRows + '</tbody>'
            + '        </table>'
            + '        </div>'
            + '    </div>'
            + '</div>';

        // Approve deposit
        document.querySelectorAll('.approve-deposit-btn').forEach(function(btn) {
            btn.addEventListener('click', async function() {
                var depositId = this.dataset.id;
                if (!confirm('هل تريد الموافقة على هذا الإيداع وإضافة الرصيد للمستخدم؟')) return;

                var deposit = deposits.find(function(d) { return d.id === depositId; });
                if (!deposit) return;

                var authUser = await TZ.getSupabaseUser();
                var adminUserId = authUser ? authUser.id : TZ.getSession()?.userId;
                if (!adminUserId) {
                    alert('تعذر تحديد حساب المدير الحالي');
                    return;
                }

                var userId = deposit.userId || deposit.user_id;
                var adjustRes = await TZ.supabase.rpc('admin_adjust_wallet_balance', {
                    p_admin_user_id: adminUserId,
                    p_target_user_id: userId,
                    p_amount: Number(deposit.amount),
                    p_reason: 'موافقة على طلب إيداع #' + depositId
                });

                if (adjustRes.error) {
                    alert('فشل إضافة الرصيد إلى المحفظة');
                    return;
                }

                var result = await TZ.supabase.from('deposits').update({
                    status: 'approved',
                    reviewed_by: adminUserId,
                    reviewed_at: new Date().toISOString()
                }).eq('id', depositId);

                if (result.error) { alert('فشل تحديث الإيداع'); return; }

                var wallet = null;

                if (wallet) {
                    var newBalance = Number(wallet.balance) + Number(deposit.amount);
                    await TZ.supabase.from('wallets').update({
                        balance: newBalance,
                        total_deposited: Number(wallet.total_deposited) + Number(deposit.amount),
                        updated_at: new Date().toISOString()
                    }).eq('id', wallet.id);

                    await TZ.supabase.from('wallet_transactions').insert([{
                        wallet_id: wallet.id,
                        user_id: userId,
                        type: 'deposit',
                        amount: Number(deposit.amount),
                        balance_after: newBalance,
                        description: 'شحن يدوي — تمت الموافقة',
                        reference_id: depositId
                    }]);

                    await TZ.supabase.from('notifications').insert([{
                        user_id: userId,
                        title: 'تم شحن رصيدك بنجاح!',
                        body: 'تم إضافة ' + Number(deposit.amount).toFixed(2) + ' د.أ إلى محفظتك.',
                        type: 'success',
                        reference_type: 'deposit',
                        reference_id: depositId
                    }]);
                }

                alert('تم الموافقة وإضافة الرصيد بنجاح ✅');
                TZ.refreshData().then(function() { renderDeposits(); });
            });
        });

        // Reject deposit
        document.querySelectorAll('.reject-deposit-btn').forEach(function(btn) {
            btn.addEventListener('click', async function() {
                var depositId = this.dataset.id;
                var reason = prompt('سبب الرفض (اختياري):');
                if (!confirm('هل تريد رفض هذا الإيداع؟')) return;

                var authUser = await TZ.getSupabaseUser();
                await TZ.supabase.from('deposits').update({
                    status: 'rejected',
                    admin_note: reason || null,
                    reviewed_by: authUser ? authUser.id : TZ.getSession()?.userId,
                    reviewed_at: new Date().toISOString()
                }).eq('id', depositId);

                var deposit = deposits.find(function(d) { return d.id === depositId; });
                if (deposit) {
                    var userId = deposit.userId || deposit.user_id;
                    await TZ.supabase.from('notifications').insert([{
                        user_id: userId,
                        title: 'تم رفض طلب الشحن',
                        body: reason ? 'السبب: ' + reason : 'لم يتم قبول إثبات التحويل. يرجى المحاولة مرة أخرى.',
                        type: 'error',
                        reference_type: 'deposit',
                        reference_id: depositId
                    }]);
                }

                alert('تم رفض الإيداع');
                TZ.refreshData().then(function() { renderDeposits(); });
            });
        });

        // Filter
        var filterEl = document.getElementById('depositStatusFilter');
        if (filterEl) {
            filterEl.addEventListener('change', function() {
                var filterVal = this.value;
                document.querySelectorAll('#depositsTableBody tr').forEach(function(row) {
                    if (!filterVal) { row.style.display = ''; return; }
                    var deposit = deposits.find(function(d) { return d.id === row.dataset.depositId; });
                    row.style.display = (deposit && deposit.status === filterVal) ? '' : 'none';
                });
            });
        }
    }

    // Register section
    if (A) A.sections.deposits = renderDeposits;
})();
