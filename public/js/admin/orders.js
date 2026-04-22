/**
 * TechZone Admin Orders Section.
 */
(function () {
    'use strict';

    var A = window.AdminApp;
    if (!A) return;

    var ADMIN_ORDER_STATUS_API = '/api/admin/orders/status';
    var API_PORT = window.__TZ_API_PORT || '3000';
    var CODED_ERROR_PATTERN = /^\[[A-Z]{2,4}-\d{3}\]/;
    var PAGE_SIZE = 15;
    var TAB_CONFIG = [
        { key: 'physical', label: 'طلبات المنتجات', icon: 'fa-box' },
        { key: 'accessory', label: 'طلبات الإكسسوارات', icon: 'fa-headphones' },
        { key: 'repair', label: 'حجوزات الصيانة', icon: 'fa-screwdriver-wrench' }
    ];
    var ORDER_STATUSES = {
        pending: 'قيد الانتظار', processing: 'قيد المعالجة', confirmed: 'تم التأكيد',
        awaiting_delivery: 'بانتظار التنفيذ', shipped: 'تم الشحن', delivered: 'تم التسليم',
        completed: 'مكتمل', cancelled: 'ملغي', failed: 'فشل', refunded: 'مسترجع',
        in_progress: 'قيد التنفيذ', partial: 'جزئي', received: 'تم الاستلام',
        diagnosing: 'تشخيص', waiting_approval: 'بانتظار الموافقة', ready: 'جاهز', rejected: 'مرفوض'
    };

    var activeTab = 'physical';
    var filterStatus = '';
    var searchQuery = '';
    var currentPage = 1;

    function esc(value) {
        return TZ.escapeHtml(value == null ? '' : String(value));
    }

    function getOrders() {
        var orders = TZ.db.orders || [];
        if (activeTab === 'repair') return TZ.db.repairBookings || [];

        return orders.filter(function (order) {
            var isAccessory = typeof TZ.isAccessoryProduct === 'function' && (order.items || []).some(function (item) {
                var categoryId = item.snapshot?.category_id || item.snapshot?.categoryId || '';
                return TZ.isAccessoryProductCategoryId ? TZ.isAccessoryProductCategoryId(categoryId) : false;
            });
            return activeTab === 'accessory' ? isAccessory : !isAccessory;
        });
    }

    function applyFilters(list) {
        return list.filter(function (order) {
            var matchesStatus = !filterStatus || order.status === filterStatus;
            var query = searchQuery.toLowerCase();
            var matchesSearch = !query || [
                order.id,
                order.customerName,
                order.customer_name,
                order.name,
                order.service_name,
                order.serviceName
            ].some(function (value) {
                return String(value || '').toLowerCase().includes(query);
            });
            return matchesStatus && matchesSearch;
        });
    }

    function paginate(list) {
        var start = (currentPage - 1) * PAGE_SIZE;
        return {
            items: list.slice(start, start + PAGE_SIZE),
            total: list.length,
            totalPages: Math.ceil(list.length / PAGE_SIZE) || 1
        };
    }

    async function getAdminAuthToken() {
        var sessionResult = await TZ.supabase.auth.getSession();
        return sessionResult?.data?.session?.access_token || '';
    }

    function getAdminApiBaseUrl() {
        var currentPort = window.location.port;
        return (currentPort !== API_PORT && currentPort !== '') ? ('http://localhost:' + API_PORT) : '';
    }

    function getOrderTargetType() {
        return 'physical_order';
    }

    function showOrderStatusError(message) {
        var normalized = String(message || '').trim();
        if (CODED_ERROR_PATTERN.test(normalized)) {
            A.showToast(normalized);
            return;
        }

        A.showErrorToast('ORM-301', normalized || 'تعذر تحديث حالة الطلب.');
    }

    async function changeServerOrderStatus(orderId, newStatus) {
        var token = await getAdminAuthToken();
        var response = await fetch(getAdminApiBaseUrl() + ADMIN_ORDER_STATUS_API, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                Authorization: 'Bearer ' + token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                orderId: orderId,
                status: newStatus,
                targetType: getOrderTargetType()
            })
        });
        var payload = null;

        try {
            payload = await response.json();
        } catch (error) {
            void error;
        }

        if (!response.ok || !payload || payload.success !== true) {
            throw new Error(payload?.error || ('[ORM-500] تعذر تحديث حالة الطلب (' + response.status + ').'));
        }
    }

    async function changeRepairOrderStatus(orderId, newStatus) {
        var result = await TZ.supabase.from('repair_bookings').update({
            status: newStatus,
            updated_at: new Date().toISOString()
        }).eq('id', orderId);

        if (result.error) {
            throw new Error(result.error.message || '');
        }
    }

    async function changeOrderStatus(orderId, newStatus) {
        try {
            if (activeTab === 'repair') await changeRepairOrderStatus(orderId, newStatus);
            else await changeServerOrderStatus(orderId, newStatus);

            A.showToast('تم تحديث حالة الطلب بنجاح');
            await TZ.refreshData();
            renderOrders();
        } catch (error) {
            showOrderStatusError(error?.message || '');
        }
    }

    function getStatusOptions() {
        if (activeTab === 'repair') return ['pending', 'confirmed', 'received', 'diagnosing', 'waiting_approval', 'in_progress', 'ready', 'completed', 'cancelled', 'rejected'];
        return ['pending', 'awaiting_delivery', 'confirmed', 'processing', 'shipped', 'delivered', 'completed', 'cancelled', 'failed', 'refunded'];
    }

    function buildStatusDropdown(order) {
        return '<select class="order-status-select" data-order-id="' + order.id + '" style="min-height:34px;padding:6px 10px;border-radius:8px;font-size:0.8rem;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.04);color:var(--text-primary);cursor:pointer;">'
            + getStatusOptions().map(function (status) {
                return '<option value="' + status + '"' + (order.status === status ? ' selected' : '') + '>' + (ORDER_STATUSES[status] || status) + '</option>';
            }).join('')
            + '</select>';
    }

    function renderOrderRow(order) {
        var date = A.formatDate(order.createdAt || order.created_at);
        var badge = '<span class="status-badge ' + order.status + '">' + (ORDER_STATUSES[order.status] || order.status) + '</span>';
        var actions = buildStatusDropdown(order);

        if (activeTab === 'repair') {
            return '<tr><td><small>' + esc(order.id) + '</small></td><td>' + esc(order.name || '-') + '</td><td>' + esc(order.device || '-') + '</td><td>' + esc(order.service_name || order.serviceName || '-') + '</td><td>' + badge + '</td><td><small>' + date + '</small></td><td class="actions-cell">' + actions + '</td></tr>';
        }
        var paymentLabel = A.paymentLabel ? A.paymentLabel(order.payment_method || order.paymentMethod) : (order.payment_method || '-');
        return '<tr><td><small>' + esc(order.id) + '</small></td><td>' + esc(order.customer_name || order.customerName || '-') + '</td><td style="font-weight:600;color:#00b894;">' + TZ.formatPrice(order.total || 0) + '</td><td>' + esc(paymentLabel) + '</td><td>' + badge + '</td><td><small>' + date + '</small></td><td class="actions-cell">' + actions + '</td></tr>';
    }

    function renderPagination(page) {
        if (page.totalPages <= 1) return '';

        return '<div class="admin-table-pagination"><div class="admin-table-pagination-info">عرض ' + page.items.length + ' من ' + page.total + '</div><div class="admin-table-pagination-controls">'
            + '<button data-page="' + (currentPage - 1) + '"' + (currentPage <= 1 ? ' disabled' : '') + '><i class="fas fa-chevron-right"></i></button>'
            + Array.from({ length: page.totalPages }, function (_, index) {
                var pageNumber = index + 1;
                return '<button data-page="' + pageNumber + '" class="' + (pageNumber === currentPage ? 'active' : '') + '">' + pageNumber + '</button>';
            }).join('')
            + '<button data-page="' + (currentPage + 1) + '"' + (currentPage >= page.totalPages ? ' disabled' : '') + '><i class="fas fa-chevron-left"></i></button></div></div>';
    }

    function renderOrders() {
        var allOrders = getOrders();
        var sorted = applyFilters(allOrders).sort(function (a, b) {
            return new Date(b.createdAt || b.created_at) - new Date(a.createdAt || a.created_at);
        });
        var page = paginate(sorted);
        var sectionTitle = activeTab === 'repair' ? 'حجوزات الصيانة' : 'إدارة الطلبات';
        var summaryLabel = activeTab === 'repair' ? 'حجز' : 'طلب';
        var columns = activeTab === 'repair'
            ? '<th>#</th><th>العميل</th><th>الجهاز</th><th>الخدمة</th><th>الحالة</th><th>التاريخ</th><th>إجراءات</th>'
            : '<th>#</th><th>العميل</th><th>المبلغ</th><th>الدفع</th><th>الحالة</th><th>التاريخ</th><th>إجراءات</th>';
        var tabsHtml = TAB_CONFIG.map(function (tab) {
            var previousTab = activeTab;
            activeTab = tab.key;
            var count = getOrders().length;
            activeTab = previousTab;
            return '<button class="admin-tab' + (activeTab === tab.key ? ' active' : '') + '" data-tab="' + tab.key + '"><i class="fas ' + tab.icon + '"></i> ' + tab.label + ' <span class="tab-count">' + count + '</span></button>';
        }).join('');
        var rowsHtml = page.items.length
            ? page.items.map(renderOrderRow).join('')
            : '<tr><td colspan="7"><div class="empty-state"><i class="fas fa-inbox"></i><p>لا توجد طلبات مطابقة</p></div></td></tr>';
        var statusOptionsHtml = getStatusOptions().map(function (status) {
            return '<option value="' + status + '"' + (filterStatus === status ? ' selected' : '') + '>' + (ORDER_STATUSES[status] || status) + '</option>';
        }).join('');

        A.adminContent.innerHTML = '<div class="admin-section-header"><div><h2><i class="fas fa-shopping-cart"></i> ' + sectionTitle + '</h2><p>إجمالي ' + allOrders.length + ' ' + summaryLabel + '</p></div></div>'
            + '<div class="admin-tabs">' + tabsHtml + '</div>'
            + '<div class="filter-bar"><input type="search" id="ordersSearch" placeholder="ابحث برقم الطلب أو اسم العميل أو اسم الخدمة..." value="' + esc(searchQuery) + '"><select id="ordersStatusFilter"><option value="">كل الحالات</option>'
            + statusOptionsHtml
            + '</select></div><div class="admin-panel"><div class="panel-body"><div class="table-wrap"><table class="data-table"><thead><tr>'
            + columns
            + '</tr></thead><tbody>' + rowsHtml + '</tbody></table></div></div>'
            + renderPagination(page)
            + '</div>';

        bindEvents();
    }

    function bindEvents() {
        document.querySelectorAll('.admin-tab[data-tab]').forEach(function (button) {
            button.addEventListener('click', function () {
                activeTab = button.dataset.tab;
                filterStatus = '';
                searchQuery = '';
                currentPage = 1;
                renderOrders();
            });
        });

        document.getElementById('ordersSearch')?.addEventListener('input', function () {
            searchQuery = this.value;
            currentPage = 1;
            renderOrders();
        });

        document.getElementById('ordersStatusFilter')?.addEventListener('change', function () {
            filterStatus = this.value;
            currentPage = 1;
            renderOrders();
        });

        document.querySelectorAll('[data-page]').forEach(function (button) {
            button.addEventListener('click', function () {
                var page = parseInt(button.dataset.page, 10);
                if (page >= 1) {
                    currentPage = page;
                    renderOrders();
                }
            });
        });

        document.querySelectorAll('.order-status-select').forEach(function (select) {
            var originalValue = select.value;
            select.addEventListener('change', function () {
                var newStatus = select.value;
                var orderId = select.dataset.orderId;

                if (newStatus === originalValue) return;
                if (!window.confirm('هل تريد تغيير حالة الطلب إلى "' + (ORDER_STATUSES[newStatus] || newStatus) + '"؟')) {
                    select.value = originalValue;
                    return;
                }

                void changeOrderStatus(orderId, newStatus);
            });
        });
    }

    A.sections.orders = renderOrders;
    A.sections['product-orders'] = function () { activeTab = 'physical'; renderOrders(); };
    A.sections['accessory-orders'] = function () { activeTab = 'accessory'; renderOrders(); };
})();
