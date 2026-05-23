/**
 * TechZone Admin — Platform Updates Section
 *
 * CRUD for platform_updates table. Supports publishing, pinning,
 * image upload, and optional notification broadcast.
 */
(function () {
    'use strict';

    var A = window.AdminApp;
    if (!A) return;

    var TABLE = 'platform_updates';
    var BADGE_OPTIONS = ['جديد', 'مهم', 'صيانة', 'تحسين', 'إصلاح'];
    var IMAGE_MAX_BYTES = 3 * 1024 * 1024;

    function esc(v) { return TZ.escapeHtml(v == null ? '' : String(v)); }

    /**
     * Loads all platform updates ordered by pinned first then newest.
     *
     * @returns {Promise<Array>}
     */
    async function loadUpdates() {
        var res = await TZ.supabase
            .from(TABLE)
            .select('*')
            .order('is_pinned', { ascending: false })
            .order('created_at', { ascending: false });
        return res.data || [];
    }

    /**
     * Converts a File to a base64 data URL string.
     *
     * @param {File} file
     * @returns {Promise<string>}
     */
    function fileToDataUrl(file) {
        return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function () { resolve(reader.result); };
            reader.onerror = function () { reject(new Error('فشل قراءة الملف')); };
            reader.readAsDataURL(file);
        });
    }

    /**
     * Broadcasts a notification to all customers from an update.
     *
     * @param {{ title: string, summary: string }} update
     * @returns {Promise<void>}
     */
    async function broadcastUpdateNotification(update) {
        var users = TZ.db.users || [];
        var customers = users.filter(function (u) {
            return typeof TZ.isCustomerUser === 'function' ? TZ.isCustomerUser(u) : true;
        });
        var batch = customers.map(function (u) {
            return {
                user_id: u.authUserId || u.id,
                title: '📢 ' + update.title,
                body: update.summary || '',
                type: 'info'
            };
        });
        if (batch.length === 0) return;
        var res = await TZ.supabase.from('notifications').insert(batch);
        if (res.error) {
            A.showErrorToast('UPD-302', 'فشل إرسال الإشعار الجماعي');
        } else {
            A.showToast('تم إرسال إشعار لـ ' + batch.length + ' عميل');
        }
    }

    /**
     * Renders the create/edit form for an update.
     *
     * @param {object|null} existing
     */
    function renderForm(existing) {
        var isEdit = !!existing;
        var u = existing || {};

        var badgeOptions = BADGE_OPTIONS.map(function (b) {
            return '<option value="' + esc(b) + '"' + (u.badge === b ? ' selected' : '') + '>' + esc(b) + '</option>';
        }).join('');

        var html = '<div class="admin-section-header"><div>'
            + '<h2><i class="fas fa-' + (isEdit ? 'edit' : 'plus-circle') + '"></i> '
            + (isEdit ? 'تعديل التحديث' : 'نشر تحديث جديد') + '</h2>'
            + '<p>سيظهر في صفحة التحديثات ويمكن إرساله أيضًا كإشعار منسق للعملاء.</p>'
            + '</div></div>';

        html += '<div class="admin-panel"><div class="panel-body padded">'
            + '<form class="admin-form" id="updateForm"><div class="form-grid">'
            + '<div class="admin-form-group full"><label>العنوان</label>'
            + '<div class="admin-input-wrap"><i class="fas fa-heading"></i>'
            + '<input type="text" id="updTitle" value="' + esc(u.title || '') + '" placeholder="مثال: تحسينات جديدة على الإشعارات وتسليم الطلبات" required></div></div>'

            + '<div class="admin-form-group"><label>شارة قصيرة</label>'
            + '<select id="updBadge">' + badgeOptions + '</select></div>'

            + '<div class="admin-form-group full"><label>ملخص قصير</label>'
            + '<div class="admin-input-wrap"><i class="fas fa-align-left"></i>'
            + '<input type="text" id="updSummary" value="' + esc(u.summary || '') + '" placeholder="وصف مختصر يظهر في البطاقات والإشعارات."></div></div>'

            + '<div class="admin-form-group full"><label>المحتوى المنسق</label>'
            + '<textarea id="updContent" rows="6" placeholder="يمكنك كتابة HTML بسيط مثل <p> و<ul> و<strong>.">' + esc(u.content || '') + '</textarea></div>'

            + '<div class="admin-form-group"><label>صورة التحديث</label>'
            + '<input type="file" id="updImageFile" accept="image/png,image/jpeg,image/webp">'
            + '<small style="color:var(--text-muted)">PNG / JPG / WEBP فقط حتى 3MB.</small></div>'

            + '<div class="admin-form-group"><label>أو رابط صورة</label>'
            + '<div class="admin-input-wrap"><i class="fas fa-image"></i>'
            + '<input type="url" id="updImageUrl" value="' + esc(u.image || '') + '" placeholder="https://..."></div></div>'

            + '<div class="admin-form-group"><label>زر إضافي</label>'
            + '<div class="admin-input-wrap"><i class="fas fa-external-link-alt"></i>'
            + '<input type="text" id="updCtaLabel" value="' + esc(u.cta_label || '') + '" placeholder="افتح الصفحة / اقرأ المزيد"></div></div>'

            + '<div class="admin-form-group"><label>رابط الزر</label>'
            + '<div class="admin-input-wrap"><i class="fas fa-link"></i>'
            + '<input type="url" id="updCtaUrl" value="' + esc(u.cta_url || '') + '" placeholder="/api/ أو https://..."></div></div>'

            + '</div>';

        html += '<div style="display: flex; flex-wrap: wrap; gap: 1rem; margin: 1rem 0; padding: 1rem; border-radius: 12px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);">'
            + '<label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;color:var(--text-secondary);">'
            + '<input type="checkbox" id="updPublished"' + (u.is_published !== false ? ' checked' : '') + '> <i class="fas fa-eye"></i> منشور للزبائن</label>'
            + '<label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;color:var(--text-secondary);">'
            + '<input type="checkbox" id="updPinned"' + (u.is_pinned ? ' checked' : '') + '> <i class="fas fa-thumbtack"></i> تثبيت في الأعلى</label>'
            + '<label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;color:var(--text-secondary);">'
            + '<input type="checkbox" id="updNotify"> <i class="fas fa-bell"></i> إرسال كإشعار</label>'
            + '</div>';

        html += '<div class="admin-form-actions">'
            + '<button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> ' + (isEdit ? 'حفظ التعديلات' : 'نشر التحديث') + '</button>'
            + '<button type="button" class="btn btn-outline" id="updClearBtn"><i class="fas fa-eraser"></i> تفريغ</button>'
            + '<button type="button" class="btn btn-outline" id="updBackBtn"><i class="fas fa-arrow-right"></i> رجوع</button>'
            + '</div></form></div></div>';

        A.adminContent.innerHTML = html;

        document.getElementById('updBackBtn').addEventListener('click', function () {
            renderUpdates();
        });

        document.getElementById('updClearBtn').addEventListener('click', function () {
            renderForm(null);
        });

        document.getElementById('updateForm').addEventListener('submit', async function (e) {
            e.preventDefault();
            var title = document.getElementById('updTitle').value.trim();
            if (!title) { A.showErrorToast('UPD-101', 'أدخل عنوان التحديث'); return; }

            var btn = this.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';

            var imageUrl = document.getElementById('updImageUrl').value.trim();
            var imageFile = document.getElementById('updImageFile').files[0];

            if (imageFile) {
                if (imageFile.size > IMAGE_MAX_BYTES) {
                    A.showErrorToast('UPD-102', 'حجم الصورة يتجاوز 3MB');
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-save"></i> ' + (isEdit ? 'حفظ التعديلات' : 'نشر التحديث');
                    return;
                }
                try { imageUrl = await fileToDataUrl(imageFile); } catch (_e) { /* fallback to URL */ }
            }

            var payload = {
                title: title,
                badge: document.getElementById('updBadge').value,
                summary: document.getElementById('updSummary').value.trim(),
                content: document.getElementById('updContent').value.trim(),
                image: imageUrl,
                cta_label: document.getElementById('updCtaLabel').value.trim(),
                cta_url: document.getElementById('updCtaUrl').value.trim(),
                is_published: document.getElementById('updPublished').checked,
                is_pinned: document.getElementById('updPinned').checked,
                updated_at: new Date().toISOString()
            };

            var res;
            if (isEdit) {
                res = await TZ.supabase.from(TABLE).update(payload).eq('id', existing.id);
            } else {
                res = await TZ.supabase.from(TABLE).insert([payload]);
            }

            if (res.error) {
                A.showErrorToast('UPD-301', 'فشل حفظ التحديث: ' + (res.error.message || ''));
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-save"></i> حفظ';
                return;
            }

            if (document.getElementById('updNotify').checked) {
                await broadcastUpdateNotification(payload);
            }

            A.showToast(isEdit ? 'تم تعديل التحديث بنجاح' : 'تم نشر التحديث بنجاح');
            renderUpdates();
        });
    }

    /**
     * Renders the updates list and creation shortcut.
     */
    async function renderUpdates() {
        A.adminContent.innerHTML = '<div class="admin-section-header"><div><h2><i class="fas fa-bullhorn"></i> تحديثات المنصة</h2></div></div>'
            + '<div class="admin-panel"><div class="panel-body"><div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>جاري التحميل...</p></div></div></div>';

        var updates = await loadUpdates();

        var html = '<div class="admin-section-header"><div>'
            + '<h2><i class="fas fa-bullhorn"></i> تحديثات المنصة</h2>'
            + '</div><div>'
            + '<button class="btn btn-primary" id="newUpdateBtn"><i class="fas fa-plus"></i> تحديث جديد</button>'
            + '</div></div>';

        if (updates.length === 0) {
            html += '<div class="admin-panel"><div class="panel-body"><div class="empty-state"><i class="fas fa-newspaper"></i><p>لا توجد تحديثات بعد</p></div></div></div>';
        } else {
            html += '<div class="admin-panel"><div class="panel-body"><div class="table-wrap"><table class="data-table"><thead><tr>'
                + '<th>العنوان</th><th>الشارة</th><th>الحالة</th><th>التاريخ</th><th style="width:120px;">إجراءات</th>'
                + '</tr></thead><tbody>';

            updates.forEach(function (u) {
                var statusBadge = u.is_published
                    ? '<span class="status-badge" style="background:rgba(0,184,148,0.1);color:#00b894;">منشور</span>'
                    : '<span class="status-badge" style="background:rgba(255,118,117,0.1);color:#ff7675;">مسودة</span>';
                var pinIcon = u.is_pinned ? ' <i class="fas fa-thumbtack" style="color:#f59e0b;" title="مثبّت"></i>' : '';

                html += '<tr>'
                    + '<td><div style="display:flex;flex-direction:column;gap:4px;"><strong>' + esc(u.title) + pinIcon + '</strong>'
                    + (u.summary ? '<small style="color:var(--text-muted);">' + esc(u.summary).substring(0, 80) + '</small>' : '')
                    + '</div></td>'
                    + '<td><span class="status-badge" style="background:rgba(108,92,231,0.1);color:#6c5ce7;">' + esc(u.badge || 'جديد') + '</span></td>'
                    + '<td>' + statusBadge + '</td>'
                    + '<td><small style="color:var(--text-muted);">' + new Date(u.created_at).toLocaleDateString('ar-JO') + '</small></td>'
                    + '<td><div style="display:flex;gap:6px;">'
                    + '<button class="btn btn-icon edit-upd-btn" data-id="' + esc(u.id) + '" title="تعديل" style="color:#0984e3;background:rgba(9,132,227,0.1);border:none;padding:6px 10px;border-radius:6px;cursor:pointer;"><i class="fas fa-edit"></i></button>'
                    + '<button class="btn btn-icon del-upd-btn" data-id="' + esc(u.id) + '" title="حذف" style="color:#ff7675;background:rgba(255,118,117,0.1);border:none;padding:6px 10px;border-radius:6px;cursor:pointer;"><i class="fas fa-trash"></i></button>'
                    + '</div></td></tr>';
            });
            html += '</tbody></table></div></div></div>';
        }

        A.adminContent.innerHTML = html;

        document.getElementById('newUpdateBtn')?.addEventListener('click', function () {
            renderForm(null);
        });

        document.querySelectorAll('.edit-upd-btn').forEach(function (btn) {
            btn.addEventListener('click', async function () {
                var id = this.dataset.id;
                var match = updates.find(function (u) { return u.id === id; });
                if (match) renderForm(match);
            });
        });

        document.querySelectorAll('.del-upd-btn').forEach(function (btn) {
            btn.addEventListener('click', async function () {
                var id = this.dataset.id;
                if (!window.confirm('هل أنت متأكد من حذف هذا التحديث؟')) return;
                this.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                var res = await TZ.supabase.from(TABLE).delete().eq('id', id);
                if (res.error) {
                    A.showErrorToast('UPD-400', 'فشل حذف التحديث');
                    this.innerHTML = '<i class="fas fa-trash"></i>';
                } else {
                    A.showToast('تم الحذف بنجاح');
                    renderUpdates();
                }
            });
        });
    }

    A.sections['platform-updates'] = renderUpdates;
})();
