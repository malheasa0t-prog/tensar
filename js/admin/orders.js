// ===== TechZone Admin - Orders =====
(function () {
    'use strict';
    const A = window.AdminApp;


    // ===== ORDERS =====
    const ORDER_STATUSES = [
        { id: 'awaiting_delivery', label: 'بانتظار التوصيل', icon: 'fa-truck', color: '#fdcb6e', nextStatus: 'under_maintenance', nextLabel: 'استلام وبدء الصيانة', nextIcon: 'fa-wrench' },
        { id: 'awaiting_device', label: 'بانتظار وصول الجهاز', icon: 'fa-box-open', color: '#e17055', nextStatus: 'under_maintenance', nextLabel: 'استلام وبدء الصيانة', nextIcon: 'fa-wrench' },
        { id: 'under_maintenance', label: 'تحت الصيانة', icon: 'fa-wrench', color: '#a29bfe', nextStatus: 'awaiting_pickup', nextLabel: 'انتهاء الصيانة', nextIcon: 'fa-check-circle' },
        { id: 'awaiting_pickup', label: 'بانتظار الاستلام', icon: 'fa-hand-holding', color: '#00b894', nextStatus: null, nextLabel: null, nextIcon: null }
    ];

    function renderOrders() {
        let orders = TZ.clone(TZ.db.orders);

        // Map repair bookings directly into the orders pipeline
        TZ.db.repairBookings.forEach(b => {
            let st = b.status;
            // Legacy mapping if using old statuses
            if (st === 'pending') st = (b.mode === 'delivery') ? 'awaiting_delivery' : 'awaiting_device';
            if (st === 'in_progress') st = 'under_maintenance';
            if (st === 'completed') st = 'awaiting_pickup';

            orders.push({
                id: b.id,
                userId: b.userId,
                customerName: b.name,
                items: [{ productName: `[صيانة] ${b.serviceName || ''} - ${b.device || ''}` }],
                total: 0, // Determined after maintenance
                paymentMethod: '-',
                deliveryMethod: b.mode,
                status: st,
                createdAt: b.createdAt,
                _isBooking: true,
                _originalBooking: b
            });
        });

        orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        let sectionsHtml = '';
        ORDER_STATUSES.forEach(st => {
            const statusOrders = orders.filter(o => o.status === st.id);
            sectionsHtml += `
                <div class="admin-panel order-status-panel" data-status-section="${st.id}">
                    <div class="panel-header order-status-header" style="border-right: 4px solid ${st.color};">
                        <h2><i class="fas ${st.icon}" style="color:${st.color}"></i> ${st.label} <span class="order-count-badge" style="background:${st.color}">${statusOrders.length}</span></h2>
                    </div>
                    <div class="panel-body">
                        ${statusOrders.length === 0 ? `<div class="empty-state" style="padding:25px;"><i class="fas fa-inbox"></i><p>لا توجد طلبات</p></div>` : `
                        <div class="table-wrap">
                        <table class="data-table">
                            <thead><tr><th>#</th><th>العميل</th><th>المنتجات</th><th>المبلغ</th><th>الدفع</th><th>التاريخ</th><th>التوصيل</th><th>إجراءات</th></tr></thead>
                            <tbody>
                                ${statusOrders.map(o => renderOrderRow(o, st)).join('')}
                            </tbody>
                        </table>
                        </div>`}
                    </div>
                </div>
            `;
        });

        const digitalOrders = TZ.clone(TZ.db.serviceOrders || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        const digitalOrdersHtml = `
            <div class="admin-panel" data-status-section="digital-orders">
                <div class="panel-header order-status-header" style="border-right: 4px solid #00cec9;">
                    <h2><i class="fas fa-bolt" style="color:#00cec9"></i> الطلبات الرقمية <span class="order-count-badge" style="background:#00cec9">${digitalOrders.length}</span></h2>
                </div>
                <div class="panel-body">
                    ${digitalOrders.length === 0 ? `<div class="empty-state" style="padding:25px;"><i class="fas fa-inbox"></i><p>لا توجد طلبات رقمية</p></div>` : `
                    <div class="table-wrap">
                    <table class="data-table">
                        <thead><tr><th>#</th><th>العميل</th><th>الخدمة</th><th>الكمية</th><th>المبلغ</th><th>الحالة</th><th>التاريخ</th></tr></thead>
                        <tbody>
                            ${digitalOrders.map(renderDigitalOrderRow).join('')}
                        </tbody>
                    </table>
                    </div>`}
                </div>
            </div>
        `;

        A.adminContent.innerHTML = `
            <div class="filter-bar">
                <input type="text" id="orderSearch" placeholder="بحث برقم الطلب أو اسم العميل..." style="flex:1;min-width:200px;">
            </div>
            ${sectionsHtml}
            ${digitalOrdersHtml}
        `;
        bindOrderFilters();
        bindOrderActions();
    }

    function renderOrderRow(o, st) {
        const user = o.customerName ? { fullName: o.customerName } : TZ.getUserById(o.userId);
        const itemNames = (o.items || []).map(i => { const p = TZ.getProductById(i.productId); return p ? (p.name || i.productName) : (i.productName || i.productId); }).join('، ');

        let actionBtns = '';
        if (o.status === 'under_maintenance') {
            // When maintenance is done, admin chooses delivery method
            actionBtns += `<button class="action-btn success btn-complete-maintenance" data-id="${o.id}" title="انتهاء الصيانة"><i class="fas fa-check-circle"></i> انتهاء الصيانة</button>`;
        } else if (st.nextStatus) {
            actionBtns += `<button class="action-btn success btn-status" data-id="${o.id}" data-status="${st.nextStatus}" title="${st.nextLabel}"><i class="fas ${st.nextIcon}"></i> ${st.nextLabel}</button>`;
        }
        // Show delivery method badge if awaiting pickup
        let deliveryBadge = '';
        if (o.status === 'awaiting_pickup' && o.deliveryMethod) {
            deliveryBadge = o.deliveryMethod === 'delivery'
                ? '<span class="delivery-badge delivery"><i class="fas fa-truck"></i> توصيل</span>'
                : '<span class="delivery-badge pickup"><i class="fas fa-store"></i> استلام من المحل</span>';
        }

        return `<tr data-order-id="${o.id}" data-customer="${user ? user.fullName : ''}">
            <td>${o.id}</td>
            <td>${user ? TZ.escapeHtml(user.fullName) : '-'}</td>
            <td title="${TZ.escapeHtml(itemNames)}">${TZ.escapeHtml(itemNames.substring(0, 40))}${itemNames.length > 40 ? '...' : ''}</td>
            <td>${TZ.formatPrice(o.total)}</td>
            <td>${A.paymentLabel(o.paymentMethod)}</td>
            <td>${A.formatDate(o.createdAt)}</td>
            <td>${deliveryBadge}</td>
            <td class="actions-cell">
                ${actionBtns}
                <button class="action-btn" title="عرض التفاصيل"><i class="fas fa-eye"></i></button>
            </td>
        </tr>`;
    }

    function renderDigitalOrderRow(order) {
        const user = TZ.getUserById(order.userId);
        return `<tr data-order-id="${order.id}" data-customer="${user ? user.fullName : ''}">
            <td>${order.id}</td>
            <td>${user ? TZ.escapeHtml(user.fullName) : '-'}</td>
            <td>${TZ.escapeHtml(order.serviceName || order.serviceId || '-')}</td>
            <td>${order.quantity || 0}</td>
            <td>${TZ.formatPrice(order.total || 0)}</td>
            <td><span class="status-badge ${order.status}">${A.statusLabel(order.status)}</span></td>
            <td>${A.formatDate(order.createdAt)}</td>
        </tr>`;
    }

    function bindOrderFilters() {
        const search = document.getElementById('orderSearch');
        function filter() {
            const q = search.value.toLowerCase();
            document.querySelectorAll('[data-status-section]').forEach(panel => {
                let anyVisible = false;
                panel.querySelectorAll('tbody tr').forEach(tr => {
                    const id = (tr.dataset.orderId || '').toLowerCase();
                    const customer = (tr.dataset.customer || '').toLowerCase();
                    const show = !q || id.includes(q) || customer.includes(q);
                    tr.style.display = show ? '' : 'none';
                    if (show) anyVisible = true;
                });
            });
        }
        if (search) search.addEventListener('input', filter);
    }

    function bindOrderActions() {
        // Status change buttons
        document.querySelectorAll('.btn-status').forEach(btn => {
            btn.addEventListener('click', function () {
                const orderId = this.dataset.id;
                const newStatus = this.dataset.status;

                if (orderId.startsWith('bk-') || orderId.startsWith('rep-')) {
                    const booking = TZ.db.repairBookings.find(b => b.id === orderId);
                    if (booking && booking.status !== newStatus) {
                        const old = booking.status;
                        booking.status = newStatus;
                        TZ.commitDb('booking_status_change', TZ.getSession()?.userId, `صيانة ${orderId}: ${old} → ${booking.status}`, { type: 'repair_booking', data: booking });
                        A.updateOrdersBadge();
                        A.showToast('تم تحديث حالة طلب الصيانة بنجاح');
                        renderOrders();
                    }
                } else {
                    const order = TZ.db.orders.find(o => o.id === orderId);
                    if (order && order.status !== newStatus) {
                        const old = order.status;
                        order.status = newStatus;
                        TZ.commitDb('order_status_change', TZ.getSession()?.userId, `طلب ${orderId}: ${old} → ${order.status}`, { type: 'order', data: order });
                        A.updateOrdersBadge();
                        A.showToast('تم تحديث حالة الطلب بنجاح');
                        renderOrders();
                    }
                }
            });
        });

        // Complete maintenance - show delivery method choice
        document.querySelectorAll('.btn-complete-maintenance').forEach(btn => {
            btn.addEventListener('click', function () {
                const orderId = this.dataset.id;
                if (orderId.startsWith('bk-') || orderId.startsWith('rep-')) {
                    const booking = TZ.db.repairBookings.find(o => o.id === orderId);
                    if (booking) showDeliveryChoiceModal(booking, true);
                } else {
                    const order = TZ.db.orders.find(o => o.id === orderId);
                    if (order) showDeliveryChoiceModal(order, false);
                }
            });
        });
    }

    function showDeliveryChoiceModal(obj, isBooking = false) {
        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-card">
                <h3><i class="fas fa-check-circle" style="color:#00b894"></i> انتهاء الصيانة - طلب ${obj.id}</h3>
                <p>اختر طريقة تسليم الجهاز للعميل:</p>
                <div class="modal-choices">
                    <button class="modal-choice-btn delivery-choice" data-method="delivery">
                        <i class="fas fa-truck"></i>
                        <strong>توصيل</strong>
                        <span>توصيل الجهاز للعميل</span>
                    </button>
                    <button class="modal-choice-btn pickup-choice" data-method="pickup">
                        <i class="fas fa-store"></i>
                        <strong>استلام من المحل</strong>
                        <span>العميل يأتي لاستلام الجهاز</span>
                    </button>
                </div>
                <button class="btn btn-outline btn-sm modal-cancel-btn" style="margin-top:15px;">إلغاء</button>
            </div>
        `;
        document.body.appendChild(overlay);

        // Cancel
        overlay.querySelector('.modal-cancel-btn').addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

        // Choice buttons
        overlay.querySelectorAll('.modal-choice-btn').forEach(btn => {
            btn.addEventListener('click', function () {
                const method = this.dataset.method;
                const old = obj.status;

                if (isBooking) {
                    obj.status = 'awaiting_pickup';
                    obj.mode = method;
                    TZ.commitDb('booking_status_change', TZ.getSession()?.userId, `صيانة ${obj.id}: ${old} → بانتظار الاستلام (${method === 'delivery' ? 'توصيل' : 'استلام من المحل'})`, { type: 'repair_booking', data: obj });
                } else {
                    obj.status = 'awaiting_pickup';
                    obj.deliveryMethod = method;
                    TZ.commitDb('order_status_change', TZ.getSession()?.userId, `طلب ${obj.id}: ${old} → بانتظار الاستلام (${method === 'delivery' ? 'توصيل' : 'استلام من المحل'})`, { type: 'order', data: obj });
                }

                A.updateOrdersBadge();
                A.showToast('تم إنهاء الصيانة وتحديد طريقة التسليم');
                overlay.remove();
                renderOrders();
            });
        });
    }

    A.sections.orders = renderOrders;
})();
