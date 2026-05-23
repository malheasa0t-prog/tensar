/**
 * TechZone Admin — Categories Section (Rebuilt)
 *
 * Manages main and subcategories with tree view and image upload.
 * CRUD operations via Supabase.
 */
(function () {
    'use strict';

    var A = window.AdminApp;
    if (!A) return;

    var CATEGORY_IMAGE_BUCKET = 'category-images';
    var ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    var MAX_IMAGE_SIZE_BYTES = 3 * 1024 * 1024;
    var pendingCatImageFile = null;

    function esc(v) { return TZ.escapeHtml(v == null ? '' : String(v)); }

    /* ── Data ── */

    function getMainCategories() {
        return (TZ.db.categories || []).filter(function (c) { return !c.parentId && !c.parent_id; });
    }

    function getSubcategories(parentId) {
        return (TZ.db.categories || []).filter(function (c) { return (c.parentId || c.parent_id) === parentId; });
    }

    /* ── Image Upload ── */

    async function ensureCategoryImageBucket() {
        var bucketRes = await TZ.supabase.storage.getBucket(CATEGORY_IMAGE_BUCKET);
        if (bucketRes.data) return;
        var msg = String(bucketRes.error?.message || '').toLowerCase();
        if (bucketRes.error && !msg.includes('not found')) return;
        await TZ.supabase.storage.createBucket(CATEGORY_IMAGE_BUCKET, {
            public: true,
            fileSizeLimit: MAX_IMAGE_SIZE_BYTES,
            allowedMimeTypes: ALLOWED_IMAGE_TYPES
        });
    }

    async function uploadCategoryImage(file) {
        if (!file) return null;
        var normalizedType = String(file.type || '').trim().toLowerCase();
        if (!ALLOWED_IMAGE_TYPES.includes(normalizedType)) {
            A.showErrorToast('CAT-110', 'نوع الملف غير مدعوم. استخدم JPEG أو PNG أو WebP.');
            return null;
        }
        if (Number(file.size || 0) > MAX_IMAGE_SIZE_BYTES) {
            A.showErrorToast('CAT-111', 'حجم الصورة يتجاوز 3MB.');
            return null;
        }
        try {
            await ensureCategoryImageBucket();
            var ext = file.name.split('.').pop() || 'jpg';
            var objectPath = 'categories/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
            var uploadRes = await TZ.supabase.storage.from(CATEGORY_IMAGE_BUCKET).upload(objectPath, file, {
                contentType: file.type || 'application/octet-stream',
                upsert: false
            });
            if (uploadRes.error) {
                A.showErrorToast('CAT-312', 'فشل رفع الصورة: ' + (uploadRes.error.message || ''));
                return null;
            }
            var urlRes = TZ.supabase.storage.from(CATEGORY_IMAGE_BUCKET).getPublicUrl(objectPath);
            return urlRes.data?.publicUrl || null;
        } catch (err) {
            A.showErrorToast('CAT-313', 'خطأ أثناء رفع الصورة.');
            return null;
        }
    }

    /* ── CRUD ── */

    async function saveCategory(data, isEdit) {
        var imageUrl = await uploadCategoryImage(pendingCatImageFile);
        pendingCatImageFile = null;

        var payload = {
            name: data.name,
            parent_id: data.parentId || null,
            icon: data.icon || null,
            description: data.description || null,
            status: data.status || 'active',
            show_in_navbar: data.showInNavbar !== false,
            updated_at: new Date().toISOString()
        };

        if (imageUrl) {
            payload.image = imageUrl;
        } else if (data.existingImage) {
            payload.image = data.existingImage;
        }

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
        var label = subs.length > 0
            ? 'هذه الفئة تحتوي على ' + subs.length + ' فئة فرعية. سيتم حذف الجميع.'
            : 'هل أنت متأكد من حذف هذه الفئة؟';
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
        var existingImageUrl = c.image || '';
        pendingCatImageFile = null;

        var mainCats = getMainCategories();
        var parentOptions = '<option value="">— بدون (فئة رئيسية) —</option>';
        mainCats.forEach(function (mc) {
            var sel = ((c.parentId || c.parent_id || parentId) === mc.id) ? ' selected' : '';
            parentOptions += '<option value="' + mc.id + '"' + sel + '>📁 ' + esc(mc.name) + '</option>';
            var subs = getSubcategories(mc.id);
            subs.forEach(function (sub) {
                var subSel = ((c.parentId || c.parent_id || parentId) === sub.id) ? ' selected' : '';
                parentOptions += '<option value="' + sub.id + '"' + subSel + '>&nbsp;&nbsp;&nbsp;└ ' + esc(sub.name) + '</option>';
            });
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
            + '<div class="admin-form-group full"><label>صورة الفئة (JPEG, PNG, WebP — حد أقصى 3MB)</label>'
            + '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">'
            + '<div id="catImagePreview" style="width:72px;height:72px;border-radius:10px;border:2px dashed rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;overflow:hidden;background:rgba(0,0,0,0.15);flex-shrink:0;">'
            + (existingImageUrl ? '<img src="' + esc(existingImageUrl) + '" style="width:100%;height:100%;object-fit:cover;border-radius:8px;" alt="صورة الفئة">' : '<i class="fas fa-image" style="font-size:1.3rem;opacity:0.3;"></i>')
            + '</div>'
            + '<div style="flex:1;min-width:0;">'
            + '<input type="file" id="catImageFile" accept="image/jpeg,image/png,image/webp" style="width:100%;">'
            + '<small style="color:var(--text-muted);display:block;margin-top:4px;">اختر صورة للفئة أو اتركه فارغاً.</small>'
            + '</div></div></div>'
            + '</div></form></div>'
            + '<div class="admin-slideover-footer"><button class="btn btn-primary" id="saveCatBtn"><i class="fas fa-save"></i> ' + (isEdit ? 'تحديث' : 'إضافة') + '</button><button class="btn btn-outline close-cat-form">إلغاء</button></div>';

        document.body.appendChild(backdrop);
        document.body.appendChild(panel);

        function close() { backdrop.remove(); panel.remove(); pendingCatImageFile = null; }
        backdrop.addEventListener('click', close);
        panel.querySelectorAll('.close-cat-form').forEach(function (b) { b.addEventListener('click', close); });

        /* Image preview on file select */
        var catImageFileInput = document.getElementById('catImageFile');
        if (catImageFileInput) {
            catImageFileInput.addEventListener('change', function () {
                var file = this.files && this.files[0];
                var preview = document.getElementById('catImagePreview');
                if (!file) { pendingCatImageFile = null; return; }
                if (!ALLOWED_IMAGE_TYPES.includes(file.type.toLowerCase())) {
                    A.showErrorToast('CAT-110', 'نوع الملف غير مدعوم.');
                    this.value = '';
                    return;
                }
                if (file.size > MAX_IMAGE_SIZE_BYTES) {
                    A.showErrorToast('CAT-111', 'حجم الصورة يتجاوز 3MB.');
                    this.value = '';
                    return;
                }
                pendingCatImageFile = file;
                var reader = new FileReader();
                reader.onload = function (e) {
                    if (preview) {
                        preview.innerHTML = '<img src="' + e.target.result + '" style="width:100%;height:100%;object-fit:cover;border-radius:8px;" alt="معاينة">';
                    }
                };
                reader.readAsDataURL(file);
            });
        }

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
                description: document.getElementById('catDesc').value.trim(),
                existingImage: existingImageUrl
            }, isEdit);

            if (ok) { close(); await TZ.refreshData(); renderCategories(); }
            else { this.disabled = false; this.innerHTML = '<i class="fas fa-save"></i> ' + (isEdit ? 'تحديث' : 'إضافة'); }
        });
    }

    /* ── Render ── */

    function renderCategories() {
        var mainCats = getMainCategories();
        var allCats = TZ.db.categories || [];
        var totalSubs = allCats.length - mainCats.length;
        var html = '';

        html += '<div class="admin-section-header">'
            + '<div><h2><i class="fas fa-sitemap"></i> إدارة الفئات</h2>'
            + '<p>' + mainCats.length + ' قسم رئيسي — ' + totalSubs + ' فئة فرعية وتصنيف</p></div>'
            + '<div class="admin-section-actions">'
            + '<button class="btn btn-primary btn-sm" id="addMainCatBtn"><i class="fas fa-plus"></i> قسم رئيسي</button>'
            + '</div></div>';

        if (mainCats.length === 0) {
            html += '<div class="admin-panel"><div class="panel-body"><div class="empty-state"><i class="fas fa-sitemap"></i><p>لا توجد أقسام بعد. أضف قسمًا رئيسيًا للبدء.</p></div></div></div>';
        } else {
            mainCats.forEach(function (mc) {
                var subs = getSubcategories(mc.id);
                var iconHtml = mc.icon ? '<i class="fas ' + esc(mc.icon) + '"></i> ' : '<i class="fas fa-folder"></i> ';
                var mcThumb = mc.image || '';

                html += '<div class="admin-panel">'
                    + '<div class="panel-header">'
                    + '<h2 style="display:flex;align-items:center;gap:10px;">'
                    + (mcThumb ? '<img src="' + esc(mcThumb) + '" style="width:32px;height:32px;border-radius:8px;object-fit:cover;" alt="" loading="lazy">' : '')
                    + iconHtml + esc(mc.name) + ' <span style="font-weight:400;font-size:0.82rem;color:var(--text-muted);">(' + subs.length + ' فئة)</span></h2>'
                    + '<div class="actions-cell">'
                    + '<button class="btn btn-outline btn-sm add-sub-btn" data-parent="' + mc.id + '"><i class="fas fa-plus"></i> فئة فرعية</button>'
                    + '<button class="action-btn edit-cat-btn" data-id="' + mc.id + '"><i class="fas fa-edit"></i></button>'
                    + '<button class="action-btn danger delete-cat-btn" data-id="' + mc.id + '"><i class="fas fa-trash"></i></button>'
                    + '</div></div>'
                    + '<div class="panel-body">';

                if (subs.length > 0) {
                    subs.forEach(function (sub) {
                        var subThumb = sub.image || '';
                        var subSubs = getSubcategories(sub.id);

                        html += '<div style="border:1px solid rgba(255,255,255,0.06);border-radius:14px;margin-bottom:10px;overflow:hidden;">';

                        /* Sub header row */
                        html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:rgba(255,255,255,0.03);">'
                            + '<div style="display:flex;align-items:center;gap:10px;">'
                            + (subThumb ? '<img src="' + esc(subThumb) + '" style="width:30px;height:30px;border-radius:6px;object-fit:cover;" alt="" loading="lazy">' : '')
                            + (sub.icon ? '<i class="fas ' + esc(sub.icon) + '" style="color:var(--text-muted);"></i>' : '')
                            + '<strong>' + esc(sub.name) + '</strong>'
                            + '<span class="status-badge ' + sub.status + '" style="font-size:0.72rem;">' + (sub.status === 'active' ? 'نشطة' : 'مخفية') + '</span>'
                            + (subSubs.length > 0 ? '<span style="font-size:0.78rem;color:var(--text-muted);">(' + subSubs.length + ' تصنيف)</span>' : '')
                            + '</div>'
                            + '<div class="actions-cell" style="gap:4px;">'
                            + '<button class="btn btn-outline btn-sm add-sub-btn" data-parent="' + sub.id + '" style="font-size:0.75rem;padding:4px 10px;"><i class="fas fa-plus"></i> تصنيف</button>'
                            + '<button class="action-btn edit-cat-btn" data-id="' + sub.id + '"><i class="fas fa-edit"></i></button>'
                            + '<button class="action-btn danger delete-cat-btn" data-id="' + sub.id + '"><i class="fas fa-trash"></i></button>'
                            + '</div></div>';

                        /* Sub-sub items (Level 3) */
                        if (subSubs.length > 0) {
                            html += '<div style="padding:0 16px 10px;background:rgba(131,56,236,0.03);">';
                            subSubs.forEach(function (ss) {
                                var ssThumb = ss.image || '';
                                html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-radius:8px;margin-top:6px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.04);">'
                                    + '<div style="display:flex;align-items:center;gap:8px;">'
                                    + '<span style="color:rgba(177,92,255,0.5);font-size:0.75rem;">└</span>'
                                    + (ssThumb ? '<img src="' + esc(ssThumb) + '" style="width:24px;height:24px;border-radius:5px;object-fit:cover;" alt="" loading="lazy">' : '')
                                    + '<span style="font-weight:600;font-size:0.88rem;">' + esc(ss.name) + '</span>'
                                    + '<span class="status-badge ' + ss.status + '" style="font-size:0.68rem;">' + (ss.status === 'active' ? 'نشطة' : 'مخفية') + '</span>'
                                    + '</div>'
                                    + '<div class="actions-cell" style="gap:3px;">'
                                    + '<button class="action-btn edit-cat-btn" data-id="' + ss.id + '" style="width:30px;height:30px;"><i class="fas fa-edit"></i></button>'
                                    + '<button class="action-btn danger delete-cat-btn" data-id="' + ss.id + '" style="width:30px;height:30px;"><i class="fas fa-trash"></i></button>'
                                    + '</div></div>';
                            });
                            html += '</div>';
                        }

                        html += '</div>';
                    });
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
