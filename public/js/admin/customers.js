/**
 * TechZone Admin - Customers Section
 * Renders customer summaries, profile details, and account status actions.
 */
(function () {
    'use strict';

    var A = window.AdminApp;
    var Helpers = window.AdminCustomerHelpers;
    if (!A || !Helpers) return;

    var PAGE_SIZE = 15;
    var searchQuery = '';
    var filterStatus = '';
    var currentPage = 1;
    var customerProfiles = [];

    function esc(value) {
        return TZ.escapeHtml(value == null ? '' : String(value));
    }

    function createGrid(columns) {
        var grid = document.createElement('div');
        grid.style.cssText = 'display:grid;grid-template-columns:' + columns + ';gap:12px;';
        return grid;
    }

    function createInfoCard(label, value, useWordBreak) {
        var card = document.createElement('div');
        var labelElement = document.createElement('small');
        var valueElement = document.createElement('strong');

        card.style.cssText = 'padding:12px 14px;border:1px solid var(--border-color);border-radius:12px;background:rgba(255,255,255,0.02);';
        labelElement.style.cssText = 'display:block;color:var(--text-muted);margin-bottom:6px;';
        labelElement.textContent = label;
        valueElement.textContent = value || '-';
        if (useWordBreak) valueElement.style.wordBreak = 'break-word';
        card.appendChild(labelElement);
        card.appendChild(valueElement);
        return card;
    }

    function appendInfoCards(grid, items, useWordBreak) {
        items.forEach(function (item) {
            grid.appendChild(createInfoCard(item[0], item[1], useWordBreak));
        });
    }

    function getCustomers() {
        return (TZ.db.users || [])
            .filter(function (user) {
                return typeof TZ.isCustomerUser === 'function' ? TZ.isCustomerUser(user) : true;
            })
            .sort(function (first, second) {
                return new Date(second.createdAt || 0) - new Date(first.createdAt || 0);
            });
    }

    function buildCustomerProfiles() {
        return getCustomers().map(function (user) {
            return Helpers.buildCustomerProfile({
                user: user,
                orders: TZ.db.orders || [],
                repairBookings: TZ.db.repairBookings || [],
                deposits: TZ.db.deposits || []
            });
        });
    }

    function paginate(list) {
        var start = (currentPage - 1) * PAGE_SIZE;
        return {
            items: list.slice(start, start + PAGE_SIZE),
            pages: Math.ceil(list.length / PAGE_SIZE) || 1,
            total: list.length
        };
    }

    function buildStatusBadge(status) {
        var normalizedStatus = String(status || 'active').trim() || 'active';
        return '<span class="status-badge ' + esc(normalizedStatus) + '">'
            + esc(Helpers.formatCustomerStatus(normalizedStatus))
            + '</span>';
    }

    function resolveCustomerId(profile) {
        var user = profile.user || {};
        return profile.authUserId || user.authUserId || user.id || '';
    }

    function buildNameButton(profile) {
        var user = profile.user || {};
        var label = user.fullName || user.email || resolveCustomerId(profile) || 'عميل';
        return '<button type="button" class="view-customer-btn" data-uid="' + esc(resolveCustomerId(profile)) + '"'
            + ' style="background:none;border:0;padding:0;color:var(--primary-light);font:inherit;font-weight:700;cursor:pointer;text-align:right;">'
            + esc(label)
            + '</button>';
    }

    function getActivityTypeLabel(kind) {
        if (kind === 'repair') return 'صيانة';
        if (kind === 'deposit') return 'إيداع';
        return 'طلب';
    }

    function getActivityValue(activity) {
        if (activity.kind === 'repair') return activity.title || '-';
        return Number(activity.amount || 0) > 0 ? TZ.formatPrice(activity.amount || 0) : '-';
    }

    function appendActivityRows(tbody, profile) {
        var activity = Array.isArray(profile.activity) ? profile.activity.slice(0, 8) : [];
        if (activity.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><i class="fas fa-clock"></i><p>لا توجد أنشطة مرتبطة بهذا العميل بعد</p></div></td></tr>';
            return;
        }

        activity.forEach(function (item) {
            var row = document.createElement('tr');
            var createdAt = item.createdAt ? A.formatDateTime(item.createdAt) : '-';
            var statusLabel = A.statusLabel ? A.statusLabel(item.status) : item.status;
            var cells = [
                '<strong>' + esc(item.label || item.id || '-') + '</strong>',
                esc(getActivityTypeLabel(item.kind)),
                esc(getActivityValue(item)),
                '<span class="status-badge ' + esc(String(item.status || 'pending').trim().toLowerCase()) + '">' + esc(statusLabel || '-') + '</span>',
                '<small>' + esc(createdAt) + '</small>'
            ];

            cells.forEach(function (cellMarkup) {
                var cell = document.createElement('td');
                cell.innerHTML = cellMarkup;
                row.appendChild(cell);
            });
            tbody.appendChild(row);
        });
    }

    function buildCustomerModalContent(profile) {
        var user = profile.user || {};
        var root = document.createElement('div');
        var statsGrid = createGrid('repeat(auto-fit,minmax(140px,1fr))');
        var detailsGrid = createGrid('repeat(auto-fit,minmax(180px,1fr))');
        var tableWrap = document.createElement('div');
        var table = document.createElement('table');
        var thead = document.createElement('thead');
        var tbody = document.createElement('tbody');
        var stats = [
            ['طلبات المنتجات', String(profile.orderCount || 0)],
            ['الصيانة', String(profile.repairCount || 0)],
            ['طلبات الإيداع', String(profile.depositCount || 0)],
            ['إجمالي الإنفاق', TZ.formatPrice(profile.totalSpend || 0)]
        ];
        var details = [
            ['الاسم الكامل', user.fullName || '-'],
            ['البريد الإلكتروني', user.email || '-'],
            ['الهاتف', user.phone || '-'],
            ['الدولة', user.country || '-'],
            ['الحالة', Helpers.formatCustomerStatus(user.status)],
            ['تاريخ التسجيل', user.createdAt ? A.formatDateTime(user.createdAt) : '-'],
            ['آخر تسجيل دخول', user.lastLoginAt ? A.formatDateTime(user.lastLoginAt) : 'لا يوجد'],
            ['آخر طلب', profile.lastOrderAt ? A.formatDateTime(profile.lastOrderAt) : 'لا يوجد'],
            ['اللغة المفضلة', user.preferredLanguage || 'ar'],
            ['العملة المفضلة', user.preferredCurrency || 'JOD'],
            ['معرف الحساب', user.authUserId || user.id || '-'],
            ['النبذة', user.bio || '-']
        ];

        root.style.cssText = 'display:grid;gap:18px;max-height:70vh;overflow:auto;padding-top:4px;';
        appendInfoCards(statsGrid, stats, false);
        appendInfoCards(detailsGrid, details, true);

        thead.innerHTML = '<tr><th>المرجع</th><th>النوع</th><th>القيمة</th><th>الحالة</th><th>التاريخ</th></tr>';
        table.className = 'data-table';
        table.appendChild(thead);
        appendActivityRows(tbody, profile);
        table.appendChild(tbody);

        tableWrap.className = 'table-wrap';
        tableWrap.appendChild(table);
        root.appendChild(statsGrid);
        root.appendChild(detailsGrid);
        root.appendChild(tableWrap);
        return root;
    }

    function findCustomerProfile(userId) {
        return customerProfiles.find(function (profile) {
            return Helpers.matchesCustomer({ id: userId, authUserId: userId }, profile.user);
        }) || null;
    }

    function openCustomerDetails(userId) {
        var profile = findCustomerProfile(userId);
        if (!profile) {
            A.showErrorToast('CUS-302', 'تعذر تحميل تفاصيل العميل.');
            return;
        }

        void A.showModal({
            cancelText: 'إغلاق',
            contentNode: buildCustomerModalContent(profile),
            hideConfirm: true,
            title: 'تفاصيل العميل',
            type: 'info'
        });
    }

    async function toggleCustomerStatus(userId, currentStatus) {
        var newStatus = currentStatus === 'active' ? 'inactive' : 'active';
        var confirmMessage = 'هل تريد تغيير حالة العميل إلى: ' + (newStatus === 'active' ? 'نشط' : 'غير نشط') + '؟';
        if (!confirm(confirmMessage)) return;

        var result = await TZ.supabase.rpc('admin_toggle_customer_status', {
            p_target_user_id: userId
        });

        if (result.error) {
            var message = String(result.error.message || '');
            if (message.includes('Not authorized')) {
                A.showErrorToast('CUS-302', 'صلاحيات غير كافية لتغيير حالة العميل');
            } else if (message.includes('Cannot change status of admin')) {
                A.showErrorToast('CUS-303', 'لا يمكن تغيير حالة مستخدم إداري');
            } else {
                A.showErrorToast('CUS-301', 'فشل تحديث حالة العميل');
            }
            return;
        }

        A.showToast('تم تحديث حالة العميل');
        await TZ.refreshData();
        renderCustomers();
    }

    function bindEvents() {
        document.getElementById('custSearch')?.addEventListener('input', function () {
            searchQuery = this.value;
            currentPage = 1;
            renderCustomers();
        });
        document.getElementById('custStatusFilter')?.addEventListener('change', function () {
            filterStatus = this.value;
            currentPage = 1;
            renderCustomers();
        });
        document.querySelectorAll('[data-page]').forEach(function (button) {
            button.addEventListener('click', function () {
                currentPage = parseInt(button.dataset.page, 10);
                renderCustomers();
            });
        });
        document.querySelectorAll('.view-customer-btn, .view-customer-detail-btn').forEach(function (button) {
            button.addEventListener('click', function () {
                openCustomerDetails(button.dataset.uid);
            });
        });
        document.querySelectorAll('.toggle-cust-btn').forEach(function (button) {
            button.addEventListener('click', function () {
                void toggleCustomerStatus(button.dataset.uid, button.dataset.status);
            });
        });
        document.querySelectorAll('.notify-cust-btn').forEach(function (button) {
            button.addEventListener('click', function () {
                window.__TZ_ADMIN_NOTIFICATION_PREFILL = {
                    title: 'رسالة إلى ' + button.dataset.name,
                    userId: button.dataset.uid
                };
                A.renderSection('notifications', { history: 'push' });
            });
        });
    }

    function buildPaginationMarkup(page) {
        if (page.pages <= 1) return '';

        var html = '<div class="admin-table-pagination"><div class="admin-table-pagination-info">عرض '
            + page.items.length + ' من ' + page.total + '</div><div class="admin-table-pagination-controls">';
        for (var pageNumber = 1; pageNumber <= page.pages; pageNumber += 1) {
            html += '<button data-page="' + pageNumber + '" class="' + (pageNumber === currentPage ? 'active' : '') + '">' + pageNumber + '</button>';
        }
        return html + '</div></div>';
    }

    function buildCustomerRowsMarkup(items) {
        if (items.length === 0) {
            return '<tr><td colspan="8"><div class="empty-state"><i class="fas fa-users"></i><p>لا يوجد عملاء مطابقون</p></div></td></tr>';
        }

        return items.map(function (profile) {
            var user = profile.user || {};
            var userId = resolveCustomerId(profile);
            var createdAt = user.createdAt ? A.formatDate(user.createdAt) : 'غير محدد';
            var toggleTitle = user.status === 'active' ? 'تعطيل' : 'تفعيل';

            return '<tr data-customer-id="' + esc(userId) + '">'
                + '<td>' + buildNameButton(profile) + '<br><small style="color:var(--text-muted);">سجّل في: ' + esc(createdAt) + '</small></td>'
                + '<td><small>' + esc(user.email || '-') + '</small></td>'
                + '<td><small>' + esc(user.phone || '-') + '</small></td>'
                + '<td>' + profile.orderCount + '</td>'
                + '<td>' + profile.repairCount + '</td>'
                + '<td style="font-weight:600;color:#00b894;">' + TZ.formatPrice(profile.totalSpend) + '</td>'
                + '<td>' + buildStatusBadge(user.status) + '</td>'
                + '<td class="actions-cell">'
                + '<button class="action-btn view-customer-detail-btn" data-uid="' + esc(userId) + '" title="عرض التفاصيل"><i class="fas fa-eye"></i></button>'
                + '<button class="action-btn toggle-cust-btn" data-uid="' + esc(userId) + '" data-status="' + esc(user.status || 'active') + '" title="' + esc(toggleTitle) + '"><i class="fas fa-' + (user.status === 'active' ? 'ban' : 'check') + '"></i></button>'
                + '<button class="action-btn notify-cust-btn" data-uid="' + esc(userId) + '" data-name="' + esc(user.fullName || 'عميل') + '" title="إرسال إشعار"><i class="fas fa-bell"></i></button>'
                + '</td></tr>';
        }).join('');
    }

    function renderCustomers() {
        customerProfiles = buildCustomerProfiles();
        var filteredProfiles = Helpers.filterCustomerProfiles({
            profiles: customerProfiles,
            searchQuery: searchQuery,
            statusFilter: filterStatus
        });
        var page = paginate(filteredProfiles);
        var html = '<div class="admin-section-header"><div><h2><i class="fas fa-users"></i> العملاء</h2><p>'
            + customerProfiles.length + ' عميل مسجل</p></div></div>';

        html += '<div class="filter-bar">'
            + '<input type="search" id="custSearch" placeholder="ابحث بالاسم أو البريد أو الهاتف..." value="' + esc(searchQuery) + '">'
            + '<select id="custStatusFilter"><option value="">كل الحالات</option>'
            + '<option value="active"' + (filterStatus === 'active' ? ' selected' : '') + '>نشط</option>'
            + '<option value="inactive"' + (filterStatus === 'inactive' ? ' selected' : '') + '>معطل</option>'
            + '<option value="banned"' + (filterStatus === 'banned' ? ' selected' : '') + '>محظور</option>'
            + '</select></div>';

        html += '<div class="admin-panel"><div class="panel-body"><div class="table-wrap"><table class="data-table"><thead><tr>'
            + '<th>العميل</th><th>البريد</th><th>الهاتف</th><th>الطلبات</th><th>الصيانة</th><th>الإنفاق</th><th>الحالة</th><th>إجراءات</th>'
            + '</tr></thead><tbody>'
            + buildCustomerRowsMarkup(page.items)
            + '</tbody></table></div></div>'
            + buildPaginationMarkup(page)
            + '</div>';

        A.adminContent.innerHTML = html;
        bindEvents();
    }

    A.sections.customers = renderCustomers;
})();
