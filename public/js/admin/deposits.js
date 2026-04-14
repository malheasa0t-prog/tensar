// ===== TechZone Admin - Deposits Management =====
(function () {
    'use strict';

    const A = window.AdminApp;

    function resolveDepositUserId(deposit) {
        return deposit ? (deposit.userId || deposit.user_id || '') : '';
    }

    function getRpcAdjustmentRow(response) {
        const data = response ? response.data : null;

        if (Array.isArray(data)) {
            return data[0] || null;
        }

        return data && typeof data === 'object' ? data : null;
    }

    function buildApprovedDepositNotification(input) {
        const amount = Number(input.amount || 0).toFixed(2);

        return {
            user_id: input.userId,
            title: 'تم شحن رصيدك بنجاح!',
            body: 'تم إضافة ' + amount + ' د.أ إلى محفظتك.',
            type: 'success',
            reference_type: 'deposit',
            reference_id: input.depositId
        };
    }

    async function updateWalletNotificationReference(input) {
        if (!input.transactionId) {
            return false;
        }

        const result = await input.client
            .from('notifications')
            .update(input.payload)
            .eq('user_id', input.userId)
            .eq('reference_type', 'wallet_transaction')
            .eq('reference_id', String(input.transactionId))
            .select('id');

        if (result.error) {
            throw new Error('تعذر تحديث إشعار الإيداع بعد شحن الرصيد.');
        }

        return Array.isArray(result.data) && result.data.length > 0;
    }

    async function insertApprovedDepositNotification(input) {
        const result = await input.client.from('notifications').insert([input.payload]);

        if (result.error) {
            throw new Error('تعذر إنشاء إشعار الإيداع بعد شحن الرصيد.');
        }
    }

    async function ensureApprovedDepositNotification(input) {
        const payload = buildApprovedDepositNotification(input);
        const didUpdate = await updateWalletNotificationReference({
            client: input.client,
            userId: input.userId,
            transactionId: input.transactionId,
            payload: payload
        });

        if (!didUpdate) {
            await insertApprovedDepositNotification({
                client: input.client,
                payload: payload
            });
        }
    }

    function getApproveActionsHtml(depositId) {
        return '<button class="action-btn approve-deposit-btn" data-id="' + depositId + '" title="موافقة" style="color:#2ecc71;"><i class="fas fa-check-circle"></i></button>'
            + '<button class="action-btn danger reject-deposit-btn" data-id="' + depositId + '" title="رفض"><i class="fas fa-times-circle"></i></button>';
    }

    function buildDepositRow(deposit, statusBadge) {
        const userId = resolveDepositUserId(deposit) || '-';
        const proofLink = deposit.proofUrl || deposit.proof_url;
        const proofCell = proofLink ? '<a href="' + proofLink + '" target="_blank" style="color:var(--primary);">عرض الإثبات</a>' : '-';
        const methodLabel = deposit.method === 'manual' ? 'تحويل يدوي' : 'بوابة دفع';
        const dateStr = new Date(deposit.createdAt || deposit.created_at).toLocaleDateString('ar-JO');
        const actionsHtml = deposit.status === 'pending' ? getApproveActionsHtml(deposit.id) : '—';

        return '<tr data-deposit-id="' + deposit.id + '">'
            + '<td><small>' + TZ.escapeHtml(userId) + '</small></td>'
            + '<td style="font-weight:bold; color:#2ecc71;">' + TZ.formatPrice(deposit.amount) + '</td>'
            + '<td>' + methodLabel + '</td>'
            + '<td>' + proofCell + '</td>'
            + '<td>' + (statusBadge[deposit.status] || deposit.status) + '</td>'
            + '<td><small>' + dateStr + '</small></td>'
            + '<td class="actions-cell">' + actionsHtml + '</td>'
            + '</tr>';
    }

    function renderDepositsTable(deposits) {
        const statusBadge = {
            pending: '<span class="status-badge" style="background:#f39c12;color:#fff;">قيد المراجعة</span>',
            approved: '<span class="status-badge" style="background:#2ecc71;color:#fff;">تمت الموافقة</span>',
            rejected: '<span class="status-badge" style="background:#e74c3c;color:#fff;">مرفوض</span>'
        };

        const tableRows = deposits.map(function (deposit) {
            return buildDepositRow(deposit, statusBadge);
        }).join('');

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
            + '    <div class="panel-header"><h2><i class="fas fa-money-check-alt"></i> طلبات الإيداع (' + deposits.length + ')</h2></div>'
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
    }

    async function approveDeposit(deposits, depositId) {
        const deposit = deposits.find(function (item) { return item.id === depositId; });
        if (!deposit) {
            return;
        }

        const authUser = await TZ.getSupabaseUser();
        const adminUserId = authUser ? authUser.id : TZ.getSession()?.userId;
        if (!adminUserId) {
            A.showToast('تعذر تحديد حساب المدير الحالي.');
            return;
        }

        const userId = resolveDepositUserId(deposit);
        if (!userId) {
            A.showToast('تعذر تحديد صاحب طلب الإيداع.');
            return;
        }

        const adjustRes = await TZ.supabase.rpc('admin_adjust_wallet_balance', {
            p_admin_user_id: adminUserId,
            p_target_user_id: userId,
            p_amount: Number(deposit.amount),
            p_reason: 'موافقة على طلب إيداع #' + depositId
        });

        if (adjustRes.error) {
            A.showToast('فشل إضافة الرصيد إلى المحفظة.');
            return;
        }

        const updateRes = await TZ.supabase.from('deposits').update({
            status: 'approved',
            reviewed_by: adminUserId,
            reviewed_at: new Date().toISOString()
        }).eq('id', depositId);

        if (updateRes.error) {
            A.showToast('فشل تحديث حالة الإيداع.');
            return;
        }

        const adjustment = getRpcAdjustmentRow(adjustRes);
        let approvalMessage = 'تمت الموافقة وإضافة الرصيد بنجاح.';

        try {
            await ensureApprovedDepositNotification({
                client: TZ.supabase,
                userId: userId,
                amount: deposit.amount,
                depositId: depositId,
                transactionId: adjustment ? adjustment.transaction_id : ''
            });
        } catch (notificationError) {
            void notificationError;
            approvalMessage = 'تمت الموافقة وإضافة الرصيد، لكن تعذر إشعار المستخدم.';
        }

        A.showToast(approvalMessage);
        TZ.refreshData().then(function () { renderDeposits(); });
    }

    async function rejectDeposit(deposits, depositId, reason) {
        const authUser = await TZ.getSupabaseUser();
        const result = await TZ.supabase.from('deposits').update({
            status: 'rejected',
            admin_note: reason || null,
            reviewed_by: authUser ? authUser.id : TZ.getSession()?.userId,
            reviewed_at: new Date().toISOString()
        }).eq('id', depositId);

        if (result.error) {
            A.showToast('تعذر رفض الإيداع.');
            return;
        }

        const deposit = deposits.find(function (item) { return item.id === depositId; });
        if (deposit) {
            await TZ.supabase.from('notifications').insert([{
                user_id: resolveDepositUserId(deposit),
                title: 'تم رفض طلب الشحن',
                body: reason ? 'السبب: ' + reason : 'لم يتم قبول إثبات التحويل. يرجى المحاولة مرة أخرى.',
                type: 'error',
                reference_type: 'deposit',
                reference_id: depositId
            }]);
        }

        A.showToast('تم رفض الإيداع.');
        TZ.refreshData().then(function () { renderDeposits(); });
    }

    function bindApproveActions(deposits) {
        document.querySelectorAll('.approve-deposit-btn').forEach(function (button) {
            button.addEventListener('click', async function () {
                const depositId = this.dataset.id;
                const shouldApprove = confirm('هل تريد الموافقة على هذا الإيداع وإضافة الرصيد للمستخدم؟');
                if (!shouldApprove) {
                    return;
                }

                await approveDeposit(deposits, depositId);
            });
        });
    }

    function bindRejectActions(deposits) {
        document.querySelectorAll('.reject-deposit-btn').forEach(function (button) {
            button.addEventListener('click', async function () {
                const depositId = this.dataset.id;
                const reason = prompt('سبب الرفض (اختياري):');
                const shouldReject = confirm('هل تريد رفض هذا الإيداع؟');
                if (!shouldReject) {
                    return;
                }

                await rejectDeposit(deposits, depositId, reason);
            });
        });
    }

    function bindFilter(deposits) {
        const filterEl = document.getElementById('depositStatusFilter');
        if (!filterEl) {
            return;
        }

        filterEl.addEventListener('change', function () {
            const filterVal = this.value;
            document.querySelectorAll('#depositsTableBody tr').forEach(function (row) {
                if (!filterVal) {
                    row.style.display = '';
                    return;
                }

                const deposit = deposits.find(function (item) { return item.id === row.dataset.depositId; });
                row.style.display = deposit && deposit.status === filterVal ? '' : 'none';
            });
        });
    }

    function renderDeposits() {
        const deposits = TZ.db.deposits || [];
        renderDepositsTable(deposits);
        bindApproveActions(deposits);
        bindRejectActions(deposits);
        bindFilter(deposits);
    }

    if (window.__ENABLE_DEPOSIT_ADMIN_TEST_HOOKS__) {
        window.__depositAdminTestHooks = {
            resolveDepositUserId: resolveDepositUserId,
            getRpcAdjustmentRow: getRpcAdjustmentRow,
            buildApprovedDepositNotification: buildApprovedDepositNotification,
            updateWalletNotificationReference: updateWalletNotificationReference,
            insertApprovedDepositNotification: insertApprovedDepositNotification,
            ensureApprovedDepositNotification: ensureApprovedDepositNotification
        };
    }

    if (A) {
        A.sections.deposits = renderDeposits;
    }
})();
