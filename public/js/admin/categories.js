/**
 * TechZone Admin — Categories Section (Rebuilt)
 *
 * Manages main and subcategories with tree view.
 * CRUD operations via Supabase.
 */
(function () {
    'use strict';

    var A = window.AdminApp;
    if (!A) return;

    function esc(v) { return TZ.escapeHtml(v == null ? '' : String(v)); }

    /* ── Data ── */

    function getMainCategories() {
        return (TZ.db.categories || []).filter(function (c) { return !c.parentId && !c.parent_id; });
    }

    function getSubcategories(parentId) {
        return (TZ.db.categories || []).filter(function (c) { return (c.parentId || c.parent_id) === parentId; });
    }

    /* ── CRUD ── */

    async function saveCategory(data, isEdit) {
        var payload = {
            name: data.name,
            parent_id: data.parentId || null,
            icon: data.icon || null,
            description: data.description || null,
            status: data.status || 'active',
            show_in_navbar: data.showInNavbar !== false,
            updated_at: new Date().toISOString()
        };

        var result;
        if (isEdit) {
            result = await TZ.supabase.from('categories').update(payload).eq('id', data.id);
        } else {
            result = await TZ.supabase.from('categories').insert([payload]);
        }

        if (result.error) {
            A.showErrorToast('CAT-301', 'فشل حفظ الفئة: ' + (result.error.message || ''));
            return false;
        }

        A.showToast(isEdit ? 'تم تحديث الفئة' : 'تم إضافة الفئة');
        return true;
    }

    async function deleteCategory(id) {
        var subs = getSubcategories(id);
        var label = subs.length > 0 ? 'هذه الفئة تحتوي على ' + subs.length + ' فئة فرعية. سيتم حذف الجميع.' : 'هل أنت متأكد من حذف هذه الفئة؟';
        if (!confirm(label)) return;

        if (subs.length > 0) {
            var subIds = subs.map(function (s) { return s.id; });
            await TZ.supabase.from('categories').delete().in('id', subIds);
        }

        var result = await TZ.supabase.from('categories').delete().eq('id', id);
        if (result.error) { A.showErrorToast('CAT-302', 'فشل حذف الفئة'); return; }

        A.showToast('تم حذف الفئة');
        await TZ.refreshData();
        renderCategories();
    }

    /* ── Form ── */

    function openCategoryForm(category, parentId) {
        var c = category || {};
        var isEdit = Boolean(c.id);
        var mainCats = getMainCategories();
        var parentOptions = '<option value="">— بدون (فئة رئيسية) —</option>';
        mainCats.forEach(function (mc) {
            var sel = ((c.parentId || c.parent_id || parentId) === mc.id) ? ' selected' : '';
            parentOptions += '<option value="' + mc.id + '"' + sel + '>' + esc(mc.name) + '</option>';
        });

        var backdrop = document.createElement('div');
        backdrop.className = 'admin-slideover-backdrop';
        var panel = document.createElement('div');
        panel.className = 'admin-slideover';
        panel.innerHTML = ''
            + '<div class="admin-slideover-head"><h3><i class="fas ' + (isEdit ? 'fa-edit' : 'fa-folder-plus') + '"></i> ' + (isEdit ? 'تعديل الفئة' : 'إضافة فئة') + '</h3><button class="btn btn-ghost btn-sm close-cat-form"><i class="fas fa-times"></i></button></div>'
            + '<div class="admin-slideover-body"><form class="admin-form" id="catForm"><div class="form-grid">'
            + '<div class="admin-form-group full"><label>اسم الفئة *</label><div class="admin-input-wrap"><i class="fas fa-folder"></i><input type="text" id="catName" value="' + esc(c.name || '') + '" required></div></div>'
            + '<div class="admin-form-group"><label>الفئة الأم</label><select id="catParent">' + parentOptions + '</select></div>'
            + '<div class="admin-form-group"><label>الأيقونة (Font Awesome)</label><div class="admin-input-wrap"><i class="fas fa-icons"></i><input type="text" id="catIcon" value="' + esc(c.icon || '') + '" placeholder="fa-laptop"></div></div>'
            + '<div class="admin-form-group"><label>الحالة</label><select id="catStatus"><option value="active"' + (c.status === 'active' || !c.status ? ' selected' : '') + '>نشطة</option><option value="hidden"' + (c.status === 'hidden' ? ' selected' : '') + '>مخفية</option></select></div>'
            + '<div class="admin-form-group full"><label>الوصف</label><textarea id="catDesc" rows="3">' + esc(c.description || '') + '</textarea></div>'
            + '</div></form></div>'
            + '<div class="admin-slideover-footer"><button class="btn btn-primary" id="saveCatBtn"><i class="fas fa-save"></i> ' + (isEdit ? 'تحديث' : 'إضافة') + '</button><button class="btn btn-outline close-cat-form">إلغاء</button></div>';

        document.body.appendChild(backdrop);
        document.body.appendChild(panel);

        function close() { backdrop.remove(); panel.remove(); }
        backdrop.addEventListener('click', close);
        panel.querySelectorAll('.close-cat-form').forEach(function (b) { b.addEventListener('click', close); });

        document.getElementById('saveCatBtn').addEventListener('click', async function () {
            var name = document.getElementById('catName').value.trim();
            if (!name) { A.showErrorToast('CAT-101', 'أدخل اسم الفئة'); return; }
            this.disabled = true;
            this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';

            var ok = await saveCategory({
                id: isEdit ? c.id : null,
                name: name,
                parentId: document.getElementById('catParent').value || null,
                icon: document.getElementById('catIcon').value.trim(),
                status: document.getElementById('catStatus').value,
                description: document.getElementById('catDesc').value.trim()
            }, isEdit);

            if (ok) { close(); await TZ.refreshData(); renderCategories(); }
            else { this.disabled = false; this.innerHTML = '<i class="fas fa-save"></i> ' + (isEdit ? 'تحديث' : 'إضافة'); }
        });
    }

    /* ── Render ── */

    function renderCategories() {
        var mainCats = getMainCategories();
        var html = '';

        html += '<div class="admin-section-header">'
            + '<div><h2><i class="fas fa-sitemap"></i> إدارة الفئات</h2>'
            + '<p>' + mainCats.length + ' فئة رئيسية — ' + ((TZ.db.categories || []).length - mainCats.length) + ' فئة فرعية</p></div>'
            + '<div class="admin-section-actions">'
            + '<button class="btn btn-primary btn-sm" id="addMainCatBtn"><i class="fas fa-plus"></i> فئة رئيسية</button>'
            + '</div></div>';

        if (mainCats.length === 0) {
            html += '<div class="admin-panel"><div class="panel-body"><div class="empty-state"><i class="fas fa-sitemap"></i><p>لا توجد فئات بعد. أضف فئة رئيسية للبدء.</p></div></div></div>';
        } else {
            mainCats.forEach(function (mc) {
                var subs = getSubcategories(mc.id);
                var iconHtml = mc.icon ? '<i class="fas ' + esc(mc.icon) + '"></i> ' : '<i class="fas fa-folder"></i> ';

                html += '<div class="admin-panel">'
                    + '<div class="panel-header">'
                    + '<h2>' + iconHtml + esc(mc.name) + ' <span style="font-weight:400;font-size:0.82rem;color:var(--text-muted);">(' + subs.length + ' فرعية)</span></h2>'
                    + '<div class="actions-cell">'
                    + '<button class="btn btn-outline btn-sm add-sub-btn" data-parent="' + mc.id + '"><i class="fas fa-plus"></i> فرعية</button>'
                    + '<button class="action-btn edit-cat-btn" data-id="' + mc.id + '"><i class="fas fa-edit"></i></button>'
                    + '<button class="action-btn danger delete-cat-btn" data-id="' + mc.id + '"><i class="fas fa-trash"></i></button>'
                    + '</div></div>'
                    + '<div class="panel-body">';

                if (subs.length > 0) {
                    html += '<div class="table-wrap"><table class="data-table"><thead><tr><th>الفئة الفرعية</th><th>الأيقونة</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody>';
                    subs.forEach(function (sub) {
                        html += '<tr>'
                            + '<td><strong>' + esc(sub.name) + '</strong></td>'
                            + '<td>' + (sub.icon ? '<i class="fas ' + esc(sub.icon) + '"></i> ' + esc(sub.icon) : '-') + '</td>'
                            + '<td><span class="status-badge ' + sub.status + '">' + (sub.status === 'active' ? 'نشطة' : 'مخفية') + '</span></td>'
                            + '<td class="actions-cell">'
                            + '<button class="action-btn edit-cat-btn" data-id="' + sub.id + '"><i class="fas fa-edit"></i></button>'
                            + '<button class="action-btn danger delete-cat-btn" data-id="' + sub.id + '"><i class="fas fa-trash"></i></button>'
                            + '</td></tr>';
                    });
                    html += '</tbody></table></div>';
                } else {
                    html += '<div class="empty-state" style="padding:30px;"><i class="fas fa-folder-open"></i><p>لا توجد فئات فرعية</p></div>';
                }

                html += '</div></div>';
            });
        }

        A.adminContent.innerHTML = html;

        document.getElementById('addMainCatBtn')?.addEventListener('click', function () { openCategoryForm(null, null); });
        document.querySelectorAll('.add-sub-btn').forEach(function (b) { b.addEventListener('click', function () { openCategoryForm(null, b.dataset.parent); }); });
        document.querySelectorAll('.edit-cat-btn').forEach(function (b) {
            b.addEventListener('click', function () {
                var cat = (TZ.db.categories || []).find(function (c) { return c.id === b.dataset.id; });
                if (cat) openCategoryForm(cat, null);
            });
        });
        document.querySelectorAll('.delete-cat-btn').forEach(function (b) { b.addEventListener('click', function () { deleteCategory(b.dataset.id); }); });
    }

    A.sections.categories = renderCategories;
    A.sections['main-categories'] = renderCategories;
    A.sections.subcategories = renderCategories;
})();
