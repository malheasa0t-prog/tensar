// ===== TechZone Admin - Orders =====
(function () {
    'use strict';

    const A = window.AdminApp;
    const bulkActions = window.AdminBulkActions;
    const ADMIN_STATUS_ROUTE = '/api/admin/orders/status';
    const FINAL_PHYSICAL_STATUSES = new Set(['completed', 'delivered', 'cancelled', 'failed', 'refunded']);
    const FINAL_DIGITAL_STATUSES = new Set(['completed', 'partial', 'failed', 'cancelled', 'refunded']);
    const PHYSICAL_ORDER_SECTIONS = [
        { id: 'product-orders', title: 'طلبات المنتجات', icon: 'fa-box', color: '#6c5ce7', empty: 'لا توجد طلبات منتجات حالياً.' },
        { id: 'accessory-orders', title: 'طلبات الإكسسوارات', icon: 'fa-headphones', color: '#fd79a8', empty: 'لا توجد طلبات إكسسوارات حالياً.' }
    ];
    const REPAIR_ORDER_STATUSES = [
        { id: 'awaiting_delivery', label: 'بانتظار التوصيل', icon: 'fa-truck', color: '#fdcb6e', nextStatus: 'under_maintenance', nextLabel: 'استلام وبدء الصيانة', nextIcon: 'fa-wrench' },
        { id: 'awaiting_device', label: 'بانتظار وصول الجهاز', icon: 'fa-box-open', color: '#e17055', nextStatus: 'under_maintenance', nextLabel: 'استلام وبدء الصيانة', nextIcon: 'fa-wrench' },
        { id: 'awaiting_remote_session', label: 'بانتظار بدء الصيانة عن بعد', icon: 'fa-headset', color: '#00cec9', nextStatus: 'under_maintenance', nextLabel: 'بدء الصيانة عن بعد', nextIcon: 'fa-laptop-code' },
        { id: 'under_maintenance', label: 'تحت الصيانة', icon: 'fa-wrench', color: '#a29bfe', nextStatus: 'awaiting_pickup', nextLabel: 'إنهاء الصيانة', nextIcon: 'fa-check-circle' },
        { id: 'awaiting_pickup', label: 'بانتظار الاستلام', icon: 'fa-hand-holding', color: '#00b894', nextStatus: null, nextLabel: null, nextIcon: null },
        { id: 'completed_remote', label: 'تمت الصيانة عن بعد', icon: 'fa-laptop-code', color: '#00cec9', nextStatus: null, nextLabel: null, nextIcon: null }
    ];
    const PHYSICAL_BULK_STATUS_OPTIONS = [
        { value: 'awaiting_delivery', label: 'بانتظار التنفيذ' },
        { value: 'processing', label: 'قيد التنفيذ' },
        { value: 'completed', label: 'مكتمل' },
        { value: 'cancelled', label: 'ملغي' },
        { value: 'failed', label: 'فشل' }
    ];
    const DIGITAL_BULK_STATUS_OPTIONS = [
        { value: 'processing', label: 'قيد المعالجة' },
        { value: 'in_progress', label: 'قيد التنفيذ' },
        { value: 'completed', label: 'مكتمل' },
        { value: 'failed', label: 'فشل' },
        { value: 'cancelled', label: 'ملغي' }
    ];

    function cloneOrders(list) {
        return TZ.clone(list || []).sort((first, second) => new Date(second.createdAt || 0) - new Date(first.createdAt || 0));
    }

    function getBookingPipelineStatus(booking) {
        if (booking.status === 'pending') return booking.mode === 'delivery' ? 'awaiting_delivery' : booking.mode === 'remote' ? 'awaiting_remote_session' : 'awaiting_device';
        if (booking.status === 'in_progress') return 'under_maintenance';
        if (booking.status === 'completed') return booking.mode === 'remote' ? 'completed_remote' : 'awaiting_pickup';
        return booking.status;
    }

    function getAccessoryKindFromMetadata(order) {
        const kind = String(order?.metadata?.catalog_kind || order?.metadata?.catalogKind || '').trim().toLowerCase();
        return kind === 'accessories' ? 'accessories' : kind === 'products' ? 'products' : '';
    }

    function isAccessoryOrderItem(item) {
        if (!item) return false;
        const snapshot = item.snapshot || {};
        if (snapshot.product_type === 'accessory') return true;
        if (snapshot.category_id && typeof TZ.isAccessoryProductCategoryId === 'function') return TZ.isAccessoryProductCategoryId(snapshot.category_id);
        const product = TZ.getProductById(item.productId);
        return product ? TZ.isAccessoryProduct(product) : false;
    }

    function getPhysicalOrderSectionId(order) {
        const metadataKind = getAccessoryKindFromMetadata(order);
        if (metadataKind) return metadataKind === 'accessories' ? 'accessory-orders' : 'product-orders';
        const items = Array.isArray(order?.items) ? order.items : [];
        return items.length === 0 || items.some((item) => !isAccessoryOrderItem(item)) ? 'product-orders' : 'accessory-orders';
    }

    function getPhysicalOrders(sectionId) {
        return cloneOrders(TZ.db.orders).filter((order) => getPhysicalOrderSectionId(order) === sectionId);
    }

    function getPhysicalOrderSummary(order) {
        const items = Array.isArray(order.items) ? order.items : [];
        const names = items.map((item) => item.productName || item.productId || 'منتج').filter(Boolean);
        return {
            count: items.reduce((total, item) => total + Number(item.qty || 0), 0),
            names: names.join('، '),
            shortText: names.slice(0, 2).join('، ') + (names.length > 2 ? ` +${names.length - 2}` : '')
        };
    }

    function getPhysicalOrderActions(order) {
        if (FINAL_PHYSICAL_STATUSES.has(order.status)) return '';
        const toggleStatus = order.status === 'processing' ? 'awaiting_delivery' : 'processing';
        const toggleLabel = order.status === 'processing' ? 'إيقاف التنفيذ' : 'قيد التنفيذ';
        return `
            <button class="btn btn-outline btn-sm order-action-btn btn-physical-status" data-id="${order.id}" data-status="${toggleStatus}">
                <i class="fas ${order.status === 'processing' ? 'fa-pause-circle' : 'fa-gear'}"></i> ${toggleLabel}
            </button>
            <button class="btn btn-primary btn-sm order-action-btn btn-physical-status" data-id="${order.id}" data-status="completed">
                <i class="fas fa-check-circle"></i> تم التنفيذ
            </button>
        `;
    }

    function getDigitalOrderActions(order) {
        if (FINAL_DIGITAL_STATUSES.has(order.status)) return '';
        return `
            <button class="btn btn-danger btn-sm order-action-btn btn-digital-status" data-id="${order.id}" data-status="cancelled">
                <i class="fas fa-rotate-left"></i> إلغاء واسترجاع الرصيد
            </button>
        `;
    }

    function getPhysicalOrderRow(order) {
        const summary = getPhysicalOrderSummary(order);
        return `
            <tr data-order-id="${order.id}" data-order-search="${TZ.escapeHtml(`${order.id} ${order.customerName || ''} ${summary.names}`.toLowerCase())}">
                ${bulkActions ? bulkActions.getRowCheckboxMarkup(getPhysicalOrderSectionId(order), order.id) : ''}
                <td>${TZ.escapeHtml(order.id)}</td>
                <td>${TZ.escapeHtml(order.customerName || '-')}</td>
                <td><div class="order-item-summary"><strong>${TZ.escapeHtml(summary.shortText || 'بدون عناصر')}</strong><small>${summary.count || 0} قطعة</small></div></td>
                <td>${TZ.formatPrice(order.total || 0)}</td>
                <td>${A.paymentLabel(order.paymentMethod)}</td>
                <td>${A.formatDate(order.createdAt)}</td>
                <td><span class="status-badge ${order.status}">${A.statusLabel(order.status)}</span></td>
                <td class="actions-cell">${getPhysicalOrderActions(order)}</td>
            </tr>
        `;
    }

    function renderOrderRouteCard(section) {
        const count = getPhysicalOrders(section.id).length;
        return `<article class="admin-insight-card order-route-card"><div class="order-route-head"><span class="order-route-icon"><i class="fas ${section.icon}"></i></span><div><strong>${section.title}</strong><p>${count} طلب</p></div></div><button class="btn btn-outline btn-sm" type="button" data-nav-section="${section.id}">فتح القسم</button></article>`;
    }

    function getBulkToolbarMarkup(scopeKey) {
        return bulkActions ? bulkActions.getToolbarMarkup({
            scopeKey: scopeKey,
            itemLabel: 'طلبات',
            actions: { status: true, delete: true, export: true }
        }) : '';
    }

    async function updateBulkPhysicalOrderStatus(ids, status) {
        for (const id of ids) {
            await requestOrderStatusUpdate({ targetType: 'physical_order', orderId: id, status: status });
        }
        await TZ.refreshData();
        A.updateOrdersBadge();
        renderPhysicalOrdersSection(A.currentSection);
        A.showToast(`تم تحديث حالة ${ids.length} طلبات.`);
    }

    async function updateBulkDigitalOrderStatus(ids, status) {
        for (const id of ids) {
            await requestOrderStatusUpdate({ targetType: 'service_order', orderId: id, status: status });
        }
        await TZ.refreshData();
        A.updateOrdersBadge();
        renderOrders();
        A.showToast(`تم تحديث حالة ${ids.length} طلبات رقمية.`);
    }

    function buildPhysicalExportRows(ids, sectionId) {
        return getPhysicalOrders(sectionId).filter((order) => ids.includes(order.id)).map((order) => ({
            orderId: order.id,
            customer: order.customerName || '',
            total: order.total || 0,
            payment: A.paymentLabel(order.paymentMethod),
            status: A.statusLabel(order.status),
            createdAt: A.formatDate(order.createdAt)
        }));
    }

    function buildDigitalExportRows(ids) {
        return cloneOrders(TZ.db.serviceOrders || []).filter((order) => ids.includes(order.id)).map((order) => ({
            orderId: order.id,
            customer: TZ.getUserById(order.userId)?.fullName || '',
            service: order.serviceName || order.serviceId || '',
            total: order.total || 0,
            status: A.statusLabel(order.status),
            createdAt: A.formatDate(order.createdAt)
        }));
    }

    async function deleteBulkPhysicalOrders(ids) {
        const orders = getPhysicalOrders(A.currentSection).filter((order) => ids.includes(order.id));
        TZ.db.orders = (TZ.db.orders || []).filter((order) => !ids.includes(order.id));
        await Promise.all(orders.map((order) => Promise.resolve(TZ.commitDb('order_delete', TZ.getSession()?.userId, order.id, {
            type: 'order_delete',
            data: { id: order.id }
        }))));
        renderPhysicalOrdersSection(A.currentSection);
        A.updateOrdersBadge();
        A.showToast(`تم حذف ${orders.length} طلبات.`);
    }

    async function deleteBulkDigitalOrders(ids) {
        const orders = cloneOrders(TZ.db.serviceOrders || []).filter((order) => ids.includes(order.id));
        TZ.db.serviceOrders = (TZ.db.serviceOrders || []).filter((order) => !ids.includes(order.id));
        await Promise.all(orders.map((order) => Promise.resolve(TZ.commitDb('service_order_delete', TZ.getSession()?.userId, order.id, {
            type: 'service_order_delete',
            data: { id: order.id }
        }))));
        renderOrders();
        A.updateOrdersBadge();
        A.showToast(`تم حذف ${orders.length} طلبات رقمية.`);
    }

    function mountPhysicalOrderBulkActions(sectionId) {
        if (!bulkActions) return;
        bulkActions.mount({
            scopeKey: sectionId,
            tableSelector: '#physicalOrdersTable',
            status: {
                title: 'تغيير حالة الطلبات المحددة',
                options: PHYSICAL_BULK_STATUS_OPTIONS,
                run: updateBulkPhysicalOrderStatus
            },
            delete: {
                title: 'حذف الطلبات المحددة',
                message: 'سيتم حذف الطلبات المحددة نهائياً. هل تريد المتابعة؟',
                run: deleteBulkPhysicalOrders
            },
            export: {
                filename: `${sectionId}-export.csv`,
                columns: [
                    { key: 'orderId', label: 'رقم الطلب' },
                    { key: 'customer', label: 'العميل' },
                    { key: 'total', label: 'المبلغ' },
                    { key: 'payment', label: 'الدفع' },
                    { key: 'status', label: 'الحالة' },
                    { key: 'createdAt', label: 'التاريخ' }
                ],
                buildRows: (ids) => buildPhysicalExportRows(ids, sectionId)
            }
        });
    }

    function mountDigitalOrderBulkActions() {
        if (!bulkActions) return;
        bulkActions.mount({
            scopeKey: 'digital-orders',
            tableSelector: '#digitalOrdersTable',
            status: {
                title: 'تغيير حالة الطلبات الرقمية المحددة',
                options: DIGITAL_BULK_STATUS_OPTIONS,
                run: updateBulkDigitalOrderStatus
            },
            delete: {
                title: 'حذف الطلبات الرقمية المحددة',
                message: 'سيتم حذف الطلبات الرقمية المحددة نهائياً. هل تريد المتابعة؟',
                run: deleteBulkDigitalOrders
            },
            export: {
                filename: 'digital-orders-export.csv',
                columns: [
                    { key: 'orderId', label: 'رقم الطلب' },
                    { key: 'customer', label: 'العميل' },
                    { key: 'service', label: 'الخدمة' },
                    { key: 'total', label: 'المبلغ' },
                    { key: 'status', label: 'الحالة' },
                    { key: 'createdAt', label: 'التاريخ' }
                ],
                buildRows: buildDigitalExportRows
            }
        });
    }

    function renderPhysicalOrdersSection(sectionId) {
        const current = PHYSICAL_ORDER_SECTIONS.find((section) => section.id === sectionId) || PHYSICAL_ORDER_SECTIONS[0];
        const orders = getPhysicalOrders(current.id);
        A.adminContent.innerHTML = `
            <div class="filter-bar order-tabs-bar">
                <div class="order-nav-tabs">
                    ${PHYSICAL_ORDER_SECTIONS.map((section) => `<button class="btn ${section.id === current.id ? 'btn-primary' : 'btn-outline'} btn-sm" type="button" data-nav-section="${section.id}"><i class="fas ${section.icon}"></i> ${section.title}</button>`).join('')}
                    <button class="btn btn-ghost btn-sm" type="button" data-nav-section="orders"><i class="fas fa-arrow-right"></i> رجوع</button>
                </div>
                <input type="text" id="physicalOrderSearch" placeholder="ابحث برقم الطلب أو اسم العميل أو اسم المنتج...">
            </div>
            <div class="admin-panel">
                <div class="panel-header order-status-header" style="border-right: 4px solid ${current.color};"><h2><i class="fas ${current.icon}" style="color:${current.color}"></i> ${current.title} <span class="order-count-badge" style="background:${current.color}">${orders.length}</span></h2></div>
                <div class="panel-body">${orders.length === 0 ? `<div class="empty-state" style="padding:28px;"><i class="fas ${current.icon}"></i><p>${current.empty}</p></div>` : `${getBulkToolbarMarkup(current.id)}<div class="table-wrap"><table class="data-table" id="physicalOrdersTable" data-paginated="true" data-item-label="طلب" data-page-size-options="10,25,50"><thead><tr>${bulkActions ? bulkActions.getHeaderCheckboxMarkup(current.id) : ''}<th>#</th><th>العميل</th><th>العناصر</th><th>المبلغ</th><th>الدفع</th><th>التاريخ</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody>${orders.map(getPhysicalOrderRow).join('')}</tbody></table></div>`}</div>
            </div>
        `;
        bindOrderNavigation();
        bindPhysicalOrderFilters();
        bindPhysicalOrderActions();
        mountPhysicalOrderBulkActions(current.id);
    }

    function getDeliveryBadgeMarkup(method) {
        if (method === 'delivery') return '<span class="delivery-badge delivery"><i class="fas fa-truck"></i> توصيل</span>';
        if (method === 'pickup') return '<span class="delivery-badge pickup"><i class="fas fa-store"></i> استلام من المحل</span>';
        if (method === 'remote') return '<span class="delivery-badge remote"><i class="fas fa-headset"></i> صيانة عن بعد</span>';
        return '';
    }

    function getCompletionLogLabel(method) {
        if (method === 'delivery') return 'توصيل';
        if (method === 'pickup') return 'استلام من المحل';
        if (method === 'remote') return 'صيانة عن بعد';
        return 'غير محدد';
    }

    function getRepairPanelsMarkup() {
        const orders = cloneOrders(TZ.db.repairBookings).map((booking) => ({ ...booking, customerName: booking.name, items: [{ productName: `[صيانة] ${booking.serviceName || ''} - ${booking.device || ''}` }], total: 0, paymentMethod: '-', deliveryMethod: booking.mode, status: getBookingPipelineStatus(booking), _originalBooking: booking }));
        return REPAIR_ORDER_STATUSES.map((config) => {
            const statusOrders = orders.filter((order) => order.status === config.id);
            return `
                <div class="admin-panel order-status-panel" data-status-section="${config.id}">
                    <div class="panel-header order-status-header" style="border-right: 4px solid ${config.color};"><h2><i class="fas ${config.icon}" style="color:${config.color}"></i> ${config.label} <span class="order-count-badge" style="background:${config.color}">${statusOrders.length}</span></h2></div>
                    <div class="panel-body">${statusOrders.length === 0 ? `<div class="empty-state" style="padding:25px;"><i class="fas fa-inbox"></i><p>لا توجد طلبات</p></div>` : `<div class="table-wrap"><table class="data-table"><thead><tr><th>#</th><th>العميل</th><th>الخدمة</th><th>التاريخ</th><th>الطريقة</th><th>إجراءات</th></tr></thead><tbody>${statusOrders.map((order) => { const summary = getPhysicalOrderSummary(order); const shouldShowBadge = ['awaiting_pickup', 'completed_remote'].includes(order.status); return `<tr><td>${order.id}</td><td>${TZ.escapeHtml(order.customerName || '-')}</td><td>${TZ.escapeHtml(summary.names)}</td><td>${A.formatDate(order.createdAt)}</td><td>${shouldShowBadge ? getDeliveryBadgeMarkup(order.deliveryMethod) : '-'}</td><td class="actions-cell">${order.status === 'under_maintenance' ? `<button class="btn btn-primary btn-sm order-action-btn btn-complete-maintenance" data-id="${order.id}"><i class="fas fa-check-circle"></i> إنهاء الصيانة</button>` : config.nextStatus ? `<button class="btn btn-outline btn-sm order-action-btn btn-booking-status" data-id="${order.id}" data-status="${config.nextStatus}"><i class="fas ${config.nextIcon}"></i> ${config.nextLabel}</button>` : ''}</td></tr>`; }).join('')}</tbody></table></div>`}</div>
                </div>
            `;
        }).join('');
    }

    function renderDigitalOrdersPanel() {
        const orders = cloneOrders(TZ.db.serviceOrders || []);
        return `
            <div class="admin-panel" data-status-section="digital-orders">
                <div class="panel-header order-status-header" style="border-right: 4px solid #00cec9;"><h2><i class="fas fa-bolt" style="color:#00cec9"></i> الطلبات الرقمية <span class="order-count-badge" style="background:#00cec9">${orders.length}</span></h2></div>
                <div class="panel-body">${orders.length === 0 ? `<div class="empty-state" style="padding:25px;"><i class="fas fa-inbox"></i><p>لا توجد طلبات رقمية</p></div>` : `${getBulkToolbarMarkup('digital-orders')}<div class="table-wrap"><table class="data-table" id="digitalOrdersTable" data-paginated="true" data-item-label="طلب" data-page-size-options="10,25,50"><thead><tr>${bulkActions ? bulkActions.getHeaderCheckboxMarkup('digital-orders') : ''}<th>#</th><th>العميل</th><th>الخدمة</th><th>الكمية</th><th>المبلغ</th><th>الحالة</th><th>التاريخ</th><th>إجراءات</th></tr></thead><tbody>${orders.map((order) => { const user = TZ.getUserById(order.userId); return `<tr data-service-order-id="${order.id}">${bulkActions ? bulkActions.getRowCheckboxMarkup('digital-orders', order.id) : ''}<td>${order.id}</td><td>${user ? TZ.escapeHtml(user.fullName) : '-'}</td><td>${TZ.escapeHtml(order.serviceName || order.serviceId || '-')}</td><td>${order.quantity || 0}</td><td>${TZ.formatPrice(order.total || 0)}</td><td><span class="status-badge ${order.status}">${A.statusLabel(order.status)}</span></td><td>${A.formatDate(order.createdAt)}</td><td class="actions-cell">${getDigitalOrderActions(order)}</td></tr>`; }).join('')}</tbody></table></div>`}</div>
            </div>
        `;
    }

    function renderOrders() {
        A.adminContent.innerHTML = `<div class="admin-quick-grid">${PHYSICAL_ORDER_SECTIONS.map(renderOrderRouteCard).join('')}</div>${getRepairPanelsMarkup()}${renderDigitalOrdersPanel()}`;
        bindOrderNavigation();
        bindRepairOrderActions();
        bindDigitalOrderActions();
        mountDigitalOrderBulkActions();
    }

    function bindOrderNavigation() {
        document.querySelectorAll('[data-nav-section]').forEach((button) => button.addEventListener('click', function () { A.renderSection(this.dataset.navSection); }));
    }

    function bindPhysicalOrderFilters() {
        const search = document.getElementById('physicalOrderSearch');
        if (!search) return;
        search.addEventListener('input', function () {
            const query = String(this.value || '').trim().toLowerCase();
            document.querySelectorAll('tbody tr[data-order-search]').forEach((row) => { row.style.display = !query || String(row.dataset.orderSearch || '').includes(query) ? '' : 'none'; });
        });

        if (window.__TZ_ADMIN_ORDERS_PREFILL_QUERY) {
            search.value = String(window.__TZ_ADMIN_ORDERS_PREFILL_QUERY || '');
            window.__TZ_ADMIN_ORDERS_PREFILL_QUERY = '';
            search.dispatchEvent(new Event('input'));
        }
    }

    async function getAdminAccessToken() {
        const { data } = await TZ.supabase.auth.getSession();
        return data?.session?.access_token || '';
    }

    async function requestOrderStatusUpdate(payload) {
        const token = await getAdminAccessToken();
        if (!token) throw new Error('انتهت جلسة الإدارة. سجل الدخول مرة أخرى.');
        const response = await fetch(ADMIN_STATUS_ROUTE, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
        const result = await response.json().catch(() => null);
        if (!response.ok || !result?.success) throw new Error(result?.error || 'تعذر تحديث حالة الطلب.');
        return result;
    }

    async function runServerOrderAction(button, payload, successMessage, rerender) {
        const original = button.innerHTML;
        button.disabled = true;
        try {
            await requestOrderStatusUpdate(payload);
            await TZ.refreshData();
            A.updateOrdersBadge();
            A.showToast(successMessage);
            rerender();
        } catch (error) {
            A.showToast(error instanceof Error ? error.message : 'تعذر تحديث حالة الطلب.');
        } finally {
            button.disabled = false;
            button.innerHTML = original;
        }
    }

    function bindPhysicalOrderActions() {
        document.querySelectorAll('.btn-physical-status').forEach((button) => button.addEventListener('click', function () {
            const order = TZ.db.orders.find((item) => item.id === this.dataset.id);
            if (!order || order.status === this.dataset.status) return;
            void runServerOrderAction(this, { targetType: 'physical_order', orderId: order.id, status: this.dataset.status }, 'تم تحديث حالة الطلب بنجاح.', () => renderPhysicalOrdersSection(A.currentSection));
        }));
    }

    function bindDigitalOrderActions() {
        document.querySelectorAll('.btn-digital-status').forEach((button) => button.addEventListener('click', function () {
            const order = TZ.db.serviceOrders.find((item) => item.id === this.dataset.id);
            if (!order || order.status === this.dataset.status) return;
            A.showConfirmModal('إلغاء الطلب الرقمي', 'سيتم إلغاء الطلب واسترجاع الرصيد إلى المحفظة إذا لم يكن قد اكتمل بعد. هل تريد المتابعة؟', () => {
                void runServerOrderAction(button, { targetType: 'service_order', orderId: order.id, status: button.dataset.status }, 'تم إلغاء الطلب الرقمي ومعالجة الرصيد.', renderOrders);
            });
        }));
    }

    function bindRepairOrderActions() {
        document.querySelectorAll('.btn-booking-status').forEach((button) => {
            button.addEventListener('click', function () {
                const booking = TZ.db.repairBookings.find((item) => item.id === this.dataset.id);
                if (!booking || booking.status === this.dataset.status) return;
                const oldStatus = booking.status;
                booking.status = this.dataset.status;
                TZ.commitDb('booking_status_change', TZ.getSession()?.userId, `صيانة ${booking.id}: ${oldStatus} → ${booking.status}`, { type: 'repair_booking', data: booking });
                A.updateOrdersBadge();
                A.showToast('تم تحديث حالة طلب الصيانة بنجاح.');
                renderOrders();
            });
        });
        document.querySelectorAll('.btn-complete-maintenance').forEach((button) => button.addEventListener('click', () => {
            const booking = TZ.db.repairBookings.find((item) => item.id === button.dataset.id);
            if (booking) showDeliveryChoiceModal(booking);
        }));
    }

    function showDeliveryChoiceModal(record) {
        const choices = [
            { method: 'delivery', className: 'delivery-choice', icon: 'fa-truck', title: 'توصيل', description: 'توصيل الجهاز إلى العميل بعد الصيانة' },
            { method: 'pickup', className: 'pickup-choice', icon: 'fa-store', title: 'استلام من المحل', description: 'العميل يأتي لاستلام الجهاز من المحل' },
            { method: 'remote', className: 'remote-choice', icon: 'fa-headset', title: 'صيانة عن بعد', description: 'تم حل المشكلة بدون استلام الجهاز فعلياً' }
        ];
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `<div class="modal-card"><h3><i class="fas fa-check-circle" style="color:#00b894"></i> إنهاء الصيانة - طلب ${record.id}</h3><p>اختر كيف تم تنفيذ طلب الصيانة أو كيف سيتم تسليم الجهاز.</p><div class="modal-choices">${choices.map((choice) => `<button class="modal-choice-btn ${choice.className}" data-method="${choice.method}"><i class="fas ${choice.icon}"></i><strong>${choice.title}</strong><span>${choice.description}</span></button>`).join('')}</div><button class="btn btn-outline btn-sm modal-cancel-btn" style="margin-top:15px;">إلغاء</button></div>`;
        document.body.appendChild(overlay);
        overlay.querySelector('.modal-cancel-btn').addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', (event) => { if (event.target === overlay) overlay.remove(); });
        overlay.querySelectorAll('.modal-choice-btn').forEach((button) => button.addEventListener('click', function () {
            const oldStatus = record.status;
            record.mode = this.dataset.method;
            record.status = this.dataset.method === 'remote' ? 'completed_remote' : 'awaiting_pickup';
            TZ.commitDb('booking_status_change', TZ.getSession()?.userId, `صيانة ${record.id}: ${oldStatus} → ${record.status} (${getCompletionLogLabel(this.dataset.method)})`, { type: 'repair_booking', data: record });
            A.updateOrdersBadge();
            A.showToast('تم إنهاء الصيانة وتحديث طريقة التسليم.');
            overlay.remove();
            renderOrders();
        }));
    }

    A.sections.orders = renderOrders;
    A.sections['product-orders'] = function () { renderPhysicalOrdersSection('product-orders'); };
    A.sections['accessory-orders'] = function () { renderPhysicalOrdersSection('accessory-orders'); };
})();
