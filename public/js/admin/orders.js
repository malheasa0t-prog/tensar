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
    var ORDER_NOTES_PREVIEW_LENGTH = 96;
    var PHYSICAL_STATUS_OPTIONS = Object.freeze(['pending', 'processing', 'delivered', 'cancelled']);
    var PHYSICAL_STATUS_ACTION_LABELS = Object.freeze({
        pending: '\u0641\u064a \u0627\u0644\u0627\u0646\u062a\u0638\u0627\u0631',
        processing: '\u0642\u064a\u062f \u0627\u0644\u062a\u0646\u0641\u064a\u0630',
        delivered: '\u062a\u0645 \u0627\u0644\u062a\u0633\u0644\u064a\u0645',
        cancelled: '\u0645\u0644\u063a\u064a'
    });
    var REPAIR_STATUS_OPTIONS = Object.freeze(['pending', 'in_progress', 'ready', 'completed', 'cancelled']);
    var LEGACY_PHYSICAL_STATUS_MAP = Object.freeze({
        awaiting_delivery: 'processing',
        confirmed: 'processing',
        shipped: 'processing',
        completed: 'delivered',
        failed: 'cancelled',
        refunded: 'cancelled'
    });
    var pendingStatusOrderIds = new Set();

    function esc(value) {
        return TZ.escapeHtml(value == null ? '' : String(value));
    }

    function truncateText(value, maxLength) {
        var normalizedValue = String(value || '').trim();
        if (!normalizedValue || normalizedValue.length <= maxLength) return normalizedValue;
        return normalizedValue.slice(0, Math.max(0, maxLength - 3)).trim() + '...';
    }

    function getOrderSearchTokens(order) {
        var itemNames = Array.isArray(order.items)
            ? order.items.map(function (item) { return item.productName || ''; }).join(' ')
            : '';

        return [
            order.id,
            order.displayNumber,
            A.formatOrderNumber ? A.formatOrderNumber(order) : '',
            order.customerName,
            order.customer_name,
            order.customerPhone,
            order.customer_phone,
            order.customerEmail,
            order.customer_email,
            order.name,
            order.phone,
            order.email,
            order.device,
            order.service_name,
            order.serviceName,
            order.notes,
            order.description,
            itemNames
        ];
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
            var matchesStatus = !filterStatus || getOrderDisplayStatus(order, activeTab) === filterStatus;
            var query = searchQuery.toLowerCase();
            var matchesSearch = !query || getOrderSearchTokens(order).some(function (value) {
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

    /**
     * Returns whether the current tab represents repair bookings.
     *
     * @returns {boolean}
     */
    function isRepairTab() {
        return activeTab === 'repair';
    }

    /**
     * Maps legacy product-order statuses into the simplified workflow shown in the admin table.
     *
     * @param {string} status
     * @returns {string}
     */
    function normalizePhysicalOrderStatus(status) {
        var normalizedStatus = String(status || '').trim().toLowerCase();
        return LEGACY_PHYSICAL_STATUS_MAP[normalizedStatus] || normalizedStatus;
    }

    /**
     * Resolves the statuses available for the current admin tab.
     *
     * @param {string} tabKey
     * @returns {string[]}
     */
    function getStatusOptionsForTab(tabKey) {
        return tabKey === 'repair' ? REPAIR_STATUS_OPTIONS.slice() : PHYSICAL_STATUS_OPTIONS.slice();
    }

    /**
     * Resolves the status used for badges, filtering, and action highlighting.
     *
     * @param {object} order
     * @param {string} tabKey
     * @returns {string}
     */
    function getOrderDisplayStatus(order, tabKey) {
        var currentStatus = String(order?.status || '').trim().toLowerCase();
        return tabKey === 'repair' ? currentStatus : normalizePhysicalOrderStatus(currentStatus);
    }

    /**
     * Resolves the display label for a status in the current admin tab.
     *
     * @param {string} status
     * @param {string} tabKey
     * @returns {string}
     */
    function getStatusLabel(status, tabKey) {
        if (tabKey === 'repair') return ORDER_STATUSES[status] || status;
        return PHYSICAL_STATUS_ACTION_LABELS[status] || ORDER_STATUSES[status] || status;
    }

    /**
     * Builds the physical-order status buttons shown in the actions column.
     *
     * @param {{ currentStatus: string, isPending: boolean, orderId: string }} options
     * @returns {string}
     */
    function buildPhysicalStatusActionsMarkup(options) {
        var orderId = String(options?.orderId || '').trim();
        var currentStatus = normalizePhysicalOrderStatus(options?.currentStatus);
        var isPending = options?.isPending === true;

        return '<div class="order-status-actions" role="group" aria-label="Order status actions">'
            + PHYSICAL_STATUS_OPTIONS.map(function (status) {
                var isActive = currentStatus === status;
                var isDisabled = isPending || isActive;
                var buttonLabel = getStatusLabel(status, 'physical');
                return '<button type="button" class="order-status-action order-status-action--' + status
                    + (isActive ? ' is-active' : '')
                    + '" data-order-id="' + esc(orderId)
                    + '" data-status="' + status
                    + '" aria-pressed="' + (isActive ? 'true' : 'false') + '"'
                    + (isDisabled ? ' disabled' : '')
                    + '>' + esc(buttonLabel) + '</button>';
            }).join('')
            + '</div>';
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
        var normalizedOrderId = String(orderId || '').trim();
        if (!normalizedOrderId || pendingStatusOrderIds.has(normalizedOrderId)) return;

        pendingStatusOrderIds.add(normalizedOrderId);
        renderOrders();

        try {
            if (isRepairTab()) await changeRepairOrderStatus(normalizedOrderId, newStatus);
            else await changeServerOrderStatus(normalizedOrderId, newStatus);

            A.showToast('تم تحديث حالة الطلب بنجاح');
            await TZ.refreshData();
        } catch (error) {
            showOrderStatusError(error?.message || '');
        } finally {
            pendingStatusOrderIds.delete(normalizedOrderId);
            renderOrders();
        }
    }

    function getStatusOptions() {
        return getStatusOptionsForTab(activeTab);
    }

    function buildRepairStatusDropdown(order) {
        return '<select class="order-status-select" data-order-id="' + order.id + '" style="min-height:34px;padding:6px 10px;border-radius:8px;font-size:0.8rem;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.04);color:var(--text-primary);cursor:pointer;">'
            + getStatusOptions().map(function (status) {
                return '<option value="' + status + '"' + (order.status === status ? ' selected' : '') + '>' + (ORDER_STATUSES[status] || status) + '</option>';
            }).join('')
            + '</select>';
    }

    function buildStatusControl(order) {
        if (isRepairTab()) return buildRepairStatusDropdown(order);

        return buildPhysicalStatusActionsMarkup({
            orderId: order.id,
            currentStatus: order.status,
            isPending: pendingStatusOrderIds.has(String(order.id || '').trim())
        });
    }

    function buildMetaLine(label, value) {
        var normalizedValue = String(value || '').trim();
        if (!normalizedValue) return '';

        return '<div style="font-size:0.82rem;color:var(--text-muted);line-height:1.6;">'
            + '<strong style="color:var(--text-primary);">' + esc(label) + ':</strong> '
            + esc(normalizedValue)
            + '</div>';
    }

    function buildOrderNumberCell(order) {
        var orderLabel = activeTab === 'repair'
            ? String(order.id || '-')
            : (A.formatOrderNumber ? A.formatOrderNumber(order) : String(order.id || '-'));
        var rawId = String(order.id || '').trim();
        var rawIdLine = activeTab !== 'repair' && rawId && orderLabel !== rawId
            ? '<small style="color:var(--text-muted);">ID: ' + esc(rawId) + '</small>'
            : '';

        return '<td><div style="display:grid;gap:4px;">'
            + '<strong style="font-size:1rem;color:var(--primary-light);">' + esc(orderLabel) + '</strong>'
            + rawIdLine
            + '</div></td>';
    }

    function buildCustomerCell(order) {
        var customerName = order.customer_name || order.customerName || order.name || '-';
        var phone = order.customer_phone || order.customerPhone || order.phone || '';
        var email = order.customer_email || order.customerEmail || order.email || '';

        return '<td><div style="display:grid;gap:4px;">'
            + '<strong>' + esc(customerName) + '</strong>'
            + buildMetaLine('الهاتف', phone)
            + buildMetaLine('البريد', email)
            + '</div></td>';
    }

    function getOrderItemCount(order) {
        if (!Array.isArray(order.items)) return 0;
        return order.items.reduce(function (total, item) {
            return total + (Number(item.qty || 0) || 0);
        }, 0);
    }

    function getOrderItemsPreview(order) {
        if (!Array.isArray(order.items) || order.items.length === 0) return '';

        return order.items.map(function (item) {
            var productName = String(item.productName || '').trim();
            var quantity = Number(item.qty || 0) || 0;
            if (!productName) return '';
            return quantity > 1 ? productName + ' ×' + quantity : productName;
        }).filter(Boolean).slice(0, 3).join('، ');
    }

    function buildPhysicalDetailsCell(order) {
        var itemCount = getOrderItemCount(order);
        var itemsPreview = getOrderItemsPreview(order);
        var deliveryMethodLabel = A.deliveryLabel
            ? A.deliveryLabel(order.delivery_method || order.deliveryMethod)
            : (order.delivery_method || order.deliveryMethod || '-');
        var paymentMethodLabel = A.paymentLabel
            ? A.paymentLabel(order.payment_method || order.paymentMethod)
            : (order.payment_method || order.paymentMethod || '-');
        var notes = truncateText(order.notes, ORDER_NOTES_PREVIEW_LENGTH);

        return '<td><div style="display:grid;gap:4px;">'
            + buildMetaLine('العناصر', itemCount > 0 ? itemCount + ' قطعة' : 'بدون عناصر')
            + buildMetaLine('المنتجات', itemsPreview)
            + buildMetaLine('التسليم', deliveryMethodLabel)
            + buildMetaLine('الدفع', paymentMethodLabel)
            + buildMetaLine('ملاحظات', notes)
            + '</div></td>';
    }

    function buildRepairDetailsCell(order) {
        var preferredDate = order.preferredDate ? A.formatDate(order.preferredDate) : '';
        var description = truncateText(order.description, ORDER_NOTES_PREVIEW_LENGTH);

        return '<td><div style="display:grid;gap:4px;">'
            + buildMetaLine('الجهاز', order.device || '-')
            + buildMetaLine('الخدمة', order.service_name || order.serviceName || '-')
            + buildMetaLine('الموعد المفضل', preferredDate)
            + buildMetaLine('الوصف', description)
            + '</div></td>';
    }

    function buildAmountCell(order) {
        var shippingFee = Number(order.shipping_fee || order.shippingFee || 0);
        var shippingLabel = shippingFee > 0 ? TZ.formatPrice(shippingFee) : 'مجاني';

        return '<td><div style="display:grid;gap:4px;">'
            + '<strong style="font-weight:600;color:#00b894;">' + TZ.formatPrice(order.total || 0) + '</strong>'
            + buildMetaLine('الشحن', shippingLabel)
            + '</div></td>';
    }

    function buildStatusBadge(order) {
        var displayStatus = getOrderDisplayStatus(order, activeTab);
        var badgeLabel = getStatusLabel(displayStatus, activeTab);

        return '<span class="status-badge ' + esc(displayStatus) + '">' + esc(badgeLabel) + '</span>';
    }

    function renderRepairOrderRow(order) {
        var date = A.formatDateTime ? A.formatDateTime(order.createdAt || order.created_at) : A.formatDate(order.createdAt || order.created_at);
        var badge = buildStatusBadge(order);
        var actions = buildStatusControl(order);

        return '<tr data-order-id="' + esc(order.id) + '">'
            + buildOrderNumberCell(order)
            + buildCustomerCell(order)
            + buildRepairDetailsCell(order)
            + '<td>' + badge + '</td>'
            + '<td><small>' + esc(date) + '</small></td>'
            + '<td class="actions-cell">' + actions + '</td>'
            + '</tr>';
    }

    function renderPhysicalOrderRow(order) {
        var date = A.formatDateTime ? A.formatDateTime(order.createdAt || order.created_at) : A.formatDate(order.createdAt || order.created_at);
        var badge = buildStatusBadge(order);
        var actions = buildStatusControl(order);

        return '<tr data-order-id="' + esc(order.id) + '">'
            + buildOrderNumberCell(order)
            + buildCustomerCell(order)
            + buildPhysicalDetailsCell(order)
            + buildAmountCell(order)
            + '<td>' + badge + '</td>'
            + '<td><small>' + esc(date) + '</small></td>'
            + '<td class="actions-cell">' + actions + '</td>'
            + '</tr>';
    }

    function renderOrderRow(order) {
        return activeTab === 'repair' ? renderRepairOrderRow(order) : renderPhysicalOrderRow(order);
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
        var columnCount = activeTab === 'repair' ? 6 : 7;
        var sectionTitle = activeTab === 'repair' ? 'حجوزات الصيانة' : 'إدارة الطلبات';
        var summaryLabel = activeTab === 'repair' ? 'حجز' : 'طلب';
        var columns = activeTab === 'repair'
            ? '<th>#</th><th>العميل</th><th>الجهاز</th><th>الخدمة</th><th>الحالة</th><th>التاريخ</th><th>إجراءات</th>'
            : '<th>#</th><th>العميل</th><th>المبلغ</th><th>الدفع</th><th>الحالة</th><th>التاريخ</th><th>إجراءات</th>';
        columns = activeTab === 'repair'
            ? '<th>رقم الحجز</th><th>العميل</th><th>تفاصيل الطلب</th><th>الحالة</th><th>التاريخ</th><th>إجراءات</th>'
            : '<th>رقم الطلب</th><th>العميل</th><th>تفاصيل الطلب</th><th>المبلغ</th><th>الحالة</th><th>التاريخ</th><th>إجراءات</th>';
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
        if (!page.items.length) {
            rowsHtml = '<tr><td colspan="' + columnCount + '"><div class="empty-state"><i class="fas fa-inbox"></i><p>لا توجد طلبات مطابقة</p></div></td></tr>';
        }
        var statusOptionsHtml = getStatusOptions().map(function (status) {
            return '<option value="' + status + '"' + (filterStatus === status ? ' selected' : '') + '>' + getStatusLabel(status, activeTab) + '</option>';
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

        var ordersSearchInput = document.getElementById('ordersSearch');
        if (ordersSearchInput) {
            ordersSearchInput.placeholder = 'ابحث برقم الطلب مثل #2000 أو باسم العميل أو الهاتف...';
        }

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

        document.querySelectorAll('.order-status-action[data-order-id][data-status]').forEach(function (button) {
            button.addEventListener('click', function () {
                var newStatus = button.dataset.status;
                var orderId = button.dataset.orderId;

                if (button.disabled || !newStatus || !orderId) return;
                if (!window.confirm('Ù‡Ù„ ØªØ±ÙŠØ¯ ØªØºÙŠÙŠØ± Ø­Ø§Ù„Ø© Ø§Ù„Ø·Ù„Ø¨ Ø¥Ù„Ù‰ "' + getStatusLabel(newStatus, activeTab) + '"ØŸ')) return;

                void changeOrderStatus(orderId, newStatus);
            });
        });
    }

    A.sections.orders = renderOrders;
    A.sections['product-orders'] = function () { activeTab = 'physical'; renderOrders(); };
    A.sections['accessory-orders'] = function () { activeTab = 'accessory'; renderOrders(); };

    if (window.__ENABLE_ORDER_ADMIN_TEST_HOOKS__) {
        window.__orderAdminTestHooks = {
            buildPhysicalStatusActionsMarkup: buildPhysicalStatusActionsMarkup,
            getOrderDisplayStatus: getOrderDisplayStatus,
            getStatusLabel: getStatusLabel,
            getStatusOptionsForTab: getStatusOptionsForTab,
            normalizePhysicalOrderStatus: normalizePhysicalOrderStatus
        };
    }
})();
