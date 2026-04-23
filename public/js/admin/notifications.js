/**
 * TechZone Admin — Notifications Section (Rebuilt)
 *
 * Send targeted or global notifications via Supabase.
 * Loads recent notifications directly since they aren't in TZ.db.
 */
(function () {
    'use strict';

    var A = window.AdminApp;
    if (!A) return;

    function esc(v) { return TZ.escapeHtml(v == null ? '' : String(v)); }

    async function loadRecentNotifications() {
        var result = await TZ.supabase.from('notifications')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(30);
        return result.data || [];
    }

    async function sendNotification(data) {
        var payload = { title: data.title, body: data.body || '', type: data.type || 'info' };

        if (data.userId && data.userId !== 'all') {
            payload.user_id = data.userId;
            var res = await TZ.supabase.from('notifications').insert([payload]);
        if (res.error) { A.showErrorToast('NTF-301', 'فشل إرسال الإشعار'); return false; }
            A.showToast('تم إرسال الإشعار للمستخدم');
            return true;
        }

        var users = TZ.db.users || [];
        var customers = users.filter(function (u) {
            return typeof TZ.isCustomerUser === 'function' ? TZ.isCustomerUser(u) : true;
        });
        var batch = customers.map(function (u) {
            return { user_id: u.authUserId || u.id, title: payload.title, body: payload.body, type: payload.type };
        });

        if (batch.length === 0) { A.showErrorToast('NTF-102', 'لا يوجد مستخدمون لإرسال الإشعار إليهم'); return false; }
        var res = await TZ.supabase.from('notifications').insert(batch);
        if (res.error) { A.showErrorToast('NTF-302', 'فشل الإرسال الجماعي'); return false; }
        A.showToast('تم إرسال الإشعار إلى ' + batch.length + ' مستخدم');
        return true;
    }

    async function renderNotifications() {
        A.adminContent.innerHTML = '<div class="admin-section-header"><div><h2><i class="fas fa-bell"></i> الإشعارات</h2></div></div>'
            + '<div class="admin-panel"><div class="panel-body"><div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>جاري التحميل...</p></div></div></div>';

        var recent = await loadRecentNotifications();

        var prefill = window.__TZ_ADMIN_NOTIFICATION_PREFILL || {};
        window.__TZ_ADMIN_NOTIFICATION_PREFILL = null;

        var users = TZ.db.users || [];
        var userOptions = '<option value="all">جميع العملاء (جماعي)</option>';
        users.forEach(function (u) {
            var name = u.fullName || u.email || u.id;
            var uid = u.authUserId || u.id;
            var sel = (prefill.userId === uid) ? ' selected' : '';
            userOptions += '<option value="' + uid + '"' + sel + '>' + esc(name) + '</option>';
        });

        var html = '<div class="admin-section-header"><div><h2><i class="fas fa-bell"></i> الإشعارات</h2></div></div>';

        html += '<div class="admin-panel"><div class="panel-header"><h2><i class="fas fa-paper-plane"></i> إرسال إشعار جديد</h2></div><div class="panel-body padded">'
            + '<form class="admin-form" id="notifForm"><div class="form-grid">'
            + '<div class="admin-form-group"><label>المستلم *</label><select id="notifTarget">' + userOptions + '</select></div>'
            + '<div class="admin-form-group"><label>النوع</label><select id="notifType"><option value="info">معلومات</option><option value="success">نجاح</option><option value="warning">تحذير</option><option value="error">خطأ</option></select></div>'
            + '<div class="admin-form-group full"><label>العنوان *</label><div class="admin-input-wrap"><i class="fas fa-heading"></i><input type="text" id="notifTitle" value="' + esc(prefill.title || '') + '" required></div></div>'
            + '<div class="admin-form-group full"><label>المحتوى</label><textarea id="notifBody" rows="3"></textarea></div>'
            + '</div>'
            + '<div class="admin-form-actions"><button type="submit" class="btn btn-primary"><i class="fas fa-paper-plane"></i> إرسال</button></div>'
            + '</form></div></div>';

        html += '<div class="admin-panel"><div class="panel-header"><h2><i class="fas fa-history"></i> آخر الإشعارات المرسلة</h2></div><div class="panel-body"><div class="table-wrap"><table class="data-table"><thead><tr>'
            + '<th>العنوان</th><th>المستلم</th><th>النوع</th><th>التاريخ</th><th style="width: 80px;">إجراءات</th></tr></thead><tbody>';

        if (recent.length === 0) {
            html += '<tr><td colspan="5"><div class="empty-state"><i class="fas fa-bell-slash"></i><p>لا توجد إشعارات</p></div></td></tr>';
        } else {
            recent.forEach(function (n) {
                var recipientText = (n.user_id && n.user_id !== 'all') ? '<span class="status-badge" style="background: rgba(0, 184, 148, 0.1); color: #00b894;">مستخدم محدد</span>' : '<span class="status-badge" style="background: rgba(9, 132, 227, 0.1); color: #0984e3;">جميع المستخدمين</span>';
                
                html += '<tr>'
                    + '<td><div style="display: flex; flex-direction: column; gap: 4px;"><strong>' + esc(n.title) + '</strong>' + (n.body ? '<small style="color:var(--text-muted);">' + esc(n.body) + '</small>' : '') + '</div></td>'
                    + '<td>' + recipientText + '</td>'
                    + '<td><span class="status-badge ' + (n.type || 'info') + '">' + (n.type === 'error' ? 'خطأ' : n.type === 'warning' ? 'تنبيه' : n.type === 'success' ? 'نجاح' : 'معلومات') + '</span></td>'
                    + '<td><small style="color:var(--text-muted);">' + new Date(n.created_at).toLocaleString('ar-JO') + '</small></td>'
                    + '<td><button class="btn btn-icon delete-notif-btn" data-id="' + esc(n.id) + '" title="حذف" style="color: #ff7675; background: rgba(255,118,117,0.1); border: none; padding: 6px 10px; border-radius: 6px; cursor: pointer;"><i class="fas fa-trash"></i></button></td>'
                    + '</tr>';
            });
        }
        html += '</tbody></table></div></div></div>';

        A.adminContent.innerHTML = html;

        document.getElementById('notifForm')?.addEventListener('submit', async function (e) {
            e.preventDefault();
            var title = document.getElementById('notifTitle').value.trim();
            if (!title) { A.showErrorToast('NTF-101', 'أدخل عنوان الإشعار'); return; }
            var btn = this.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الإرسال...';
            var ok = await sendNotification({
                userId: document.getElementById('notifTarget').value,
                title: title,
                body: document.getElementById('notifBody').value.trim(),
                type: document.getElementById('notifType').value
            });
            if (ok) { renderNotifications(); }
            else { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> إرسال'; }
        });

        // Delete handlers
        document.querySelectorAll('.delete-notif-btn').forEach(function(btn) {
            btn.addEventListener('click', async function() {
                var id = this.dataset.id;
                if (!window.confirm('هل أنت متأكد من حذف هذا الإشعار؟')) return;
                this.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                var res = await TZ.supabase.from('notifications').delete().eq('id', id);
                if (res.error) {
                    A.showErrorToast('NTF-400', 'فشل حذف الإشعار');
                    this.innerHTML = '<i class="fas fa-trash"></i>';
                } else {
                    A.showToast('تم الحذف بنجاح');
                    renderNotifications();
                }
            });
        });
    }

    A.sections.notifications = renderNotifications;
})();
