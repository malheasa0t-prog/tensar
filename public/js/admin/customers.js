// ===== TechZone Admin - Customers =====
(function () {
    'use strict';
    const A = window.AdminApp;

    // ===== CUSTOMERS =====
    function renderCustomers() {
        const customers = TZ.db.users.filter((u) => TZ.isCustomerUser(u));
        A.adminContent.innerHTML = `
                            <div class="admin-panel">
                                <div class="panel-header"><h2><i class="fas fa-users"></i> العملاء (${customers.length})</h2></div>
                                <div class="panel-body">
                                    <div class="table-wrap">
                                        <table class="data-table">
                                            <thead><tr><th>الاسم</th><th>البريد</th><th>الجوال</th><th>الطلبات</th><th>الحالة</th></tr></thead>
                                            <tbody>
                                                ${customers.map(c => {
            const orderCount = TZ.db.orders.filter(o => o.userId === c.id).length;
            return `<tr>
                                    <td><strong>${TZ.escapeHtml(c.fullName)}</strong></td>
                                    <td>${TZ.escapeHtml(c.email || '-')}</td>
                                    <td dir="ltr">${TZ.escapeHtml(c.phone)}</td>
                                    <td>${orderCount}</td>
                                    <td><span class="status-badge ${c.status}">${c.status === 'active' ? 'نشط' : 'معطل'}</span></td>
                                </tr>`;
        }).join('')}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                            `;
    }

    A.sections.customers = renderCustomers;
})();
