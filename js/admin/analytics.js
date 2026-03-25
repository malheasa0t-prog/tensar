// ===== TechZone Admin - Analytics =====
(function () {
    'use strict';

    const A = window.AdminApp;

    function money(value) {
        return TZ.formatPrice(Number(value || 0));
    }

    function monthKey(value) {
        const date = new Date(value || Date.now());
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }

    function monthLabel(key) {
        const [year, month] = String(key || '').split('-').map(Number);
        if (!year || !month) return key || '-';
        return new Date(year, month - 1, 1).toLocaleDateString('ar-JO', {
            month: 'short',
            year: 'numeric',
        });
    }

    function orderStatusLabel(status) {
        return A.statusLabel ? A.statusLabel(status) : (status || '-');
    }

    function buildBarRows(rows, formatter = (value) => String(value)) {
        if (!rows.length) {
            return '<div class="empty-state" style="padding:18px;"><i class="fas fa-chart-bar"></i><p>لا توجد بيانات كافية بعد.</p></div>';
        }

        const maxValue = Math.max(...rows.map((row) => Number(row.value || 0)), 1);
        return rows.map((row) => `
            <div style="display:grid;gap:6px;">
                <div style="display:flex;justify-content:space-between;gap:12px;font-size:.9rem;">
                    <strong>${TZ.escapeHtml(row.label)}</strong>
                    <span style="color:var(--text-muted)">${formatter(row.value)}</span>
                </div>
                <div style="height:10px;border-radius:999px;background:rgba(255,255,255,.06);overflow:hidden;">
                    <div style="width:${Math.max((Number(row.value || 0) / maxValue) * 100, 4)}%;height:100%;border-radius:inherit;background:${row.color || 'linear-gradient(90deg, var(--primary), #00d2ff)'};"></div>
                </div>
            </div>
        `).join('');
    }

    function renderAnalytics() {
        const customers = TZ.db.users.filter((user) => TZ.isCustomerUser(user));
        const productOrders = TZ.db.orders || [];
        const digitalOrders = TZ.db.serviceOrders || [];
        const repairBookings = TZ.db.repairBookings || [];
        const deposits = TZ.db.deposits || [];
        const products = TZ.db.products || [];
        const categories = TZ.db.categories || [];

        const productRevenue = productOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
        const digitalRevenue = digitalOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
        const totalRevenue = productRevenue + digitalRevenue;
        const totalOrders = productOrders.length + digitalOrders.length + repairBookings.length;
        const pendingDeposits = deposits.filter((deposit) => deposit.status === 'pending').length;
        const activeCoupons = (TZ.db.coupons || []).filter((coupon) => coupon.status === 'active').length;
        const lowStockProducts = products.filter((product) => Number(product.quantity || 0) <= Number(product.lowStockAlert || 0)).length;

        const statusSummary = new Map();
        [...productOrders, ...digitalOrders].forEach((order) => {
            const key = order.status || 'unknown';
            statusSummary.set(key, (statusSummary.get(key) || 0) + 1);
        });

        const categorySummary = new Map();
        categories.forEach((category) => {
            categorySummary.set(category.id, {
                label: category.parentId
                    ? `${TZ.getCategoryName(category.parentId)} / ${category.name}`
                    : category.name,
                value: 0,
                color: category.parentId ? 'linear-gradient(90deg, #00b894, #55efc4)' : 'linear-gradient(90deg, #6c5ce7, #00d2ff)',
            });
        });
        products.forEach((product) => {
            const entry = categorySummary.get(product.categoryId);
            if (entry) entry.value += 1;
        });

        const customerSpend = new Map();
        [...productOrders, ...digitalOrders].forEach((order) => {
            const userId = order.userId || order.user_id;
            if (!userId) return;
            customerSpend.set(userId, (customerSpend.get(userId) || 0) + Number(order.total || 0));
        });

        const monthlyRevenueMap = new Map();
        [...productOrders, ...digitalOrders].forEach((order) => {
            const key = monthKey(order.createdAt || order.created_at);
            monthlyRevenueMap.set(key, (monthlyRevenueMap.get(key) || 0) + Number(order.total || 0));
        });

        const monthlyRevenue = Array.from(monthlyRevenueMap.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .slice(-6)
            .map(([key, value]) => ({
                label: monthLabel(key),
                value,
                color: 'linear-gradient(90deg, #6c5ce7, #00d2ff)',
            }));

        const typeRows = [
            { label: 'طلبات المنتجات', value: productOrders.length, color: 'linear-gradient(90deg, #0984e3, #74b9ff)' },
            { label: 'الطلبات الرقمية', value: digitalOrders.length, color: 'linear-gradient(90deg, #6c5ce7, #a29bfe)' },
            { label: 'طلبات الصيانة', value: repairBookings.length, color: 'linear-gradient(90deg, #00b894, #55efc4)' },
        ];

        const statusRows = Array.from(statusSummary.entries())
            .map(([status, value]) => ({
                label: orderStatusLabel(status),
                value,
                color: 'linear-gradient(90deg, #fdcb6e, #e17055)',
            }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 6);

        const categoryRows = Array.from(categorySummary.values())
            .filter((row) => row.value > 0)
            .sort((a, b) => b.value - a.value)
            .slice(0, 6);

        const topCustomerRows = Array.from(customerSpend.entries())
            .map(([userId, value]) => {
                const user = customers.find((item) => item.id === userId || item.authUserId === userId);
                return {
                    label: user?.fullName || `عميل ${String(userId).slice(-6)}`,
                    value,
                    color: 'linear-gradient(90deg, #00cec9, #81ecec)',
                };
            })
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);

        A.adminContent.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card-admin">
                    <div class="stat-icon green"><i class="fas fa-money-bill-wave"></i></div>
                    <div class="stat-info"><h3>${money(totalRevenue)}</h3><p>إجمالي الإيرادات</p></div>
                </div>
                <div class="stat-card-admin">
                    <div class="stat-icon blue"><i class="fas fa-bag-shopping"></i></div>
                    <div class="stat-info"><h3>${totalOrders}</h3><p>إجمالي الطلبات</p></div>
                </div>
                <div class="stat-card-admin">
                    <div class="stat-icon purple"><i class="fas fa-users"></i></div>
                    <div class="stat-info"><h3>${customers.length}</h3><p>إجمالي العملاء</p></div>
                </div>
                <div class="stat-card-admin">
                    <div class="stat-icon orange"><i class="fas fa-box-open"></i></div>
                    <div class="stat-info"><h3>${lowStockProducts}</h3><p>منتجات منخفضة المخزون</p></div>
                </div>
            </div>

            <div class="quick-stats-row">
                <div class="quick-stat"><div class="value">${money(productRevenue)}</div><div class="label">مبيعات المنتجات</div></div>
                <div class="quick-stat"><div class="value">${money(digitalRevenue)}</div><div class="label">مبيعات الخدمات الرقمية</div></div>
                <div class="quick-stat"><div class="value">${pendingDeposits}</div><div class="label">إيداعات بانتظار المراجعة</div></div>
                <div class="quick-stat"><div class="value">${activeCoupons}</div><div class="label">كوبونات نشطة</div></div>
            </div>

            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:20px;">
                <div class="admin-panel">
                    <div class="panel-header"><h2><i class="fas fa-layer-group"></i> توزيع الطلبات حسب النوع</h2></div>
                    <div class="panel-body" style="display:grid;gap:12px;">
                        ${buildBarRows(typeRows)}
                    </div>
                </div>

                <div class="admin-panel">
                    <div class="panel-header"><h2><i class="fas fa-signal"></i> أكثر حالات الطلبات تكراراً</h2></div>
                    <div class="panel-body" style="display:grid;gap:12px;">
                        ${buildBarRows(statusRows)}
                    </div>
                </div>

                <div class="admin-panel">
                    <div class="panel-header"><h2><i class="fas fa-tags"></i> الفئات الأكثر احتواءً على المنتجات</h2></div>
                    <div class="panel-body" style="display:grid;gap:12px;">
                        ${buildBarRows(categoryRows, (value) => `${value} منتج`)}
                    </div>
                </div>

                <div class="admin-panel">
                    <div class="panel-header"><h2><i class="fas fa-user-tie"></i> أعلى العملاء إنفاقاً</h2></div>
                    <div class="panel-body" style="display:grid;gap:12px;">
                        ${buildBarRows(topCustomerRows, (value) => money(value))}
                    </div>
                </div>

                <div class="admin-panel" style="grid-column:1 / -1;">
                    <div class="panel-header"><h2><i class="fas fa-chart-column"></i> الإيرادات خلال آخر 6 أشهر متاحة</h2></div>
                    <div class="panel-body" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:14px;align-items:end;min-height:240px;">
                        ${monthlyRevenue.length === 0 ? `
                            <div class="empty-state" style="grid-column:1 / -1;padding:30px;">
                                <i class="fas fa-chart-area"></i>
                                <p>ستظهر حركة الإيرادات هنا عند توفر بيانات زمنية كافية.</p>
                            </div>
                        ` : (() => {
                            const maxValue = Math.max(...monthlyRevenue.map((row) => Number(row.value || 0)), 1);
                            return monthlyRevenue.map((row) => `
                                <div style="display:grid;gap:10px;text-align:center;">
                                    <div style="font-size:.85rem;color:var(--text-muted)">${money(row.value)}</div>
                                    <div style="height:160px;border-radius:20px;background:rgba(255,255,255,.05);display:flex;align-items:flex-end;overflow:hidden;">
                                        <div style="width:100%;height:${Math.max((Number(row.value || 0) / maxValue) * 100, 6)}%;background:${row.color};border-radius:20px 20px 0 0;"></div>
                                    </div>
                                    <strong style="font-size:.9rem;">${TZ.escapeHtml(row.label)}</strong>
                                </div>
                            `).join('');
                        })()}
                    </div>
                </div>
            </div>
        `;
    }

    A.sections.analytics = renderAnalytics;
})();
