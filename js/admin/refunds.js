// ===== TechZone Admin - Refund Requests =====
(function () {
    'use strict';

    const A = window.AdminApp;
    const MIGRATION_PATH = 'admin_dashboard_extensions.sql';

    function money(value) {
        return TZ.formatPrice(Number(value || 0));
    }

    function statusBadge(status) {
        const map = {
            pending: '<span class="status-badge pending">قيد المراجعة</span>',
            approved: '<span class="status-badge active">تمت الموافقة</span>',
            rejected: '<span class="status-badge hidden">مرفوض</span>',
        };
        return map[status] || `<span class="status-badge">${TZ.escapeHtml(status || '-')}</span>`;
    }

    function orderTypeLabel(type) {
        return type === 'digital' ? 'طلب رقمي' : type === 'product' ? 'طلب منتج' : (type || '-');
    }

    function tableMissing(error) {
        const message = String(error?.message || '').toLowerCase();
        return message.includes('refund_requests')
            && (message.includes('does not exist') || message.includes('could not find') || message.includes('relation'));
    }

    function getCustomers() {
        return TZ.db.users
            .filter((user) => TZ.isCustomerUser(user))
            .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }

    function renderSetupMessage() {
        A.adminContent.innerHTML = `
            <div class="admin-panel">
                <div class="panel-header">
                    <h2><i class="fas fa-rotate-left"></i> تفعيل طلبات الاسترجاع</h2>
                </div>
                <div class="panel-body padded" style="display:grid;gap:16px;">
                    <div style="padding:16px;border:1px solid rgba(241,196,15,.35);background:rgba(241,196,15,.10);border-radius:14px;display:grid;gap:10px;">
                        <strong>جدول طلبات الاسترجاع غير موجود بعد.</strong>
                        <div style="color:var(--text-muted);line-height:1.8;">
                            أضفت لك واجهة الإدارة لهذا القسم، لكن قاعدة البيانات تحتاج ملف الترحيل
                            <code>${MIGRATION_PATH}</code>
                            حتى يبدأ العمل فعلياً.
                        </div>
                    </div>
                    <div style="padding:16px;border:1px solid var(--border-color);background:var(--bg-lighter);border-radius:14px;display:grid;gap:8px;">
                        <strong>ماذا يفعل ملف الترحيل؟</strong>
                        <div style="color:var(--text-muted);font-size:.92rem;">ينشئ جدول <code>refund_requests</code> ويضيف صلاحيات الإدارة لقراءة الإيداعات والإشعارات وطلبات الاسترجاع.</div>
                    </div>
                </div>
            </div>
        `;
    }

    function renderRefunds() {
        A.adminContent.innerHTML = `
            <div class="admin-panel">
                <div class="panel-body" style="padding:32px;text-align:center;color:var(--text-muted);">
                    <i class="fas fa-spinner fa-spin" style="font-size:1.5rem;margin-bottom:12px;display:block;"></i>
                    جاري تحميل طلبات الاسترجاع...
                </div>
            </div>
        `;

        (async () => {
            const customers = getCustomers();
            const { data, error } = await TZ.supabase
                .from('refund_requests')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                if (tableMissing(error)) {
                    renderSetupMessage();
                    return;
                }

                A.adminContent.innerHTML = `
                    <div class="admin-panel">
                        <div class="panel-body" style="padding:26px;text-align:center;color:#e74c3c;">
                            تعذر تحميل طلبات الاسترجاع: ${TZ.escapeHtml(error.message || 'خطأ غير متوقع')}
                        </div>
                    </div>
                `;
                return;
            }

            renderRefundsContent(customers, data || []);
        })();
    }

    function renderRefundsContent(customers, refundRequests) {
        A.adminContent.innerHTML = `
            <div class="admin-panel" style="margin-bottom:18px;">
                <div class="panel-header">
                    <h2><i class="fas fa-plus-circle"></i> إضافة طلب استرجاع يدوي</h2>
                </div>
                <div class="panel-body padded">
                    <form class="admin-form" id="refundRequestForm">
                        <div class="form-grid">
                            <div class="admin-form-group">
                                <label>العميل *</label>
                                <select id="refundUserId" required>
                                    <option value="">اختر العميل</option>
                                    ${customers.map((customer) => `
                                        <option value="${customer.authUserId || customer.id}">
                                            ${TZ.escapeHtml(customer.fullName)}${customer.phone ? ` - ${TZ.escapeHtml(customer.phone)}` : ''}
                                        </option>
                                    `).join('')}
                                </select>
                            </div>
                            <div class="admin-form-group">
                                <label>نوع الطلب *</label>
                                <select id="refundOrderType" required>
                                    <option value="product">طلب منتج</option>
                                    <option value="digital">طلب رقمي</option>
                                </select>
                            </div>
                            <div class="admin-form-group">
                                <label>رقم الطلب *</label>
                                <div class="admin-input-wrap"><i class="fas fa-hashtag"></i><input type="text" id="refundOrderId" required></div>
                            </div>
                            <div class="admin-form-group">
                                <label>المبلغ *</label>
                                <div class="admin-input-wrap"><i class="fas fa-money-bill-wave"></i><input type="number" id="refundAmount" min="0.01" step="0.01" required></div>
                            </div>
                            <div class="admin-form-group full">
                                <label>سبب الاسترجاع *</label>
                                <textarea id="refundReason" rows="3" required placeholder="اكتب سبب طلب الاسترجاع"></textarea>
                            </div>
                        </div>
                        <button type="submit" class="btn btn-primary" id="createRefundRequestBtn"><i class="fas fa-save"></i> إنشاء الطلب</button>
                    </form>
                </div>
            </div>

            <div class="filter-bar">
                <select id="refundStatusFilter">
                    <option value="">كل الحالات</option>
                    <option value="pending">قيد المراجعة</option>
                    <option value="approved">تمت الموافقة</option>
                    <option value="rejected">مرفوض</option>
                </select>
                <select id="refundTypeFilter">
                    <option value="">كل الأنواع</option>
                    <option value="product">طلبات المنتجات</option>
                    <option value="digital">الطلبات الرقمية</option>
                </select>
            </div>

            <div class="admin-panel">
                <div class="panel-header">
                    <h2><i class="fas fa-rotate-left"></i> طلبات الاسترجاع (${refundRequests.length})</h2>
                </div>
                <div class="panel-body">
                    ${refundRequests.length === 0 ? `
                        <div class="empty-state" style="padding:28px;">
                            <i class="fas fa-inbox"></i>
                            <p>لا توجد طلبات استرجاع حالياً.</p>
                        </div>
                    ` : `
                        <div class="table-wrap">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>العميل</th>
                                        <th>الطلب</th>
                                        <th>المبلغ</th>
                                        <th>السبب</th>
                                        <th>الحالة</th>
                                        <th>التاريخ</th>
                                        <th>إجراءات</th>
                                    </tr>
                                </thead>
                                <tbody id="refundRequestsBody">
                                    ${refundRequests.map((request) => {
                                        const user = customers.find((customer) => (customer.authUserId || customer.id) === request.user_id);
                                        return `
                                            <tr data-refund-id="${request.id}" data-status="${request.status}" data-type="${request.order_type}">
                                                <td>
                                                    <strong>${TZ.escapeHtml(user?.fullName || `مستخدم ${String(request.user_id || '').slice(-6)}`)}</strong>
                                                    <br><small style="color:var(--text-muted)">${TZ.escapeHtml(user?.phone || user?.email || String(request.user_id || '-'))}</small>
                                                </td>
                                                <td>
                                                    <strong>${TZ.escapeHtml(orderTypeLabel(request.order_type))}</strong>
                                                    <br><small style="color:var(--text-muted)">#${TZ.escapeHtml(request.order_id || '-')}</small>
                                                </td>
                                                <td style="font-weight:800;color:var(--primary);">${money(request.amount)}</td>
                                                <td>
                                                    ${TZ.escapeHtml(request.reason || '-')}
                                                    ${request.admin_note ? `<br><small style="color:var(--text-muted)">ملاحظة الإدارة: ${TZ.escapeHtml(request.admin_note)}</small>` : ''}
                                                </td>
                                                <td>${statusBadge(request.status)}</td>
                                                <td>${new Date(request.created_at).toLocaleString('ar-JO')}</td>
                                                <td class="actions-cell">
                                                    ${request.status === 'pending' ? `
                                                        <button class="action-btn success approve-refund-btn" data-id="${request.id}" title="موافقة"><i class="fas fa-check"></i></button>
                                                        <button class="action-btn danger reject-refund-btn" data-id="${request.id}" title="رفض"><i class="fas fa-times"></i></button>
                                                    ` : '—'}
                                                </td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    `}
                </div>
            </div>
        `;

        bindRefundEvents(customers, refundRequests);
    }

    function bindRefundEvents(customers, refundRequests) {
        document.getElementById('refundRequestForm')?.addEventListener('submit', async function (event) {
            event.preventDefault();

            const userId = document.getElementById('refundUserId').value;
            const orderType = document.getElementById('refundOrderType').value;
            const orderId = document.getElementById('refundOrderId').value.trim();
            const amount = Number(document.getElementById('refundAmount').value || 0);
            const reason = document.getElementById('refundReason').value.trim();
            const submitButton = document.getElementById('createRefundRequestBtn');

            if (!userId || !orderId || !reason || amount <= 0) {
                A.showToast('يرجى تعبئة جميع بيانات طلب الاسترجاع.');
                return;
            }

            submitButton.disabled = true;
            submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الإنشاء...';

            const { error } = await TZ.supabase.from('refund_requests').insert([{
                user_id: userId,
                order_type: orderType,
                order_id: orderId,
                amount,
                reason,
                status: 'pending',
            }]);

            submitButton.disabled = false;
            submitButton.innerHTML = '<i class="fas fa-save"></i> إنشاء الطلب';

            if (error) {
                A.showToast('تعذر إنشاء طلب الاسترجاع.');
                return;
            }

            A.showToast('تم إنشاء طلب الاسترجاع بنجاح.');
            renderRefunds();
        });

        document.getElementById('refundStatusFilter')?.addEventListener('change', filterRows);
        document.getElementById('refundTypeFilter')?.addEventListener('change', filterRows);

        function filterRows() {
            const status = document.getElementById('refundStatusFilter').value;
            const type = document.getElementById('refundTypeFilter').value;
            document.querySelectorAll('#refundRequestsBody tr').forEach((row) => {
                const matchesStatus = !status || row.dataset.status === status;
                const matchesType = !type || row.dataset.type === type;
                row.style.display = matchesStatus && matchesType ? '' : 'none';
            });
        }

        document.querySelectorAll('.approve-refund-btn').forEach((button) => {
            button.addEventListener('click', async function () {
                const request = refundRequests.find((item) => item.id === this.dataset.id);
                if (!request) return;

                const adminNote = window.prompt('ملاحظة الموافقة (اختياري):', '');
                if (!window.confirm('هل تريد الموافقة على طلب الاسترجاع وإعادة الرصيد للمستخدم؟')) {
                    return;
                }

                const authUser = await TZ.getSupabaseUser();
                if (!authUser) {
                    A.showToast('تعذر تحديد المدير الحالي.');
                    return;
                }

                const rpcRes = await TZ.supabase.rpc('admin_adjust_wallet_balance', {
                    p_admin_user_id: authUser.id,
                    p_target_user_id: request.user_id,
                    p_amount: Number(request.amount),
                    p_reason: `موافقة على طلب استرجاع #${request.id}`,
                });

                if (rpcRes.error) {
                    A.showToast('فشل تعديل الرصيد للمستخدم.');
                    return;
                }

                if (request.order_type === 'digital') {
                    await TZ.supabase
                        .from('service_orders')
                        .update({ status: 'refunded', admin_note: adminNote || null, updated_at: TZ.nowIso() })
                        .eq('id', request.order_id);
                } else if (request.order_type === 'product') {
                    await TZ.supabase
                        .from('orders')
                        .update({ status: 'cancelled' })
                        .eq('id', request.order_id);
                }

                await TZ.supabase
                    .from('refund_requests')
                    .update({
                        status: 'approved',
                        admin_note: adminNote || null,
                        reviewed_by: authUser.id,
                        reviewed_at: TZ.nowIso(),
                    })
                    .eq('id', request.id);

                await TZ.supabase.from('notifications').insert([{
                    user_id: request.user_id,
                    title: 'تمت الموافقة على طلب الاسترجاع',
                    body: `تمت إعادة ${Number(request.amount || 0).toFixed(2)} د.أ إلى محفظتك.`,
                    type: 'success',
                    reference_type: 'refund_request',
                    reference_id: request.id,
                }]);

                A.showToast('تمت الموافقة على طلب الاسترجاع.');
                renderRefunds();
            });
        });

        document.querySelectorAll('.reject-refund-btn').forEach((button) => {
            button.addEventListener('click', async function () {
                const request = refundRequests.find((item) => item.id === this.dataset.id);
                if (!request) return;

                const adminNote = window.prompt('سبب الرفض (اختياري):', '');
                if (!window.confirm('هل تريد رفض طلب الاسترجاع؟')) {
                    return;
                }

                const authUser = await TZ.getSupabaseUser();
                if (!authUser) {
                    A.showToast('تعذر تحديد المدير الحالي.');
                    return;
                }

                const { error } = await TZ.supabase
                    .from('refund_requests')
                    .update({
                        status: 'rejected',
                        admin_note: adminNote || null,
                        reviewed_by: authUser.id,
                        reviewed_at: TZ.nowIso(),
                    })
                    .eq('id', request.id);

                if (error) {
                    A.showToast('تعذر تحديث حالة الطلب.');
                    return;
                }

                await TZ.supabase.from('notifications').insert([{
                    user_id: request.user_id,
                    title: 'تم رفض طلب الاسترجاع',
                    body: adminNote || 'يمكنك التواصل مع الإدارة لمراجعة التفاصيل.',
                    type: 'error',
                    reference_type: 'refund_request',
                    reference_id: request.id,
                }]);

                A.showToast('تم رفض طلب الاسترجاع.');
                renderRefunds();
            });
        });
    }

    A.sections.refunds = renderRefunds;
})();
