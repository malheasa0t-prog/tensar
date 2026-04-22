/**
 * TechZone Admin — Customers Section (Rebuilt)
 *
 * Displays customer profiles with order stats, search, and status management.
 * Uses mapper property names: authUserId, fullName, email, phone, role, status.
 */
(function () {
    'use strict';

    var A = window.AdminApp;
    if (!A) return;

    var searchQuery = '';
    var filterStatus = '';
    var currentPage = 1;
    var PAGE_SIZE = 15;

    function esc(v) { return TZ.escapeHtml(v == null ? '' : String(v)); }

    function getCustomers() {
        return (TZ.db.users || []).filter(function (u) {
            return typeof TZ.isCustomerUser === 'function' ? TZ.isCustomerUser(u) : true;
        });
    }

    function enrichCustomer(u) {
        var orders = (TZ.db.orders || []).filter(function (o) {
            return o.userId === u.id || o.userId === u.authUserId;
        });
        var totalSpend = orders.reduce(function (sum, o) { return sum + Number(o.total || 0); }, 0);
        return { user: u, orderCount: orders.length, totalSpend: totalSpend };
    }

    function applyFilters(list) {
        var result = list;
        if (filterStatus) {
            result = result.filter(function (c) { return c.user.status === filterStatus; });
        }
        if (searchQuery) {
            var q = searchQuery.toLowerCase();
            result = result.filter(function (c) {
                var u = c.user;
                return (u.fullName || '').toLowerCase().includes(q)
                    || (u.email || '').toLowerCase().includes(q)
                    || (u.phone || '').toLowerCase().includes(q);
            });
        }
        return result;
    }

    function paginate(list) {
        var s = (currentPage - 1) * PAGE_SIZE;
        return { items: list.slice(s, s + PAGE_SIZE), total: list.length, pages: Math.ceil(list.length / PAGE_SIZE) || 1 };
    }

    async function toggleCustomerStatus(userId, currentStatus) {
        var newStatus = currentStatus === 'active' ? 'inactive' : 'active';
        var result = await TZ.supabase.from('user_profiles').update({
            status: newStatus, updated_at: new Date().toISOString()
        }).eq('user_id', userId);
        if (result.error) { A.showErrorToast('CUS-301', 'فشل تحديث حالة العميل'); return; }
        A.showToast('تم تحديث حالة العميل');
        await TZ.refreshData();
        renderCustomers();
    }

    function renderCustomers() {
        var customers = getCustomers().map(enrichCustomer);
        var filtered = applyFilters(customers);
        var page = paginate(filtered);

        var html = '<div class="admin-section-header"><div><h2><i class="fas fa-users"></i> العملاء</h2><p>' + customers.length + ' عميل</p></div></div>';

        html += '<div class="filter-bar">'
            + '<input type="search" id="custSearch" placeholder="ابحث بالاسم أو البريد أو الهاتف..." value="' + esc(searchQuery) + '">'
            + '<select id="custStatusFilter"><option value="">كل الحالات</option>'
            + '<option value="active"' + (filterStatus === 'active' ? ' selected' : '') + '>نشط</option>'
            + '<option value="inactive"' + (filterStatus === 'inactive' ? ' selected' : '') + '>معطل</option>'
            + '</select></div>';

        html += '<div class="admin-panel"><div class="panel-body"><div class="table-wrap"><table class="data-table"><thead><tr>'
            + '<th>العميل</th><th>البريد</th><th>الهاتف</th><th>الطلبات</th><th>الإنفاق</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody>';

        if (page.items.length === 0) {
            html += '<tr><td colspan="7"><div class="empty-state"><i class="fas fa-users"></i><p>لا يوجد عملاء</p></div></td></tr>';
        } else {
            page.items.forEach(function (c) {
                var u = c.user;
                var uid = u.authUserId || u.id;
                html += '<tr>'
                    + '<td><strong>' + esc(u.fullName) + '</strong></td>'
                    + '<td><small>' + esc(u.email || '-') + '</small></td>'
                    + '<td><small>' + esc(u.phone || '-') + '</small></td>'
                    + '<td>' + c.orderCount + '</td>'
                    + '<td style="font-weight:600;color:#00b894;">' + TZ.formatPrice(c.totalSpend) + '</td>'
                    + '<td><span class="status-badge ' + (u.status || 'active') + '">' + (u.status === 'inactive' ? 'معطل' : 'نشط') + '</span></td>'
                    + '<td class="actions-cell">'
                    + '<button class="action-btn toggle-cust-btn" data-uid="' + uid + '" data-status="' + (u.status || 'active') + '" title="' + (u.status === 'active' ? 'تعطيل' : 'تفعيل') + '"><i class="fas fa-' + (u.status === 'active' ? 'ban' : 'check') + '"></i></button>'
                    + '<button class="action-btn notify-cust-btn" data-uid="' + uid + '" data-name="' + esc(u.fullName) + '" title="إرسال إشعار"><i class="fas fa-bell"></i></button>'
                    + '</td></tr>';
            });
        }
        html += '</tbody></table></div></div>';

        if (page.pages > 1) {
            html += '<div class="admin-table-pagination"><div class="admin-table-pagination-info">عرض ' + page.items.length + ' من ' + page.total + '</div>';
            html += '<div class="admin-table-pagination-controls">';
            for (var i = 1; i <= page.pages; i++) {
                html += '<button data-page="' + i + '" class="' + (i === currentPage ? 'active' : '') + '">' + i + '</button>';
            }
            html += '</div></div>';
        }
        html += '</div>';

        A.adminContent.innerHTML = html;

        document.getElementById('custSearch')?.addEventListener('input', function () { searchQuery = this.value; currentPage = 1; renderCustomers(); });
        document.getElementById('custStatusFilter')?.addEventListener('change', function () { filterStatus = this.value; currentPage = 1; renderCustomers(); });
        document.querySelectorAll('[data-page]').forEach(function (b) {
            b.addEventListener('click', function () { currentPage = parseInt(b.dataset.page, 10); renderCustomers(); });
        });
        document.querySelectorAll('.toggle-cust-btn').forEach(function (b) {
            b.addEventListener('click', function () { toggleCustomerStatus(b.dataset.uid, b.dataset.status); });
        });
        document.querySelectorAll('.notify-cust-btn').forEach(function (b) {
            b.addEventListener('click', function () {
                window.__TZ_ADMIN_NOTIFICATION_PREFILL = { userId: b.dataset.uid, title: 'رسالة إلى ' + b.dataset.name };
                A.renderSection('notifications', { history: 'push' });
            });
        });
    }

    A.sections.customers = renderCustomers;
})();
