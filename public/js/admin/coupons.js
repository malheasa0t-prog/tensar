// ===== TechZone Admin - Coupons =====
(function () {
    'use strict';
    const A = window.AdminApp;

    // ===== COUPONS =====
    function renderCoupons() {
        const coupons = TZ.db.coupons;
        A.adminContent.innerHTML = `
                            <div class="admin-panel">
                                <div class="panel-header">
                                    <h2><i class="fas fa-percent"></i> الكوبونات (${coupons.length})</h2>
                                    <button class="btn btn-primary btn-sm" id="addCouponBtn"><i class="fas fa-plus"></i> إضافة كوبون</button>
                                </div>
                                <div class="panel-body">
                                    <div class="table-wrap">
                                        <table class="data-table">
                                            <thead><tr><th>الكود</th><th>النوع</th><th>القيمة</th><th>الحد الأدنى</th><th>الاستخدام</th><th>الحالة</th><th>انتهاء</th><th>إجراءات</th></tr></thead>
                                            <tbody>
                                                ${coupons.map(c => `<tr>
                                <td><strong style="font-family:monospace;color:var(--primary);">${TZ.escapeHtml(c.code)}</strong></td>
                                <td>${c.type === 'percentage' ? 'نسبة مئوية' : 'مبلغ ثابت'}</td>
                                <td>${c.type === 'percentage' ? c.value + '%' : TZ.formatPrice(c.value)}</td>
                                <td>${TZ.formatPrice(c.minOrder)}</td>
                                <td>${c.usedCount} / ${c.maxUses}</td>
                                <td><span class="status-badge ${c.status}">${c.status === 'active' ? 'نشط' : 'معطل'}</span></td>
                                <td>${A.formatDate(c.expiresAt)}</td>
                                <td class="actions-cell">
                                    <button class="action-btn danger delete-coupon-btn" data-id="${c.id}" title="حذف"><i class="fas fa-trash"></i></button>
                                </td>
                            </tr>`).join('')}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>

                            <div class="admin-panel" id="couponFormPanel" style="display:none;">
                                <div class="panel-header"><h2><i class="fas fa-plus"></i> إضافة كوبون</h2></div>
                                <div class="panel-body padded">
                                    <form class="admin-form" id="couponForm">
                                        <div class="form-grid">
                                            <div class="admin-form-group">
                                                <label>كود الكوبون *</label>
                                                <div class="admin-input-wrap"><i class="fas fa-ticket-alt"></i><input type="text" id="cpnCode" required style="text-transform:uppercase;font-family:monospace;"></div>
                                            </div>
                                            <div class="admin-form-group">
                                                <label>النوع</label>
                                                <select id="cpnType"><option value="percentage">نسبة مئوية</option><option value="fixed">مبلغ ثابت</option></select>
                                            </div>
                                            <div class="admin-form-group">
                                                <label>القيمة *</label>
                                                <div class="admin-input-wrap"><i class="fas fa-percent"></i><input type="number" id="cpnValue" min="0" required></div>
                                            </div>
                                            <div class="admin-form-group">
                                                <label>الحد الأدنى للطلب</label>
                                                <div class="admin-input-wrap"><i class="fas fa-money-bill"></i><input type="number" id="cpnMinOrder" min="0" value="0"></div>
                                            </div>
                                            <div class="admin-form-group">
                                                <label>الحد الأقصى للاستخدام</label>
                                                <div class="admin-input-wrap"><i class="fas fa-users"></i><input type="number" id="cpnMaxUses" min="1" value="100"></div>
                                            </div>
                                            <div class="admin-form-group">
                                                <label>تاريخ الانتهاء</label>
                                                <div class="admin-input-wrap"><i class="fas fa-calendar"></i><input type="date" id="cpnExpiry"></div>
                                            </div>
                                        </div>
                                        <div style="margin-top:15px;display:flex;gap:10px;">
                                            <button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> حفظ</button>
                                            <button type="button" class="btn btn-outline" id="cancelCouponBtn">إلغاء</button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                            `;

        document.getElementById('addCouponBtn').addEventListener('click', function () {
            document.getElementById('couponFormPanel').style.display = 'block';
            document.getElementById('couponFormPanel').scrollIntoView({ behavior: 'smooth' });
        });
        document.getElementById('cancelCouponBtn').addEventListener('click', function () {
            document.getElementById('couponFormPanel').style.display = 'none';
        });
        document.querySelectorAll('.delete-coupon-btn').forEach(btn => {
            btn.addEventListener('click', function () {
                const id = this.dataset.id;
                const cpn = TZ.db.coupons.find(c => c.id === id);
                if (!cpn) return;
                A.showConfirmModal('حذف الكوبون', `هل أنت متأكد من حذف الكوبون "${TZ.escapeHtml(cpn.code)}"؟`, () => {
                    const backup = TZ.clone(cpn);
                    TZ.db.coupons = TZ.db.coupons.filter(c => c.id !== id);
                    renderCoupons();
                    A.showUndoToast('تم حذف الكوبون', () => {
                        TZ.db.coupons.push(backup);
                        renderCoupons();
                        A.showToast('تم استعادة الكوبون');
                    }, () => {
                        TZ.commitDb('coupon_delete', TZ.getSession()?.userId, cpn.code, { type: 'coupon_delete', data: { id: id } });
                    });
                });
            });
        });
        document.getElementById('couponForm').addEventListener('submit', function (e) {
            e.preventDefault();
            const cpn = {
                id: TZ.generateId('cpn'),
                code: document.getElementById('cpnCode').value.trim().toUpperCase(),
                type: document.getElementById('cpnType').value,
                value: parseFloat(document.getElementById('cpnValue').value) || 0,
                minOrder: parseFloat(document.getElementById('cpnMinOrder').value) || 0,
                maxUses: parseInt(document.getElementById('cpnMaxUses').value) || 100,
                usedCount: 0,
                status: 'active',
                expiresAt: document.getElementById('cpnExpiry').value ? new Date(document.getElementById('cpnExpiry').value).toISOString() : new Date(Date.now() + 30 * 86400000).toISOString(),
                createdAt: TZ.nowIso()
            };
            TZ.db.coupons.push(cpn);
            TZ.commitDb('coupon_create', TZ.getSession()?.userId, cpn.code, { type: 'coupon', data: cpn });
            renderCoupons();
            A.showToast('تم إضافة الكوبون');
        });
    }

    A.sections.coupons = renderCoupons;
})();
