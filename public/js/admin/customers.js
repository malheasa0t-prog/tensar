// ===== TechZone Admin - Customers =====
(function () {
    'use strict';

    const A = window.AdminApp;
    const bulkActions = window.AdminBulkActions;
    const H = window.AdminCustomerHelpers;
    const state = { searchQuery: '', selectedCustomerId: '', statusFilter: 'all' };

    if (!A || !H) return;

    function getCustomers() {
        return (TZ.db.users || []).filter((user) => TZ.isCustomerUser(user));
    }

    function buildProfiles() {
        return getCustomers().map((user) => H.buildCustomerProfile({
            user: user,
            orders: TZ.db.orders || [],
            serviceOrders: TZ.db.serviceOrders || []
        }));
    }

    function getVisibleProfiles() {
        return H.filterCustomerProfiles({
            profiles: buildProfiles(),
            searchQuery: state.searchQuery,
            statusFilter: state.statusFilter
        });
    }

    function getSelectedProfile(profiles) {
        const fallbackProfile = profiles[0] || null;
        const selectedProfile = profiles.find((profile) => profile.customer.id === state.selectedCustomerId) || fallbackProfile;
        state.selectedCustomerId = selectedProfile?.customer.id || '';
        return selectedProfile;
    }

    function buildCustomerExportRows(ids) {
        return buildProfiles()
            .filter((profile) => ids.includes(profile.customer.id))
            .map((profile) => ({
                createdAt: A.formatDate(profile.createdAt),
                email: profile.customer.email || '',
                fullName: profile.customer.fullName || '',
                orders: profile.orderCount,
                phone: profile.customer.phone || '',
                status: profile.status,
                totalSpend: TZ.formatPrice(profile.totalSpend || 0)
            }));
    }

    async function updateCustomerStatus(ids, status) {
        const customers = getCustomers().filter((customer) => ids.includes(customer.id));
        await Promise.all(customers.map((customer) => {
            customer.status = status;
            return Promise.resolve(TZ.commitDb('customer_status_change', TZ.getSession()?.userId, `${customer.fullName}: ${status}`, {
                type: 'user',
                data: customer
            }));
        }));
        renderCustomers();
        A.showToast(`تم تحديث حالة ${customers.length} عملاء.`);
    }

    function mountCustomerBulkActions() {
        if (!bulkActions) return;
        bulkActions.mount({
            scopeKey: 'customers',
            tableSelector: '#customersTable',
            status: {
                title: 'تغيير حالة العملاء المحددين',
                options: [{ value: 'active', label: 'نشط' }, { value: 'inactive', label: 'معطل' }],
                run: updateCustomerStatus
            },
            export: {
                filename: 'customers-export.csv',
                columns: [
                    { key: 'fullName', label: 'الاسم' },
                    { key: 'email', label: 'البريد' },
                    { key: 'phone', label: 'الجوال' },
                    { key: 'orders', label: 'الطلبات' },
                    { key: 'totalSpend', label: 'إجمالي المشتريات' },
                    { key: 'status', label: 'الحالة' },
                    { key: 'createdAt', label: 'تاريخ التسجيل' }
                ],
                buildRows: buildCustomerExportRows
            }
        });
    }

    function openNotificationPrefill(profile) {
        window.__TZ_ADMIN_NOTIFICATION_PREFILL = {
            audience: 'single',
            title: `رسالة إلى ${profile.customer.fullName || 'العميل'}`,
            userId: profile.customer.id
        };
        A.renderSection('notifications', { history: 'push' });
    }

    function openOrdersForCustomer(profile) {
        window.__TZ_ADMIN_ORDERS_PREFILL_QUERY = profile.customer.fullName || profile.customer.email || profile.customer.phone || profile.customer.id;
        A.renderSection('orders', { history: 'push' });
    }

    function renderSummaryCards(profiles) {
        const activeCount = profiles.filter((profile) => profile.status === 'active').length;
        const totalSpend = profiles.reduce((sum, profile) => sum + Number(profile.totalSpend || 0), 0);
        return `
            <div class="admin-customer-summary-grid">
                <article class="admin-customer-summary-card"><strong>${profiles.length}</strong><span>العملاء المطابقون</span></article>
                <article class="admin-customer-summary-card"><strong>${activeCount}</strong><span>حسابات نشطة</span></article>
                <article class="admin-customer-summary-card"><strong>${TZ.formatPrice(totalSpend)}</strong><span>إجمالي المشتريات</span></article>
            </div>
        `;
    }

    function renderDetailPanel(profile) {
        if (!profile) {
            return '<div class="admin-customer-empty">اختر عميلاً لعرض تفاصيله وتاريخ نشاطه.</div>';
        }

        const customer = profile.customer;
        return `
            <section class="admin-panel admin-customer-detail-panel">
                <div class="panel-header">
                    <h2><i class="fas fa-address-card"></i> ${TZ.escapeHtml(customer.fullName || 'عميل')}</h2>
                </div>
                <div class="panel-body padded">
                    <div class="admin-customer-metrics">
                        <div><span>تاريخ التسجيل</span><strong>${A.formatDate(profile.createdAt)}</strong></div>
                        <div><span>آخر طلب</span><strong>${A.formatDate(profile.lastOrderAt)}</strong></div>
                        <div><span>إجمالي الطلبات</span><strong>${profile.orderCount}</strong></div>
                        <div><span>إجمالي المشتريات</span><strong>${TZ.formatPrice(profile.totalSpend)}</strong></div>
                    </div>
                    <div class="admin-customer-contact">
                        <span><i class="fas fa-envelope"></i> ${TZ.escapeHtml(customer.email || '-')}</span>
                        <span dir="ltr"><i class="fas fa-phone"></i> ${TZ.escapeHtml(customer.phone || '-')}</span>
                        <span><i class="fas fa-user-clock"></i> ${A.formatDate(profile.lastLoginAt)}</span>
                    </div>
                    <div class="admin-customer-actions">
                        <button type="button" class="btn btn-outline btn-sm" data-customer-action="orders" data-customer-id="${customer.id}"><i class="fas fa-box-open"></i> عرض الطلبات</button>
                        <button type="button" class="btn btn-outline btn-sm" data-customer-action="notify" data-customer-id="${customer.id}"><i class="fas fa-bell"></i> إرسال إشعار</button>
                        <button type="button" class="btn ${profile.status === 'active' ? 'btn-danger' : 'btn-primary'} btn-sm" data-customer-action="toggle-status" data-customer-id="${customer.id}">
                            <i class="fas ${profile.status === 'active' ? 'fa-user-slash' : 'fa-user-check'}"></i>
                            ${profile.status === 'active' ? 'تعطيل الحساب' : 'تفعيل الحساب'}
                        </button>
                    </div>
                    <div class="admin-customer-order-list">
                        ${(profile.recentOrders.length ? profile.recentOrders : []).map((order) => `
                            <article class="admin-customer-order-item">
                                <div>
                                    <strong>${TZ.escapeHtml(order.label)}</strong>
                                    <small>${A.statusLabel(order.status)} • ${A.formatDateTime(order.createdAt)}</small>
                                </div>
                                <span>${TZ.formatPrice(order.total)}</span>
                            </article>
                        `).join('') || '<div class="admin-customer-empty">لا توجد طلبات مسجلة لهذا العميل.</div>'}
                    </div>
                </div>
            </section>
        `;
    }

    function bindEvents(profiles) {
        document.getElementById('customerSearch')?.addEventListener('input', function () {
            state.searchQuery = String(this.value || '');
            renderCustomers();
        });
        document.getElementById('customerStatusFilter')?.addEventListener('change', function () {
            state.statusFilter = String(this.value || 'all');
            renderCustomers();
        });
        document.querySelectorAll('[data-customer-select]').forEach((button) => {
            button.addEventListener('click', function () {
                state.selectedCustomerId = this.dataset.customerSelect;
                renderCustomers();
            });
        });
        document.querySelectorAll('[data-customer-action]').forEach((button) => {
            button.addEventListener('click', async function () {
                const profile = profiles.find((item) => item.customer.id === this.dataset.customerId);
                if (!profile) return;
                if (this.dataset.customerAction === 'orders') return openOrdersForCustomer(profile);
                if (this.dataset.customerAction === 'notify') return openNotificationPrefill(profile);
                if (this.dataset.customerAction !== 'toggle-status') return;

                const nextStatus = profile.status === 'active' ? 'inactive' : 'active';
                const confirmed = await A.showConfirmModal({
                    type: nextStatus === 'inactive' ? 'danger' : 'success',
                    title: nextStatus === 'inactive' ? 'تعطيل حساب العميل' : 'إعادة تفعيل الحساب',
                    message: `هل تريد ${nextStatus === 'inactive' ? 'تعطيل' : 'تفعيل'} حساب ${profile.customer.fullName}؟`,
                    confirmText: nextStatus === 'inactive' ? 'تعطيل' : 'تفعيل',
                    cancelText: 'إلغاء'
                });
                if (confirmed) await updateCustomerStatus([profile.customer.id], nextStatus);
            });
        });

        mountCustomerBulkActions();
    }

    function renderCustomers() {
        const visibleProfiles = getVisibleProfiles();
        const selectedProfile = getSelectedProfile(visibleProfiles);

        A.adminContent.innerHTML = `
            <div class="filter-bar">
                <input type="text" id="customerSearch" placeholder="ابحث باسم العميل أو بريده أو رقمه..." value="${TZ.escapeHtml(state.searchQuery)}" style="flex:1;min-width:220px;">
                <select id="customerStatusFilter">
                    <option value="all" ${state.statusFilter === 'all' ? 'selected' : ''}>كل الحالات</option>
                    <option value="active" ${state.statusFilter === 'active' ? 'selected' : ''}>نشط</option>
                    <option value="inactive" ${state.statusFilter === 'inactive' ? 'selected' : ''}>معطل</option>
                </select>
            </div>
            ${renderSummaryCards(visibleProfiles)}
            <div class="admin-customer-layout">
                <div class="admin-panel">
                    <div class="panel-header"><h2><i class="fas fa-users"></i> العملاء (${visibleProfiles.length})</h2></div>
                    <div class="panel-body">
                        ${bulkActions ? bulkActions.getToolbarMarkup({ scopeKey: 'customers', itemLabel: 'عملاء', actions: { status: true, export: true } }) : ''}
                        <div class="table-wrap">
                            <table class="data-table" id="customersTable" data-paginated="true" data-item-label="عميل" data-page-size-options="10,25,50">
                                <thead>
                                    <tr>
                                        ${bulkActions ? bulkActions.getHeaderCheckboxMarkup('customers') : ''}
                                        <th>الاسم</th>
                                        <th>التواصل</th>
                                        <th>الطلبات</th>
                                        <th>المشتريات</th>
                                        <th>آخر طلب</th>
                                        <th>الحالة</th>
                                        <th>إجراءات</th>
                                    </tr>
                                </thead>
                                <tbody id="customersTableBody">
                                    ${visibleProfiles.map((profile) => `
                                        <tr data-customer-id="${profile.customer.id}" data-customer-search="${TZ.escapeHtml(profile.searchableText)}" class="${profile.customer.id === state.selectedCustomerId ? 'is-selected' : ''}">
                                            ${bulkActions ? bulkActions.getRowCheckboxMarkup('customers', profile.customer.id) : ''}
                                            <td><button type="button" class="admin-customer-link" data-customer-select="${profile.customer.id}"><strong>${TZ.escapeHtml(profile.customer.fullName || '-')}</strong></button></td>
                                            <td><div class="admin-customer-contact-stack"><span>${TZ.escapeHtml(profile.customer.email || '-')}</span><small dir="ltr">${TZ.escapeHtml(profile.customer.phone || '-')}</small></div></td>
                                            <td>${profile.orderCount}</td>
                                            <td>${TZ.formatPrice(profile.totalSpend)}</td>
                                            <td>${A.formatDate(profile.lastOrderAt)}</td>
                                            <td><span class="status-badge ${profile.status}">${profile.status === 'active' ? 'نشط' : 'معطل'}</span></td>
                                            <td class="actions-cell">
                                                <button type="button" class="btn btn-outline btn-sm" data-customer-select="${profile.customer.id}"><i class="fas fa-eye"></i> تفاصيل</button>
                                                <button type="button" class="btn btn-outline btn-sm" data-customer-action="notify" data-customer-id="${profile.customer.id}"><i class="fas fa-bell"></i> إشعار</button>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                ${renderDetailPanel(selectedProfile)}
            </div>
        `;

        bindEvents(visibleProfiles);
    }

    A.sections.customers = renderCustomers;
})();
