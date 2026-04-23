/**
 * TechZone Admin - Customers Section
 * Lists every registered customer and opens a detailed profile modal.
 */
(function () {
    'use strict';

    var A = window.AdminApp;
    var Helpers = window.AdminCustomerHelpers;
    if (!A || !Helpers) return;

    var searchQuery = '';
    var filterStatus = '';
    var currentPage = 1;
    var PAGE_SIZE = 15;
    var customerProfiles = [];

    function esc(value) {
        return TZ.escapeHtml(value == null ? '' : String(value));
    }

    function getCustomers() {
        return (TZ.db.users || []).filter(function (user) {
            return typeof TZ.isCustomerUser === 'function' ? TZ.isCustomerUser(user) : true;
        }).sort(function (first, second) {
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
            total: list.length,
            pages: Math.ceil(list.length / PAGE_SIZE) || 1
        };
    }

    function buildStatusBadge(status) {
        var normalizedStatus = String(status || 'active').trim() || 'active';
        return '<span class="status-badge ' + esc(normalizedStatus) + '">'
            + esc(Helpers.formatCustomerStatus(normalizedStatus))
            + '</span>';
    }

    function buildNameButton(profile) {
        var user = profile.user || {};
        var userId = profile.authUserId || user.authUserId || user.id;
        var label = user.fullName || user.email || userId || 'عميل';

        return '<button type="button" class="view-customer-btn" data-uid="' + esc(userId) + '"'
            + ' style="background:none;border:0;padding:0;color:var(--primary-light);font:inherit;font-weight:700;cursor:pointer;text-align:right;">'
            + esc(label)
            + '</button>';
    }

    function buildStatCard(label, value) {
        return '<div style="padding:14px;border:1px solid var(--border-color);border-radius:14px;background:var(--bg-lighter);">'
            + '<small style="display:block;color:var(--text-muted);margin-bottom:6px;">' + esc(label) + '</small>'
            + '<strong style="font-size:1.05rem;">' + esc(value) + '</strong>'
            + '</div>';
    }

    function buildDetailRow(label, value) {
        return '<div style="padding:12px 14px;border:1px solid var(--border-color);border-radius:12px;background:rgba(255,255,255,0.02);">'
            + '<small style="display:block;color:var(--text-muted);margin-bottom:4px;">' + esc(label) + '</small>'
            + '<strong style="word-break:break-word;">' + esc(value || '-') + '</strong>'
            + '</div>';
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

    function buildActivityRows(profile) {
        var activity = Array.isArray(profile.activity) ? profile.activity.slice(0, 8) : [];
        if (activity.length === 0) {
            return '<tr><td colspan="5"><div class="empty-state"><i class="fas fa-clock"></i><p>لا توجد أنشطة مرتبطة بهذا العميل بعد</p></div></td></tr>';
        }

        return activity.map(function (item) {
            var createdAt = item.createdAt ? A.formatDateTime(item.createdAt) : '-';
            var statusLabel = A.statusLabel ? A.statusLabel(item.status) : item.status;

            return '<tr>'
                + '<td><strong>' + esc(item.label || item.id) + '</strong></td>'
                + '<td>' + esc(getActivityTypeLabel(item.kind)) + '</td>'
                + '<td>' + esc(getActivityValue(item)) + '</td>'
                + '<td><span class="status-badge ' + esc(item.status || 'pending') + '">' + esc(statusLabel) + '</span></td>'
                + '<td><small>' + esc(createdAt) + '</small></td>'
                + '</tr>';
        }).join('');
    }

    function buildCustomerModalContent(profile) {
        var user = profile.user || {};
        var registrationDate = user.createdAt ? A.formatDateTime(user.createdAt) : '-';
        var lastLoginDate = user.lastLoginAt ? A.formatDateTime(user.lastLoginAt) : 'لا يوجد';
        var lastOrderDate = profile.lastOrderAt ? A.formatDateTime(profile.lastOrderAt) : 'لا يوجد';

        return '<div style="display:grid;gap:18px;max-height:70vh;overflow:auto;padding-top:4px;">'
            + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;">'
            + buildStatCard('طلبات المنتجات', profile.orderCount)
            + buildStatCard('الصيانة', profile.repairCount)
            + buildStatCard('طلبات الإيداع', profile.depositCount)
            + buildStatCard('إجمالي الإنفاق', TZ.formatPrice(profile.totalSpend || 0))
            + '</div>'
            + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;">'
            + buildDetailRow('الاسم الكامل', user.fullName || '-')
            + buildDetailRow('البريد الإلكتروني', user.email || '-')
            + buildDetailRow('الهاتف', user.phone || '-')
            + buildDetailRow('الدولة', user.country || '-')
            + buildDetailRow('الحالة', Helpers.formatCustomerStatus(user.status))
            + buildDetailRow('تاريخ التسجيل', registrationDate)
            + buildDetailRow('آخر تسجيل دخول', lastLoginDate)
            + buildDetailRow('آخر طلب', lastOrderDate)
            + buildDetailRow('اللغة المفضلة', user.preferredLanguage || 'ar')
            + buildDetailRow('العملة المفضلة', user.preferredCurrency || 'JOD')
            + buildDetailRow('معرف الحساب', user.authUserId || user.id || '-')
            + buildDetailRow('النبذة', user.bio || '-')
            + '</div>'
            + '<div class="table-wrap"><table class="data-table"><thead><tr>'
            + '<th>المرجع</th><th>النوع</th><th>القيمة</th><th>الحالة</th><th>التاريخ</th>'
            + '</tr></thead><tbody>' + buildActivityRows(profile) + '</tbody></table></div>'
            + '</div>';
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
            title: 'تفاصيل العميل',
            cancelText: 'إغلاق',
            contentHtml: buildCustomerModalContent(profile),
            hideConfirm: true,
            type: 'info'
        });
    }

    async function toggleCustomerStatus(userId, currentStatus) {
        var newStatus = currentStatus === 'active' ? 'inactive' : 'active';
        var result = await TZ.supabase.from('user_profiles').update({
            status: newStatus,
            updated_at: new Date().toISOString()
        }).eq('user_id', userId);

        if (result.error) {
            A.showErrorToast('CUS-301', 'فشل تحديث حالة العميل');
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
                toggleCustomerStatus(button.dataset.uid, button.dataset.status);
            });
        });
        document.querySelectorAll('.notify-cust-btn').forEach(function (button) {
            button.addEventListener('click', function () {
                window.__TZ_ADMIN_NOTIFICATION_PREFILL = {
                    userId: button.dataset.uid,
                    title: 'رسالة إلى ' + button.dataset.name
                };
                A.renderSection('notifications', { history: 'push' });
            });
        });
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
            + '</tr></thead><tbody>';

        if (page.items.length === 0) {
            html += '<tr><td colspan="8"><div class="empty-state"><i class="fas fa-users"></i><p>لا يوجد عملاء مطابقون</p></div></td></tr>';
        } else {
            page.items.forEach(function (profile) {
                var user = profile.user || {};
                var userId = profile.authUserId || user.authUserId || user.id;
                var createdAt = user.createdAt ? A.formatDate(user.createdAt) : 'غير محدد';
                var toggleTitle = user.status === 'active' ? 'تعطيل' : 'تفعيل';

                html += '<tr data-customer-id="' + esc(userId) + '">'
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
            });
        }
        html += '</tbody></table></div></div>';

        if (page.pages > 1) {
            html += '<div class="admin-table-pagination"><div class="admin-table-pagination-info">عرض '
                + page.items.length + ' من ' + page.total + '</div><div class="admin-table-pagination-controls">';
            for (var pageNumber = 1; pageNumber <= page.pages; pageNumber += 1) {
                html += '<button data-page="' + pageNumber + '" class="' + (pageNumber === currentPage ? 'active' : '') + '">' + pageNumber + '</button>';
            }
            html += '</div></div>';
        }
        html += '</div>';

        A.adminContent.innerHTML = html;
        bindEvents();
    }

    A.sections.customers = renderCustomers;
})();
