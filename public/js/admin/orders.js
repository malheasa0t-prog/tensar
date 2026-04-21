/**
 * TechZone Admin — Orders Section (Rebuilt)
 *
 * Manages physical orders, accessory orders, repair bookings, and digital service orders.
 * Uses a tab-based UI with filters, search, status changes, and detail slide-over.
 * All operations go directly through TZ.supabase.
 */
(function () {
    'use strict';

    var A = window.AdminApp;
    if (!A) return;

    var TAB_CONFIG = [
        { key: 'physical',  label: 'طلبات المنتجات',    icon: 'fa-box',                table: 'orders' },
        { key: 'accessory', label: 'طلبات الإكسسوارات', icon: 'fa-headphones',         table: 'orders' },
        { key: 'repair',    label: 'حجوزات الصيانة',     icon: 'fa-screwdriver-wrench', table: 'repair_bookings' },
        { key: 'digital',   label: 'الطلبات الرقمية',    icon: 'fa-cloud',              table: 'service_orders' }
    ];

    var ORDER_STATUSES = {
        pending: 'قيد الانتظار', processing: 'قيد المعالجة', confirmed: 'تم التأكيد',
        awaiting_delivery: 'بانتظار التنفيذ', shipped: 'تم الشحن', delivered: 'تم التسليم',
        completed: 'مكتمل', cancelled: 'ملغي', failed: 'فشل', refunded: 'مسترجع',
        in_progress: 'قيد التنفيذ', partial: 'جزئي',
        received: 'تم الاستلام', diagnosing: 'تشخيص', waiting_approval: 'بانتظار الموافقة',
        ready: 'جاهز', rejected: 'مرفوض'
    };

    var activeTab = 'physical';
    var filterStatus = '';
    var searchQuery = '';
    var currentPage = 1;
    var PAGE_SIZE = 15;

    function esc(v) { return TZ.escapeHtml(v == null ? '' : String(v)); }

    /* ── Data fetching ── */

    function getOrders() {
        var orders = TZ.db.orders || [];
        if (activeTab === 'repair') return TZ.db.repairBookings || [];
        if (activeTab === 'digital') return TZ.db.serviceOrders || [];

        return orders.filter(function (o) {
            var isAcc = typeof TZ.isAccessoryProduct === 'function' && (o.items || []).some(function (it) {
                var catId = it.snapshot?.category_id || it.snapshot?.categoryId || '';
                return TZ.isAccessoryProductCategoryId ? TZ.isAccessoryProductCategoryId(catId) : false;
            });
            return activeTab === 'accessory' ? isAcc : !isAcc;
        });
    }

    function applyFilters(list) {
        var result = list;
        if (filterStatus) {
            result = result.filter(function (o) { return o.status === filterStatus; });
        }
        if (searchQuery) {
            var q = searchQuery.toLowerCase();
            result = result.filter(function (o) {
                return (o.id || '').toLowerCase().includes(q)
                    || (o.customerName || o.customer_name || o.name || '').toLowerCase().includes(q);
            });
        }
        return result;
    }

    function paginate(list) {
        var start = (currentPage - 1) * PAGE_SIZE;
        return { items: list.slice(start, start + PAGE_SIZE), total: list.length, totalPages: Math.ceil(list.length / PAGE_SIZE) || 1 };
    }

    /* ── Status change ── */

    async function changeOrderStatus(orderId, newStatus) {
        var tabCfg = TAB_CONFIG.find(function (t) { return t.key === activeTab; });
        var tableName = tabCfg ? tabCfg.table : 'orders';

        var result = await TZ.supabase.from(tableName).update({
            status: newStatus,
            updated_at: new Date().toISOString()
        }).eq('id', orderId);

        if (result.error) {
            A.showToast('فشل تحديث الحالة: ' + (result.error.message || ''));
            return;
        }

        A.showToast('تم تحديث حالة الطلب بنجاح');
        await TZ.refreshData();
        renderOrders();
    }

    /* ── Render ── */

    function renderOrders() {
        var allOrders = getOrders();
        var filtered = applyFilters(allOrders);
        var sorted = filtered.sort(function (a, b) {
            return new Date(b.createdAt || b.created_at) - new Date(a.createdAt || a.created_at);
        });
        var page = paginate(sorted);
        var statusOptions = getStatusOptions();

        var html = '';

        /* ── Section Header ── */
        html += '<div class="admin-section-header">'
            + '<div><h2><i class="fas fa-shopping-cart"></i> إدارة الطلبات</h2>'
            + '<p>إجمالي ' + allOrders.length + ' طلب</p></div>'
            + '</div>';

        /* ── Tabs ── */
        html += '<div class="admin-tabs">';
        TAB_CONFIG.forEach(function (tab) {
            var count = 0;
            if (tab.key === 'repair') count = (TZ.db.repairBookings || []).length;
            else if (tab.key === 'digital') count = (TZ.db.serviceOrders || []).length;
            else {
                var tempActiveTab = activeTab;
                activeTab = tab.key;
                count = getOrders().length;
                activeTab = tempActiveTab;
            }
            html += '<button class="admin-tab' + (activeTab === tab.key ? ' active' : '') + '" data-tab="' + tab.key + '">'
                + '<i class="fas ' + tab.icon + '"></i> ' + tab.label
                + ' <span class="tab-count">' + count + '</span></button>';
        });
        html += '</div>';

        /* ── Filter Bar ── */
        html += '<div class="filter-bar">'
            + '<input type="search" id="ordersSearch" placeholder="ابحث برقم الطلب أو اسم العميل..." value="' + esc(searchQuery) + '">'
            + '<select id="ordersStatusFilter"><option value="">كل الحالات</option>';
        statusOptions.forEach(function (s) {
            html += '<option value="' + s + '"' + (filterStatus === s ? ' selected' : '') + '>' + (ORDER_STATUSES[s] || s) + '</option>';
        });
        html += '</select></div>';

        /* ── Table ── */
        html += '<div class="admin-panel"><div class="panel-body"><div class="table-wrap"><table class="data-table"><thead><tr>';

        if (activeTab === 'repair') {
            html += '<th>#</th><th>العميل</th><th>الجهاز</th><th>الخدمة</th><th>الحالة</th><th>التاريخ</th><th>إجراءات</th>';
        } else if (activeTab === 'digital') {
            html += '<th>#</th><th>الخدمة</th><th>الكمية</th><th>المبلغ</th><th>الحالة</th><th>التاريخ</th><th>إجراءات</th>';
        } else {
            html += '<th>#</th><th>العميل</th><th>المبلغ</th><th>الدفع</th><th>الحالة</th><th>التاريخ</th><th>إجراءات</th>';
        }
        html += '</tr></thead><tbody>';

        if (page.items.length === 0) {
            html += '<tr><td colspan="7"><div class="empty-state"><i class="fas fa-inbox"></i><p>لا توجد طلبات مطابقة</p></div></td></tr>';
        } else {
            page.items.forEach(function (o) {
                html += renderOrderRow(o);
            });
        }
        html += '</tbody></table></div></div>';

        /* ── Pagination ── */
        if (page.totalPages > 1) {
            html += '<div class="admin-table-pagination">'
                + '<div class="admin-table-pagination-info">عرض ' + page.items.length + ' من ' + page.total + '</div>'
                + '<div class="admin-table-pagination-controls">';
            html += '<button data-page="' + (currentPage - 1) + '"' + (currentPage <= 1 ? ' disabled' : '') + '><i class="fas fa-chevron-right"></i></button>';
            for (var i = 1; i <= page.totalPages; i++) {
                html += '<button data-page="' + i + '" class="' + (i === currentPage ? 'active' : '') + '">' + i + '</button>';
            }
            html += '<button data-page="' + (currentPage + 1) + '"' + (currentPage >= page.totalPages ? ' disabled' : '') + '><i class="fas fa-chevron-left"></i></button>';
            html += '</div></div>';
        }

        html += '</div>';

        A.adminContent.innerHTML = html;
        bindEvents();
    }

    function renderOrderRow(o) {
        var id = esc(o.id);
        var date = A.formatDate(o.createdAt || o.created_at);
        var badge = '<span class="status-badge ' + o.status + '">' + (ORDER_STATUSES[o.status] || o.status) + '</span>';
        var actions = buildStatusDropdown(o);

        if (activeTab === 'repair') {
            return '<tr>'
                + '<td><small>' + id + '</small></td>'
                + '<td>' + esc(o.name || '-') + '</td>'
                + '<td>' + esc(o.device || '-') + '</td>'
                + '<td>' + esc(o.service_name || o.serviceName || '-') + '</td>'
                + '<td>' + badge + '</td>'
                + '<td><small>' + date + '</small></td>'
                + '<td class="actions-cell">' + actions + '</td>'
                + '</tr>';
        }
        if (activeTab === 'digital') {
            return '<tr>'
                + '<td><small>' + id + '</small></td>'
                + '<td>' + esc(o.service_name || o.serviceName || '-') + '</td>'
                + '<td>' + (o.quantity || '-') + '</td>'
                + '<td style="font-weight:600;color:#00b894;">' + TZ.formatPrice(o.total || 0) + '</td>'
                + '<td>' + badge + '</td>'
                + '<td><small>' + date + '</small></td>'
                + '<td class="actions-cell">' + actions + '</td>'
                + '</tr>';
        }

        var payLabel = A.paymentLabel ? A.paymentLabel(o.payment_method || o.paymentMethod) : (o.payment_method || '-');
        return '<tr>'
            + '<td><small>' + id + '</small></td>'
            + '<td>' + esc(o.customer_name || o.customerName || '-') + '</td>'
            + '<td style="font-weight:600;color:#00b894;">' + TZ.formatPrice(o.total || 0) + '</td>'
            + '<td>' + esc(payLabel) + '</td>'
            + '<td>' + badge + '</td>'
            + '<td><small>' + date + '</small></td>'
            + '<td class="actions-cell">' + actions + '</td>'
            + '</tr>';
    }

    function buildStatusDropdown(o) {
        var options = getStatusOptions();
        var html = '<select class="order-status-select" data-order-id="' + o.id + '" style="min-height:34px;padding:6px 10px;border-radius:8px;font-size:0.8rem;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.04);color:var(--text-primary);cursor:pointer;">';
        options.forEach(function (s) {
            html += '<option value="' + s + '"' + (o.status === s ? ' selected' : '') + '>' + (ORDER_STATUSES[s] || s) + '</option>';
        });
        html += '</select>';
        return html;
    }

    function getStatusOptions() {
        if (activeTab === 'repair') return ['pending', 'confirmed', 'received', 'diagnosing', 'waiting_approval', 'in_progress', 'ready', 'completed', 'cancelled', 'rejected'];
        if (activeTab === 'digital') return ['pending', 'processing', 'in_progress', 'completed', 'partial', 'failed', 'cancelled', 'refunded'];
        return ['pending', 'awaiting_delivery', 'confirmed', 'processing', 'shipped', 'delivered', 'completed', 'cancelled', 'failed', 'refunded'];
    }

    /* ── Events ── */

    function bindEvents() {
        /* tabs */
        document.querySelectorAll('.admin-tab[data-tab]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                activeTab = btn.dataset.tab;
                filterStatus = '';
                searchQuery = '';
                currentPage = 1;
                renderOrders();
            });
        });

        /* search */
        var searchEl = document.getElementById('ordersSearch');
        if (searchEl) {
            searchEl.addEventListener('input', function () {
                searchQuery = this.value;
                currentPage = 1;
                renderOrders();
            });
        }

        /* status filter */
        var filterEl = document.getElementById('ordersStatusFilter');
        if (filterEl) {
            filterEl.addEventListener('change', function () {
                filterStatus = this.value;
                currentPage = 1;
                renderOrders();
            });
        }

        /* pagination */
        document.querySelectorAll('[data-page]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var p = parseInt(btn.dataset.page, 10);
                if (p >= 1) { currentPage = p; renderOrders(); }
            });
        });

        /* status change */
        document.querySelectorAll('.order-status-select').forEach(function (sel) {
            var origVal = sel.value;
            sel.addEventListener('change', function () {
                var newStatus = sel.value;
                var orderId = sel.dataset.orderId;
                if (newStatus === origVal) return;
                if (!confirm('هل تريد تغيير حالة الطلب إلى "' + (ORDER_STATUSES[newStatus] || newStatus) + '"؟')) {
                    sel.value = origVal;
                    return;
                }
                changeOrderStatus(orderId, newStatus);
            });
        });
    }

    /* ── Register section for all order routes ── */
    A.sections.orders = renderOrders;
    A.sections['product-orders'] = function () { activeTab = 'physical'; renderOrders(); };
    A.sections['accessory-orders'] = function () { activeTab = 'accessory'; renderOrders(); };
})();
