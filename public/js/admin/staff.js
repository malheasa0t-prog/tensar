/**
 * TechZone Admin — Staff & Permissions Section
 *
 * Lets a full admin promote a customer to a staff member (employee/technician)
 * and grant/revoke granular per-section permissions (view / manage). All writes
 * go through the guarded service-role RPCs (admin_set_staff_role,
 * admin_set_staff_permission); the server is the real enforcement boundary.
 */
(function () {
    'use strict';

    var A = window.AdminApp;
    if (!A) return;

    var PERMS_TABLE = 'staff_permissions';
    var STAFF_ROLES = ['employee', 'technician'];

    // Mirror of lib/adminPermissions.PERMISSION_SECTIONS (the grantable units).
    // `staff` is intentionally omitted — it can never be delegated to staff.
    var SECTIONS = [
        { key: 'dashboard', label: 'لوحة المعلومات', manageable: false },
        { key: 'orders', label: 'الطلبات', manageable: true },
        { key: 'products', label: 'المنتجات', manageable: true },
        { key: 'categories', label: 'الفئات', manageable: true },
        { key: 'services', label: 'الخدمات', manageable: true },
        { key: 'customers', label: 'العملاء والمحافظ', manageable: true },
        { key: 'sellers', label: 'البائعون', manageable: true },
        { key: 'deposits', label: 'الإيداعات', manageable: true },
        { key: 'coupons', label: 'الكوبونات', manageable: true },
        { key: 'refunds', label: 'طلبات الاسترجاع', manageable: true },
        { key: 'messages', label: 'رسائل التواصل', manageable: true },
        { key: 'chats', label: 'الدردشات', manageable: true },
        { key: 'notifications', label: 'الإشعارات', manageable: true },
        { key: 'settings', label: 'الإعدادات والمنصة', manageable: true },
        { key: 'logs', label: 'سجل العمليات', manageable: false }
    ];

    var ROLE_LABELS = { employee: 'موظف مبيعات', technician: 'فني صيانة' };

    function esc(v) { return TZ.escapeHtml(v == null ? '' : String(v)); }

    function isFullAdmin() {
        var access = window.__TZ_ADMIN_ACCESS;
        return !access || access.isFullAdmin === true;
    }

    function getAllUsers() { return TZ.db.users || []; }

    function getStaff() {
        return getAllUsers().filter(function (u) { return STAFF_ROLES.indexOf(u.role) >= 0; });
    }

    function getPromotableUsers() {
        return getAllUsers().filter(function (u) { return u.role === 'customer' || u.role === 'user'; });
    }

    /** Resolves the auth (uuid) id used by the staff RPCs/permission rows. */
    function authIdOf(user) {
        return user && (user.authUserId || user.auth_user_id || user.userId || user.id);
    }

    async function loadStaffPermissions(authUserId) {
        var res = await TZ.supabase.from(PERMS_TABLE)
            .select('section,can_view,can_manage')
            .eq('user_id', authUserId);
        return res.data || [];
    }

    async function setStaffRole(targetAuthId, role) {
        var actor = await TZ.getSupabaseUser();
        if (!actor) { A.showErrorToast('STF-300', 'انتهت الجلسة. أعد تسجيل الدخول.'); return false; }
        var res = await TZ.supabase.rpc('admin_set_staff_role', {
            p_actor_id: actor.id,
            p_target_user_id: targetAuthId,
            p_role: role
        });
        if (res.error) {
            A.showErrorToast('STF-301', 'تعذر تحديث دور الموظف: ' + String(res.error.message || ''));
            return false;
        }
        return true;
    }

    async function setStaffPermission(targetAuthId, section, canView, canManage) {
        var actor = await TZ.getSupabaseUser();
        if (!actor) { A.showErrorToast('STF-302', 'انتهت الجلسة. أعد تسجيل الدخول.'); return false; }
        var res = await TZ.supabase.rpc('admin_set_staff_permission', {
            p_actor_id: actor.id,
            p_target_user_id: targetAuthId,
            p_section: section,
            p_can_view: canView,
            p_can_manage: canManage
        });
        if (res.error) {
            A.showErrorToast('STF-303', 'تعذر حفظ صلاحية القسم "' + section + '": ' + String(res.error.message || ''));
            return false;
        }
        return true;
    }

    /** Renders the permission grid for a single staff member. */
    async function renderPermissionEditor(staff) {
        var authId = authIdOf(staff);
        A.adminContent.innerHTML = '<div class="admin-section-header"><div><h2><i class="fas fa-spinner fa-spin"></i> جاري التحميل...</h2></div></div>';

        var existing = await loadStaffPermissions(authId);
        var current = {};
        existing.forEach(function (row) {
            current[row.section] = { view: row.can_view === true || row.can_manage === true, manage: row.can_manage === true };
        });

        var html = '<div class="admin-section-header"><div>'
            + '<h2><i class="fas fa-user-shield"></i> صلاحيات: ' + esc(staff.fullName || staff.email || authId) + '</h2>'
            + '<p>الدور: ' + esc(ROLE_LABELS[staff.role] || staff.role) + ' — فعّل ما يُسمح له بعرضه أو إدارته.</p>'
            + '</div></div>';

        html += '<div class="admin-panel"><div class="panel-body padded"><form id="permForm" class="admin-form">';
        html += '<div class="table-wrap"><table class="data-table"><thead><tr>'
            + '<th>القسم</th><th style="width:120px;text-align:center;">عرض</th><th style="width:120px;text-align:center;">إدارة</th>'
            + '</tr></thead><tbody>';

        SECTIONS.forEach(function (section) {
            var grant = current[section.key] || { view: false, manage: false };
            html += '<tr>'
                + '<td><strong>' + esc(section.label) + '</strong></td>'
                + '<td style="text-align:center;"><input type="checkbox" class="perm-view" data-key="' + esc(section.key) + '"' + (grant.view ? ' checked' : '') + '></td>'
                + '<td style="text-align:center;">'
                + (section.manageable
                    ? '<input type="checkbox" class="perm-manage" data-key="' + esc(section.key) + '"' + (grant.manage ? ' checked' : '') + '>'
                    : '<span style="color:var(--text-muted);">—</span>')
                + '</td></tr>';
        });

        html += '</tbody></table></div>';
        html += '<div class="admin-form-actions" style="margin-top:1.5rem;">'
            + '<button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> حفظ الصلاحيات</button>'
            + '<button type="button" class="btn btn-outline" id="permBackBtn"><i class="fas fa-arrow-right"></i> رجوع</button>'
            + '</div></form></div></div>';

        A.adminContent.innerHTML = html;

        // Checking "إدارة" implies "عرض".
        A.adminContent.querySelectorAll('.perm-manage').forEach(function (manageBox) {
            manageBox.addEventListener('change', function () {
                if (!this.checked) return;
                var viewBox = A.adminContent.querySelector('.perm-view[data-key="' + this.dataset.key + '"]');
                if (viewBox) viewBox.checked = true;
            });
        });

        document.getElementById('permBackBtn').addEventListener('click', renderStaff);

        document.getElementById('permForm').addEventListener('submit', async function (e) {
            e.preventDefault();
            var btn = this.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';

            var desired = {};
            SECTIONS.forEach(function (section) { desired[section.key] = { view: false, manage: false }; });
            A.adminContent.querySelectorAll('.perm-view').forEach(function (box) {
                desired[box.dataset.key].view = box.checked;
            });
            A.adminContent.querySelectorAll('.perm-manage').forEach(function (box) {
                desired[box.dataset.key].manage = box.checked;
            });

            // Only write sections whose grant actually changed.
            var ok = true;
            for (var i = 0; i < SECTIONS.length; i++) {
                var key = SECTIONS[i].key;
                var was = current[key] || { view: false, manage: false };
                var now = desired[key];
                var nowView = now.view || now.manage;
                if (was.view === nowView && was.manage === now.manage) continue;
                var saved = await setStaffPermission(authId, key, nowView, now.manage);
                if (!saved) { ok = false; break; }
            }

            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-save"></i> حفظ الصلاحيات';
            if (ok) {
                A.showToast('تم حفظ صلاحيات الموظف بنجاح');
                renderStaff();
            }
        });
    }

    /** Renders the promote-a-customer form. */
    function renderPromoteForm() {
        var users = getPromotableUsers();
        var html = '<div class="admin-section-header"><div>'
            + '<h2><i class="fas fa-user-plus"></i> إضافة موظف جديد</h2>'
            + '<p>اختر عميلاً وحوّله إلى موظف، ثم امنحه الصلاحيات.</p>'
            + '</div></div>';

        html += '<div class="admin-panel"><div class="panel-body padded">'
            + '<form id="promoteStaffForm" class="admin-form"><div class="form-grid">'
            + '<div class="admin-form-group full"><label>المستخدم</label><select id="staffUserId" required>';
        if (users.length === 0) {
            html += '<option value="">لا يوجد مستخدمون قابلون للترقية</option>';
        } else {
            html += '<option value="">— اختر مستخدم —</option>';
            users.forEach(function (u) {
                html += '<option value="' + esc(authIdOf(u)) + '">' + esc(u.fullName || u.email || u.id) + '</option>';
            });
        }
        html += '</select></div>'
            + '<div class="admin-form-group full"><label>الدور</label><select id="staffRole">'
            + '<option value="employee">موظف مبيعات</option>'
            + '<option value="technician">فني صيانة</option>'
            + '</select></div></div>'
            + '<div class="admin-form-actions">'
            + '<button type="submit" class="btn btn-primary"><i class="fas fa-user-check"></i> تحويل إلى موظف</button>'
            + '<button type="button" class="btn btn-outline" id="promoteStaffBack"><i class="fas fa-arrow-right"></i> رجوع</button>'
            + '</div></form></div></div>';

        A.adminContent.innerHTML = html;

        document.getElementById('promoteStaffBack').addEventListener('click', renderStaff);
        document.getElementById('promoteStaffForm').addEventListener('submit', async function (e) {
            e.preventDefault();
            var targetId = document.getElementById('staffUserId').value;
            var role = document.getElementById('staffRole').value;
            if (!targetId) { A.showErrorToast('STF-101', 'اختر مستخدماً'); return; }

            var btn = this.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري التحويل...';

            var ok = await setStaffRole(targetId, role);
            if (ok) {
                A.showToast('تم تحويل المستخدم إلى موظف. امنحه الصلاحيات الآن.');
                await TZ.refreshData();
                var staff = getStaff().find(function (s) { return authIdOf(s) === targetId; });
                if (staff) { renderPermissionEditor(staff); } else { renderStaff(); }
            } else {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-user-check"></i> تحويل إلى موظف';
            }
        });
    }

    /** Renders the staff listing. */
    async function renderStaff() {
        if (!isFullAdmin()) {
            A.adminContent.innerHTML = '<div class="admin-panel"><div class="panel-body"><div class="empty-state">'
                + '<i class="fas fa-lock"></i><p>هذا القسم متاح للمدراء فقط.</p></div></div></div>';
            return;
        }

        var staff = getStaff();
        var html = '<div class="admin-section-header"><div>'
            + '<h2><i class="fas fa-user-shield"></i> الموظفون والصلاحيات</h2>'
            + '<p>' + staff.length + ' موظف — تحكّم في وصول كل موظف لأقسام لوحة التحكم.</p>'
            + '</div><div>'
            + '<button class="btn btn-primary" id="addStaffBtn"><i class="fas fa-user-plus"></i> إضافة موظف</button>'
            + '</div></div>';

        if (staff.length === 0) {
            html += '<div class="admin-panel"><div class="panel-body"><div class="empty-state">'
                + '<i class="fas fa-users"></i><p>لا يوجد موظفون بعد. أضف موظفاً للبدء.</p></div></div></div>';
        } else {
            html += '<div class="admin-panel"><div class="panel-body"><div class="table-wrap"><table class="data-table"><thead><tr>'
                + '<th>الموظف</th><th>البريد</th><th>الدور</th><th style="width:180px;">إجراءات</th>'
                + '</tr></thead><tbody>';
            staff.forEach(function (u) {
                html += '<tr>'
                    + '<td><strong>' + esc(u.fullName || u.email || u.id) + '</strong></td>'
                    + '<td><small>' + esc(u.email || '-') + '</small></td>'
                    + '<td><span class="status-badge" style="background:rgba(108,92,231,0.12);color:#6c5ce7;">' + esc(ROLE_LABELS[u.role] || u.role) + '</span></td>'
                    + '<td><div style="display:flex;gap:6px;">'
                    + '<button class="btn btn-icon edit-perms-btn" data-uid="' + esc(authIdOf(u)) + '" title="تعديل الصلاحيات" style="color:#6c5ce7;background:rgba(108,92,231,0.1);border:none;padding:6px 10px;border-radius:6px;cursor:pointer;"><i class="fas fa-sliders-h"></i></button>'
                    + '<button class="btn btn-icon remove-staff-btn" data-uid="' + esc(authIdOf(u)) + '" data-name="' + esc(u.fullName || '') + '" title="إزالة الموظف" style="color:#ff7675;background:rgba(255,118,117,0.1);border:none;padding:6px 10px;border-radius:6px;cursor:pointer;"><i class="fas fa-user-minus"></i></button>'
                    + '</div></td></tr>';
            });
            html += '</tbody></table></div></div></div>';
        }

        A.adminContent.innerHTML = html;

        document.getElementById('addStaffBtn')?.addEventListener('click', renderPromoteForm);

        A.adminContent.querySelectorAll('.edit-perms-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var uid = this.dataset.uid;
                var member = staff.find(function (s) { return authIdOf(s) === uid; });
                if (member) renderPermissionEditor(member);
            });
        });

        A.adminContent.querySelectorAll('.remove-staff-btn').forEach(function (btn) {
            btn.addEventListener('click', async function () {
                var uid = this.dataset.uid;
                var name = this.dataset.name || 'الموظف';
                if (!window.confirm('هل تريد إزالة "' + name + '" من الموظفين؟ ستُحذف جميع صلاحياته.')) return;
                this.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                var ok = await setStaffRole(uid, 'customer');
                if (ok) {
                    A.showToast('تمت إزالة الموظف بنجاح');
                    await TZ.refreshData();
                    renderStaff();
                } else {
                    this.innerHTML = '<i class="fas fa-user-minus"></i>';
                }
            });
        });
    }

    A.sections.staff = renderStaff;
})();
