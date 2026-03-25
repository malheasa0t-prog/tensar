// ===== TechZone Admin - Dashboard =====
(function () {
    'use strict';
    const A = window.AdminApp;

    // ===== DASHBOARD =====
    function renderDashboard() {
        const db = TZ.db;
        const totalProducts = db.products.length;
        const totalOrders = db.orders.length + (db.serviceOrders || []).length + db.repairBookings.length;
        const totalRevenue =
            db.orders.reduce((s, o) => s + (o.total || 0), 0) +
            (db.serviceOrders || []).reduce((s, o) => s + (o.total || 0), 0);
        const totalCustomers = db.users.filter((u) => TZ.isCustomerUser(u)).length;
        const pendingOrders =
            db.orders.filter(o => o.status === 'awaiting_delivery' || o.status === 'awaiting_device').length +
            (db.serviceOrders || []).filter((o) => ['pending', 'processing', 'in_progress'].includes(o.status)).length +
            db.repairBookings.filter((o) => ['pending', 'awaiting_delivery', 'awaiting_device'].includes(o.status)).length;
        const lowStock = db.products.filter(p => p.quantity > 0 && p.quantity <= (p.lowStockAlert || 5)).length;
        const outOfStock = db.products.filter(p => p.quantity <= 0).length;
        const totalCategories = db.categories.length;

        const recentOrders = TZ.clone(db.orders).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
        const topProducts = TZ.clone(db.products).sort((a, b) => b.sold - a.sold).slice(0, 5);

        A.adminContent.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card-admin">
                    <div class="stat-icon blue"><i class="fas fa-shopping-bag"></i></div>
                    <div class="stat-info"><h3>${totalOrders}</h3><p>إجمالي الطلبات</p></div>
                </div>
                <div class="stat-card-admin">
                    <div class="stat-icon green"><i class="fas fa-money-bill-wave"></i></div>
                    <div class="stat-info"><h3>${TZ.formatPrice(totalRevenue)}</h3><p>إجمالي الإيرادات</p></div>
                </div>
                <div class="stat-card-admin">
                    <div class="stat-icon orange"><i class="fas fa-box"></i></div>
                    <div class="stat-info"><h3>${totalProducts}</h3><p>المنتجات</p></div>
                </div>
                <div class="stat-card-admin">
                    <div class="stat-icon purple"><i class="fas fa-users"></i></div>
                    <div class="stat-info"><h3>${totalCustomers}</h3><p>العملاء</p></div>
                </div>
            </div>

            <div class="quick-stats-row">
                <div class="quick-stat"><div class="value">${pendingOrders}</div><div class="label">طلبات جديدة</div></div>
                <div class="quick-stat"><div class="value">${lowStock}</div><div class="label">مخزون منخفض</div></div>
                <div class="quick-stat"><div class="value">${outOfStock}</div><div class="label">نفذ من المخزون</div></div>
                <div class="quick-stat"><div class="value">${totalCategories}</div><div class="label">الفئات</div></div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
                <div class="admin-panel">
                    <div class="panel-header"><h2><i class="fas fa-clock"></i> آخر الطلبات</h2></div>
                    <div class="panel-body">
                        <div class="table-wrap">
                        <table class="data-table">
                            <thead><tr><th>#</th><th>العميل</th><th>المبلغ</th><th>الحالة</th><th>التاريخ</th></tr></thead>
                            <tbody>
                                ${recentOrders.map(o => {
            const user = o.customerName ? { fullName: o.customerName } : TZ.getUserById(o.userId);
            return `<tr>
                                        <td>${o.id}</td>
                                        <td>${user ? TZ.escapeHtml(user.fullName) : '-'}</td>
                                        <td>${TZ.formatPrice(o.total)}</td>
                                        <td><span class="status-badge ${o.status}">${A.statusLabel(o.status)}</span></td>
                                        <td>${A.formatDate(o.createdAt)}</td>
                                    </tr>`;
        }).join('')}
                            </tbody>
                        </table>
                        </div>
                    </div>
                </div>
                <div class="admin-panel">
                    <div class="panel-header"><h2><i class="fas fa-fire"></i> المنتجات الأكثر مبيعاً</h2></div>
                    <div class="panel-body">
                        <div class="table-wrap">
                        <table class="data-table">
                            <thead><tr><th>المنتج</th><th>الفئة</th><th>المبيعات</th><th>المخزون</th></tr></thead>
                            <tbody>
                                ${topProducts.map(p => `<tr>
                                    <td>${TZ.escapeHtml(p.name)}</td>
                                    <td>${TZ.getCategoryName(p.categoryId)}</td>
                                    <td>${p.sold}</td>
                                    <td><span class="status-badge ${p.quantity > 5 ? 'active' : p.quantity > 0 ? 'pending' : 'hidden'}">${p.quantity}</span></td>
                                </tr>`).join('')}
                            </tbody>
                        </table>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    A.sections.dashboard = renderDashboard;
})();
