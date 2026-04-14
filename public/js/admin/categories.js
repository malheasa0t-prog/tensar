// ===== TechZone Admin - Categories =====
(function () {
    'use strict';

    const A = window.AdminApp;
    const accessoryCatalog = A.accessoryCatalog || TZ.accessoryCatalog || {};
    const state = A.categoriesState || (A.categoriesState = { viewMode: 'all', showForm: false, editingId: '', form: null });

    function escapeText(value) {
        return TZ.escapeHtml(value == null ? '' : String(value));
    }

    function getActorId() {
        return TZ.getSession ? TZ.getSession()?.userId : null;
    }

    function isAccessoryCategory(categoryId) {
        return typeof accessoryCatalog.isAccessoryCatalogCategoryId === 'function'
            ? accessoryCatalog.isAccessoryCatalogCategoryId(categoryId)
            : false;
    }

    function visibleCategories() {
        return (TZ.db.categories || []).filter((category) => !isAccessoryCategory(category.id));
    }

    function mainCategories() {
        return visibleCategories().filter((category) => !category.parentId);
    }

    function topNavMap() {
        if (!TZ.db.settings) TZ.db.settings = {};
        if (!TZ.db.settings.categoryNavVisibility) TZ.db.settings.categoryNavVisibility = {};
        return TZ.db.settings.categoryNavVisibility;
    }

    function captureState() {
        return {
            categories: TZ.clone(TZ.db.categories || []),
            products: TZ.clone(TZ.db.products || []),
            services: TZ.clone(TZ.db.services || []),
            settings: TZ.clone(TZ.db.settings || {})
        };
    }

    function restoreState(snapshot) {
        TZ.db.categories = TZ.clone(snapshot.categories || []);
        TZ.db.products = TZ.clone(snapshot.products || []);
        TZ.db.services = TZ.clone(snapshot.services || []);
        TZ.db.settings = TZ.clone(snapshot.settings || {});
    }

    async function commitChange(action, details, resource) {
        await Promise.resolve(TZ.commitDb(action, getActorId(), details, resource));
    }

    async function runMutation(mutator, successMessage, fallbackMessage) {
        const snapshot = captureState();
        try {
            const tasks = mutator() || [];
            for (const task of tasks) await task();
            render(state.viewMode);
            A.showToast(successMessage);
        } catch (error) {
            restoreState(snapshot);
            render(state.viewMode);
            A.showToast(error?.message || fallbackMessage);
        }
    }

    function slugify(value) {
        return String(value || '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^\u0600-\u06FFa-z0-9-_]/g, '')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    }

    function uniqueSlug(baseSlug, currentId) {
        const raw = baseSlug || 'category';
        const existing = new Set(
            visibleCategories()
                .filter((category) => category.id !== currentId)
                .map((category) => String(category.slug || '').trim())
                .filter(Boolean)
        );
        if (!existing.has(raw)) return raw;
        let index = 2;
        while (existing.has(`${raw}-${index}`)) index += 1;
        return `${raw}-${index}`;
    }

    function createForm(type) {
        return {
            type,
            parentId: type === 'sub' ? (mainCategories()[0]?.id || '') : '',
            name: '',
            slug: '',
            icon: 'fa-folder',
            image: '',
            description: '',
            status: 'active',
            sortOrder: '0',
            showInNavbar: type === 'main'
        };
    }

    function fillForm(category) {
        return {
            type: category.parentId ? 'sub' : 'main',
            parentId: category.parentId || '',
            name: category.name || '',
            slug: category.slug || '',
            icon: category.icon || 'fa-folder',
            image: category.image || '',
            description: category.description || '',
            status: category.status || 'active',
            sortOrder: String(category.sortOrder || 0),
            showInNavbar: category.showInNavbar !== false
        };
    }

    function openForm(type, category) {
        state.editingId = category?.id || '';
        state.form = category ? fillForm(category) : createForm(type);
        state.showForm = true;
        render(state.viewMode);
    }

    function closeForm() {
        state.editingId = '';
        state.form = null;
        state.showForm = false;
        render(state.viewMode);
    }

    function getParentName(parentId) {
        if (!parentId) return '—';
        const parent = visibleCategories().find((category) => category.id === parentId);
        return parent?.name || 'غير معروف';
    }

    function isVisibleInTopNav(category) {
        return !category.parentId && topNavMap()[category.id] !== false && category.showInNavbar !== false;
    }

    function switchAdminSection(section) {
        A.currentSection = section;
        document.querySelectorAll('.sidebar-link').forEach((link) => {
            link.classList.toggle('active', link.dataset.section === section);
        });
        A.renderSection(section);
    }

    function collectCategoryIds(rootId) {
        const ids = new Set([rootId]);
        let changed = true;
        while (changed) {
            changed = false;
            visibleCategories().forEach((category) => {
                if (category.parentId && ids.has(category.parentId) && !ids.has(category.id)) {
                    ids.add(category.id);
                    changed = true;
                }
            });
        }
        return ids;
    }

    function renderFormPanel() {
        if (!state.showForm || !state.form) return '';
        const mains = mainCategories();
        const submitLabel = state.editingId ? 'حفظ الفئة' : 'إضافة الفئة';
        return `
            <div class="admin-panel" style="margin-bottom:18px;">
                <div class="panel-header"><h2>${state.editingId ? 'تعديل الفئة' : 'إضافة فئة جديدة'}</h2></div>
                <div class="panel-body">
                    <form id="categoryForm" class="admin-form admin-form-stack">
                        <div class="admin-polish-grid">
                            <input id="categoryName" placeholder="اسم الفئة" value="${escapeText(state.form.name)}" required>
                            <input id="categorySlug" placeholder="slug" value="${escapeText(state.form.slug)}">
                            <input id="categoryIcon" placeholder="fa-laptop" value="${escapeText(state.form.icon)}">
                            <input id="categorySortOrder" type="number" min="0" placeholder="الترتيب" value="${escapeText(state.form.sortOrder)}">
                        </div>
                        <div class="admin-polish-grid">
                            <select id="categoryType">
                                <option value="main" ${state.form.type === 'main' ? 'selected' : ''}>فئة رئيسية</option>
                                <option value="sub" ${state.form.type === 'sub' ? 'selected' : ''}>فئة فرعية</option>
                            </select>
                            <select id="categoryParent" ${state.form.type === 'sub' ? '' : 'disabled'}>
                                <option value="">اختر الفئة الرئيسية</option>
                                ${mains.map((category) => `<option value="${escapeText(category.id)}" ${state.form.parentId === category.id ? 'selected' : ''}>${escapeText(category.name)}</option>`).join('')}
                            </select>
                            <select id="categoryStatus">
                                <option value="active" ${state.form.status === 'active' ? 'selected' : ''}>نشطة</option>
                                <option value="hidden" ${state.form.status === 'hidden' ? 'selected' : ''}>مخفية</option>
                            </select>
                            <label class="admin-toggle-card">
                                <input id="categoryShowInNavbar" type="checkbox" ${state.form.showInNavbar ? 'checked' : ''} ${state.form.type === 'sub' ? 'disabled' : ''}>
                                <span>إظهار في الشريط العلوي</span>
                            </label>
                        </div>
                        <div style="margin-bottom:12px;">
                            <label style="display:block;margin-bottom:8px;font-weight:700;">صورة الفئة (اختياري)</label>
                            <input type="file" id="categoryImageFile" accept="image/*" style="display:none;">
                            <div class="image-upload-area" id="categoryImageUploadArea" style="cursor:pointer;padding:15px;border:2px dashed var(--border-color);border-radius:12px;text-align:center;background:var(--bg-lighter);">
                                <i class="fas fa-image" style="font-size:1.5rem;color:var(--text-muted);margin-bottom:8px;display:block;"></i>
                                <span style="font-size:0.9rem;color:var(--text-muted);">انقر لاختيار صورة للمرفقات (حد أقصى ${A.getAdminImageUploadLimitText()})</span>
                            </div>
                            <div id="categoryImagePreview" style="margin-top:10px;text-align:center;${state.form.image ? '' : 'display:none;'}">
                                <img src="${escapeText(state.form.image)}" style="max-width:150px;max-height:150px;border-radius:8px;border:1px solid var(--border-color);">
                            </div>
                            <input id="categoryImage" type="hidden" value="${escapeText(state.form.image)}">
                        </div>
                        <textarea id="categoryDescription" rows="3" placeholder="وصف مختصر">${escapeText(state.form.description)}</textarea>
                        <div class="admin-form-actions">
                            <button class="btn btn-primary" type="submit">${submitLabel}</button>
                            <button class="btn btn-outline" type="button" id="cancelCategoryFormBtn">إلغاء</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    }

    function renderRows() {
        const categories = visibleCategories()
            .filter((category) => state.viewMode === 'main' ? !category.parentId : state.viewMode === 'sub' ? !!category.parentId : true)
            .sort((first, second) => (first.parentId ? 1 : 0) - (second.parentId ? 1 : 0) || (first.sortOrder || 0) - (second.sortOrder || 0));

        if (categories.length === 0) {
            return '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:22px;">لا توجد فئات مضافة بعد.</td></tr>';
        }

        return categories.map((category) => `
            <tr>
                <td><img src="${category.image || 'https://placehold.co/100x100/1e293b/a9bww2?text=NA'}" alt="N/A" style="width:40px;height:40px;border-radius:6px;object-fit:cover;"></td>
                <td>${category.parentId ? 'فرعية' : 'رئيسية'}</td>
                <td><strong>${escapeText(category.name)}</strong></td>
                <td>${escapeText(getParentName(category.parentId))}</td>
                <td>${escapeText(category.sortOrder || 0)}</td>
                <td>${escapeText(category.slug || '—')}</td>
                <td>${category.status === 'active' ? 'ظاهرة' : 'مخفية'}</td>
                <td>${category.parentId ? '—' : (isVisibleInTopNav(category) ? 'نعم' : 'لا')}</td>
                <td>
                    <div style="display:flex;gap:8px;flex-wrap:wrap;">
                        <button class="btn btn-outline btn-sm" data-action="edit" data-id="${escapeText(category.id)}">تعديل</button>
                        <button class="btn btn-outline btn-sm" data-action="toggle" data-id="${escapeText(category.id)}">إظهار/إخفاء</button>
                        ${!category.parentId ? `<button class="btn btn-outline btn-sm" data-action="nav" data-id="${escapeText(category.id)}">الشريط العلوي</button>` : ''}
                        <button class="btn btn-outline btn-sm" data-action="delete" data-id="${escapeText(category.id)}" style="border-color:rgba(231,76,60,0.4);color:#ff7675;">حذف</button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    function render(viewMode) {
        state.viewMode = viewMode || state.viewMode || 'all';
        const mains = mainCategories().length;
        const subs = visibleCategories().filter((category) => category.parentId).length;

        A.adminContent.innerHTML = `
            <div class="admin-panel" style="margin-bottom:18px;">
                <div class="panel-body admin-quick-grid">
                    <div><strong style="font-size:1.2rem;">${mains}</strong><div style="color:var(--text-muted);">فئات رئيسية</div></div>
                    <div><strong style="font-size:1.2rem;">${subs}</strong><div style="color:var(--text-muted);">فئات فرعية</div></div>
                    <div><strong style="font-size:1.2rem;">${visibleCategories().length}</strong><div style="color:var(--text-muted);">إجمالي الفئات</div></div>
                </div>
            </div>
            <div class="admin-panel" style="margin-bottom:18px;">
                <div class="panel-body admin-form-actions">
                    <button class="btn btn-primary" id="addMainCategoryBtn">إضافة فئة رئيسية</button>
                    <button class="btn btn-outline" id="addSubCategoryBtn">إضافة فئة فرعية</button>
                    <button class="btn btn-outline" id="openProductsSectionBtn">الانتقال إلى المنتجات</button>
                </div>
            </div>
            ${renderFormPanel()}
            <div class="admin-panel">
                <div class="panel-header"><h2>إدارة الفئات</h2></div>
                <div class="panel-body">
                    <div class="table-wrap">
                        <table class="data-table">
                            <thead><tr><th style="width:50px;">الصورة</th><th>النوع</th><th>الاسم</th><th>الأب</th><th>الترتيب</th><th>Slug</th><th>الحالة</th><th>الشريط العلوي</th><th>إجراءات</th></tr></thead>
                            <tbody>${renderRows()}</tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('addMainCategoryBtn')?.addEventListener('click', () => openForm('main'));
        document.getElementById('addSubCategoryBtn')?.addEventListener('click', () => {
            if (mainCategories().length === 0) return A.showToast('أضف فئة رئيسية أولًا.');
            openForm('sub');
        });
        document.getElementById('openProductsSectionBtn')?.addEventListener('click', () => switchAdminSection('products'));
        document.getElementById('cancelCategoryFormBtn')?.addEventListener('click', closeForm);
        document.getElementById('categoryType')?.addEventListener('change', (event) => {
            const isSub = event.target.value === 'sub';
            const parentInput = document.getElementById('categoryParent');
            const navbarInput = document.getElementById('categoryShowInNavbar');
            parentInput.disabled = !isSub;
            navbarInput.disabled = isSub;
            if (!isSub) parentInput.value = '';
        });
        
        document.getElementById('categoryImageUploadArea')?.addEventListener('click', () => {
            document.getElementById('categoryImageFile').click();
        });
        document.getElementById('categoryImageFile')?.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (!file) return;
            if (A.isAdminImageUploadTooLarge(file)) return A.showAdminImageUploadLimitToast();
            const reader = new FileReader();
            reader.onload = function(event) {
                const dataUrl = event.target.result;
                document.getElementById('categoryImage').value = dataUrl;
                const preview = document.getElementById('categoryImagePreview');
                preview.style.display = 'block';
                preview.innerHTML = `<img src="${dataUrl}" style="max-width:150px;max-height:150px;border-radius:8px;border:1px solid var(--border-color);">`;
            };
            reader.readAsDataURL(file);
        });

        document.getElementById('categoryForm')?.addEventListener('submit', handleSubmit);
        A.adminContent.querySelectorAll('[data-action]').forEach((button) => button.addEventListener('click', handleRowAction));
    }

    async function handleSubmit(event) {
        event.preventDefault();
        const type = document.getElementById('categoryType').value;
        const parentId = type === 'sub' ? document.getElementById('categoryParent').value : '';
        const name = document.getElementById('categoryName').value.trim();
        if (!name) return A.showToast('يرجى إدخال اسم الفئة.');
        if (type === 'sub' && !parentId) return A.showToast('اختر الفئة الرئيسية أولًا.');

        const formData = {
            id: state.editingId || TZ.generateId('cat-'),
            name,
            parentId: parentId || null,
            status: document.getElementById('categoryStatus').value,
            showInNavbar: type === 'main' && document.getElementById('categoryShowInNavbar').checked,
            sortOrder: Number(document.getElementById('categorySortOrder').value || 0),
            icon: document.getElementById('categoryIcon').value.trim() || 'fa-folder',
            image: document.getElementById('categoryImage').value.trim(),
            description: document.getElementById('categoryDescription').value.trim(),
            slug: uniqueSlug(slugify(document.getElementById('categorySlug').value || name), state.editingId || '')
        };

        await runMutation(() => {
            const collection = TZ.db.categories || (TZ.db.categories = []);
            const existing = collection.find((category) => category.id === formData.id);
            if (existing) Object.assign(existing, formData);
            else collection.push(formData);
            if (formData.parentId) delete topNavMap()[formData.id];
            else topNavMap()[formData.id] = formData.showInNavbar;
            state.showForm = false;
            state.editingId = '';
            state.form = null;

            return [
                () => commitChange(existing ? 'category_update' : 'category_create', formData.name, { type: 'category', data: formData }),
                () => commitChange('settings_update', `تحديث ظهور الفئة في الشريط العلوي: ${formData.name}`, { type: 'settings_update', data: TZ.db.settings })
            ];
        }, state.editingId ? 'تم تحديث الفئة.' : 'تمت إضافة الفئة.', 'تعذر حفظ الفئة في قاعدة البيانات.');
    }

    async function handleRowAction(event) {
        const category = visibleCategories().find((item) => item.id === event.currentTarget.dataset.id);
        if (!category) return;
        const action = event.currentTarget.dataset.action;
        if (action === 'edit') return openForm(category.parentId ? 'sub' : 'main', category);
        if (action === 'toggle') {
            return runMutation(() => {
                category.status = category.status === 'active' ? 'hidden' : 'active';
                return [() => commitChange('category_toggle', `${category.name}: ${category.status}`, { type: 'category', data: category })];
            }, 'تم تحديث حالة الفئة.', 'تعذر تحديث حالة الفئة.');
        }
        if (action === 'nav') {
            return runMutation(() => {
                category.showInNavbar = !isVisibleInTopNav(category);
                topNavMap()[category.id] = category.showInNavbar;
                return [() => commitChange('settings_update', `تحديث ظهور الفئة في الشريط العلوي: ${category.name}`, { type: 'settings_update', data: TZ.db.settings })];
            }, 'تم تحديث ظهور الفئة في الشريط العلوي.', 'تعذر تحديث ظهور الفئة في الشريط العلوي.');
        }

        const categoryIds = collectCategoryIds(category.id);
        const categoriesToDelete = visibleCategories().filter((item) => categoryIds.has(item.id));
        const productsToDelete = (TZ.db.products || []).filter((item) => categoryIds.has(item.categoryId));
        const servicesToDelete = (TZ.db.services || []).filter((item) => categoryIds.has(item.subcategoryId || item.categoryId));
        const sortedCategories = categoriesToDelete.slice().sort((first, second) => Number(Boolean(second.parentId)) - Number(Boolean(first.parentId)));
        A.showConfirmModal('حذف الفئة', `سيتم حذف ${categoriesToDelete.length} فئة و${productsToDelete.length} منتج و${servicesToDelete.length} خدمة. هل تريد المتابعة؟`, async () => {
            await runMutation(() => {
                TZ.db.categories = (TZ.db.categories || []).filter((item) => !categoryIds.has(item.id));
                TZ.db.products = (TZ.db.products || []).filter((item) => !categoryIds.has(item.categoryId));
                TZ.db.services = (TZ.db.services || []).filter((item) => !categoryIds.has(item.subcategoryId || item.categoryId));
                sortedCategories.forEach((item) => delete topNavMap()[item.id]);
                return [
                    ...servicesToDelete.map((item) => () => commitChange('service_delete', item.name, { type: 'service_delete', data: { id: item.id } })),
                    ...productsToDelete.map((item) => () => commitChange('product_delete', item.name, { type: 'product_delete', data: { id: item.id } })),
                    ...sortedCategories.map((item) => () => commitChange('category_delete', item.name, { type: 'category_delete', data: { id: item.id } })),
                    () => commitChange('settings_update', 'تحديث إعدادات الفئات', { type: 'settings_update', data: TZ.db.settings })
                ];
            }, 'تم حذف الفئة وكل العناصر المرتبطة بها.', 'تعذر حذف الفئة من قاعدة البيانات.');
        });
    }

    A.sections.categories = () => render('all');
    A.sections['main-categories'] = () => render('main');
    A.sections.subcategories = () => render('sub');
})();
