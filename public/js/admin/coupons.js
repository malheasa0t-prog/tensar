/**
 * TechZone Admin — Coupons Section (Rebuilt)
 *
 * CRUD for discount coupons via Supabase.
 */
(function () {
    'use strict';

    var A = window.AdminApp;
    if (!A) return;

    function esc(v) { return TZ.escapeHtml(v == null ? '' : String(v)); }

    async function deleteCoupon(id) {
        if (!confirm('هل أنت متأكد من حذف هذا الكوبون؟')) return;
        var result = await TZ.supabase.from('coupons').delete().eq('id', id);
        if (result.error) { A.showErrorToast('CPN-301', 'فشل حذف الكوبون'); return; }
        A.showToast('تم حذف الكوبون');
        await TZ.refreshData();
        renderCoupons();
    }

    async function createCoupon(data) {
        var result = await TZ.supabase.from('coupons').insert([{
            code: data.code,
            type: data.type,
            value: Number(data.value),
            min_order: Number(data.minOrder) || 0,
            max_uses: Number(data.maxUses) || 100,
            used_count: 0,
            status: 'active',
            expires_at: data.expiresAt || new Date(Date.now() + 30 * 86400000).toISOString()
        }]);
        if (result.error) { A.showErrorToast('CPN-302', 'فشل إضافة الكوبون: ' + (result.error.message || '')); return false; }
        A.showToast('تم إضافة الكوبون بنجاح');
        return true;
    }

    function renderCoupons() {
        var coupons = TZ.db.coupons || [];

        var totalRedemptions = coupons.reduce(function (sum, c) { return sum + (Number(c.used_count || c.usedCount) || 0); }, 0);
        var activeCount = coupons.filter(function (c) { return (c.status || 'active') === 'active'; }).length;
        var exhaustedCount = coupons.filter(function (c) {
            var maxU = Number(c.max_uses || c.maxUses);
            return maxU > 0 && (Number(c.used_count || c.usedCount) || 0) >= maxU;
        }).length;

        var html = '<div class="admin-section-header"><div><h2><i class="fas fa-percent"></i> الكوبونات والخصومات</h2>'
            + '<p>' + coupons.length + ' كوبون · ' + activeCount + ' نشط · ' + totalRedemptions + ' مرة استخدام'
            + (exhaustedCount > 0 ? ' · ' + exhaustedCount + ' مستنفد' : '') + '</p></div>'
            + '<div class="admin-section-actions"><button class="btn btn-primary btn-sm" id="addCouponBtn"><i class="fas fa-plus"></i> إضافة كوبون</button></div></div>';

        html += '<div class="admin-panel"><div class="panel-body"><div class="table-wrap"><table class="data-table"><thead><tr>'
            + '<th>الكود</th><th>النوع</th><th>القيمة</th><th>الحد الأدنى</th><th>الاستخدام</th><th>الحالة</th><th>الانتهاء</th><th>إجراءات</th></tr></thead><tbody>';

        if (coupons.length === 0) {
            html += '<tr><td colspan="8"><div class="empty-state"><i class="fas fa-percent"></i><p>لا توجد كوبونات</p></div></td></tr>';
        } else {
            coupons.forEach(function (c) {
                var typeLabel = c.type === 'percentage' ? 'نسبة مئوية' : 'مبلغ ثابت';
                var valueLabel = c.type === 'percentage' ? c.value + '%' : TZ.formatPrice(c.value);
                var statusBadge = '<span class="status-badge ' + (c.status || 'active') + '">' + (c.status === 'active' ? 'نشط' : c.status === 'expired' ? 'منتهي' : 'معطل') + '</span>';
                var expiry = c.expires_at || c.expiresAt;
                var expiryDate = expiry ? new Date(expiry).toLocaleDateString('ar-JO') : '-';
                var usedCount = Number(c.used_count || c.usedCount) || 0;
                var maxUses = Number(c.max_uses || c.maxUses) || 0;
                var usagePct = maxUses > 0 ? Math.min(100, Math.round((usedCount / maxUses) * 100)) : 0;
                var usageBarColor = usagePct >= 100 ? '#e74c3c' : usagePct >= 80 ? '#fdcb6e' : '#00b894';
                var usageCell = '<div style="font-weight:600;margin-bottom:3px;">' + usedCount + ' / ' + (maxUses > 0 ? maxUses : '∞') + '</div>'
                    + (maxUses > 0
                        ? '<div style="height:5px;border-radius:3px;background:rgba(0,0,0,0.12);overflow:hidden;"><div style="height:100%;width:' + usagePct + '%;background:' + usageBarColor + ';"></div></div>'
                        : '');

                html += '<tr>'
                    + '<td><strong style="font-family:monospace;color:var(--primary-light);">' + esc(c.code) + '</strong></td>'
                    + '<td>' + typeLabel + '</td>'
                    + '<td style="font-weight:600;">' + valueLabel + '</td>'
                    + '<td>' + TZ.formatPrice(c.min_order || c.minOrder || 0) + '</td>'
                    + '<td style="min-width:90px;">' + usageCell + '</td>'
                    + '<td>' + statusBadge + '</td>'
                    + '<td><small>' + expiryDate + '</small></td>'
                    + '<td class="actions-cell"><button class="action-btn danger del-cpn-btn" data-id="' + c.id + '" title="حذف"><i class="fas fa-trash"></i></button></td>'
                    + '</tr>';
            });
        }
        html += '</tbody></table></div></div></div>';

        /* ── Add Coupon Form (hidden) ── */
        html += '<div class="admin-panel" id="couponFormPanel" style="display:none;"><div class="panel-header"><h2><i class="fas fa-plus"></i> إضافة كوبون جديد</h2></div><div class="panel-body padded">'
            + '<form class="admin-form" id="couponForm"><div class="form-grid">'
            + '<div class="admin-form-group"><label>كود الكوبون *</label><div class="admin-input-wrap"><i class="fas fa-ticket-alt"></i><input type="text" id="cpnCode" required style="text-transform:uppercase;font-family:monospace;"></div></div>'
            + '<div class="admin-form-group"><label>النوع</label><select id="cpnType"><option value="percentage">نسبة مئوية</option><option value="fixed">مبلغ ثابت</option></select></div>'
            + '<div class="admin-form-group"><label>القيمة *</label><div class="admin-input-wrap"><i class="fas fa-coins"></i><input type="number" id="cpnValue" min="0" step="0.01" required></div></div>'
            + '<div class="admin-form-group"><label>الحد الأدنى للطلب</label><div class="admin-input-wrap"><i class="fas fa-money-bill"></i><input type="number" id="cpnMinOrder" min="0" value="0"></div></div>'
            + '<div class="admin-form-group"><label>الحد الأقصى للاستخدام</label><div class="admin-input-wrap"><i class="fas fa-users"></i><input type="number" id="cpnMaxUses" min="1" value="100"></div></div>'
            + '<div class="admin-form-group"><label>تاريخ الانتهاء</label><div class="admin-input-wrap"><i class="fas fa-calendar"></i><input type="date" id="cpnExpiry"></div></div>'
            + '</div>'
            + '<div class="admin-form-actions"><button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> حفظ الكوبون</button><button type="button" class="btn btn-outline" id="cancelCpnBtn">إلغاء</button></div>'
            + '</form></div></div>';

        A.adminContent.innerHTML = html;

        document.getElementById('addCouponBtn')?.addEventListener('click', function () {
            var panel = document.getElementById('couponFormPanel');
            panel.style.display = 'block';
            panel.scrollIntoView({ behavior: 'smooth' });
        });
        document.getElementById('cancelCpnBtn')?.addEventListener('click', function () {
            document.getElementById('couponFormPanel').style.display = 'none';
        });
        document.getElementById('couponForm')?.addEventListener('submit', async function (e) {
            e.preventDefault();
            var expVal = document.getElementById('cpnExpiry').value;
            var ok = await createCoupon({
                code: document.getElementById('cpnCode').value.trim().toUpperCase(),
                type: document.getElementById('cpnType').value,
                value: document.getElementById('cpnValue').value,
                minOrder: document.getElementById('cpnMinOrder').value,
                maxUses: document.getElementById('cpnMaxUses').value,
                expiresAt: expVal ? new Date(expVal).toISOString() : null
            });
            if (ok) { await TZ.refreshData(); renderCoupons(); }
        });
        document.querySelectorAll('.del-cpn-btn').forEach(function (b) { b.addEventListener('click', function () { deleteCoupon(b.dataset.id); }); });
    }

    A.sections.coupons = renderCoupons;
})();
