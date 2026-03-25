// ===== TechZone Admin - Hierarchical Categories =====
(function () {
    'use strict';

    const A = window.AdminApp;
    const accessoryCatalog = A.accessoryCatalog || TZ.accessoryCatalog || {};

    function isAccessoryCatalogCategoryId(categoryId) {
        return typeof accessoryCatalog.isAccessoryCatalogCategoryId === 'function'
            ? accessoryCatalog.isAccessoryCatalogCategoryId(categoryId)
            : false;
    }

    function getVisibleCategories() {
        return TZ.db.categories.filter((category) => !isAccessoryCatalogCategoryId(category.id));
    }

    function slugifyArabic(text) {
        return (text || '')
            .toString()
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^\u0600-\u06FFa-z0-9-_]/g, '')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    }

    function upsertUniqueSlug(baseSlug, currentId) {
        const clean = baseSlug || 'category';
        const existing = new Set(
            TZ.db.categories
                .filter((category) => category.id !== currentId)
                .map((category) => (category.slug || '').trim())
                .filter(Boolean)
        );

        if (!existing.has(clean)) return clean;

        let index = 2;
        while (existing.has(`${clean}-${index}`)) index += 1;
        return `${clean}-${index}`;
    }

    function mainCategories() {
        return getVisibleCategories()
            .filter((category) => !category.parentId)
            .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    }

    function subCategories() {
        return getVisibleCategories()
            .filter((category) => !!category.parentId)
            .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    }

    function categoryTypeLabel(category) {
        return category.parentId ? 'فرعية' : 'رئيسية';
    }

    function categoryStatusBadge(status) {
        return status === 'active'
            ? '<span class="status-badge active">ظاهر</span>'
            : '<span class="status-badge hidden">مخفي</span>';
    }

    function getTopNavVisibilityMap() {
        if (!TZ.db.settings) TZ.db.settings = {};
        if (!TZ.db.settings.categoryNavVisibility) TZ.db.settings.categoryNavVisibility = {};
        return TZ.db.settings.categoryNavVisibility;
    }

    function shouldShowInTopNav(category) {
        const map = getTopNavVisibilityMap();
        if (Object.prototype.hasOwnProperty.call(map, category.id)) {
            return map[category.id] !== false;
        }
        return category.showInNavbar !== false;
    }

    function topNavStatusBadge(category) {
        if (category.parentId) return '<span style="color:var(--text-muted)">—</span>';
        return shouldShowInTopNav(category)
            ? '<span class="status-badge active">يظهر</span>'
            : '<span class="status-badge hidden">مخفي</span>';
    }

    function switchAdminSection(section) {
        A.currentSection = section;
        document.querySelectorAll('.sidebar-link').forEach((link) => {
            link.classList.toggle('active', link.dataset.section === section);
        });
        A.renderSection(section);
    }

    function renderCategories(viewMode = 'all') {
        const mains = mainCategories();
        const subs = subCategories();
        const visibleCategories = getVisibleCategories()
            .slice()
            .sort((a, b) => {
                const aDepth = a.parentId ? 1 : 0;
                const bDepth = b.parentId ? 1 : 0;
                if (aDepth !== bDepth) return aDepth - bDepth;
                if ((a.parentId || '') !== (b.parentId || '')) return (a.parentId || '').localeCompare(b.parentId || '');
                return (a.sortOrder || 0) - (b.sortOrder || 0);
            })
            .filter((category) => {
                if (viewMode === 'main') return !category.parentId;
                if (viewMode === 'sub') return !!category.parentId;
                return true;
            });
        const viewTitle = viewMode === 'main'
            ? 'إدارة الفئات الرئيسية'
            : viewMode === 'sub'
                ? 'إدارة الفئات الفرعية'
                : 'إدارة الفئات الهرمية';
        const viewHint = viewMode === 'main'
            ? 'هنا تضيف الأقسام العليا التي تندرج تحتها الفئات الفرعية.'
            : viewMode === 'sub'
                ? 'هنا تضيف الفئات الفرعية التي يمكن ربط المنتجات والخدمات بها.'
                : 'هنا تتابع العلاقة بين الفئات الرئيسية والفئات الفرعية من مكان واحد.';

        A.adminContent.innerHTML = `
            ${viewMode !== 'all' ? `
                <div class="admin-panel" style="margin-bottom:18px;">
                    <div class="panel-body" style="display:grid;gap:10px;">
                        <strong>${viewTitle}</strong>
                        <div style="color:var(--text-muted);font-size:.92rem;">${viewHint}</div>
                        <div style="display:flex;gap:10px;flex-wrap:wrap;">
                            ${viewMode !== 'main' ? '<button class="btn btn-outline btn-sm" id="jumpMainCategoriesBtn">فتح الفئات الرئيسية</button>' : ''}
                            ${viewMode !== 'sub' ? '<button class="btn btn-outline btn-sm" id="jumpSubCategoriesBtn">فتح الفئات الفرعية</button>' : ''}
                            <button class="btn btn-outline btn-sm" id="jumpCategoryHubBtn">فتح مركز الفئات</button>
                        </div>
                    </div>
                </div>
            ` : ''}

            <div class="admin-panel" style="margin-bottom:18px;">
                <div class="panel-header">
                    <h2><i class="fas fa-sitemap"></i> ${viewTitle} (${visibleCategories.length})</h2>
                    <div style="display:flex;gap:10px;flex-wrap:wrap;">
                        <button class="btn btn-primary btn-sm" id="addMainCategoryBtn">إضافة فئة رئيسية</button>
                        <button class="btn btn-outline btn-sm" id="addSubCategoryBtn">إضافة فئة فرعية</button>
                        <button class="btn btn-outline btn-sm" id="openProductsSectionBtn">الانتقال إلى المنتجات</button>
                    </div>
                </div>
                <div class="panel-body">
                    <div class="table-wrap">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>النوع</th>
                                    <th>الاسم</th>
                                    <th>الأب</th>
                                    <th>الترتيب</th>
                                    <th>الرابط (slug)</th>
                                    <th>الحالة</th>
                                    <th>الشريط العلوي</th>
                                    <th>إجراءات</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${visibleCategories
                                    .map((category) => {
                                        const parent = category.parentId ? TZ.db.categories.find((item) => item.id === category.parentId) : null;
                                        const servicesCount = (TZ.db.services || []).filter((service) => (service.subcategoryId || service.categoryId) === category.id).length;
                                        const productsCount = TZ.db.products.filter((product) => product.categoryId === category.id).length;

                                        return `
                                            <tr>
                                                <td>${categoryTypeLabel(category)}</td>
                                                <td>
                                                    <strong>${TZ.escapeHtml(category.name)}</strong>
                                                    ${category.description ? `<br><small style="color:var(--text-muted)">${TZ.escapeHtml(category.description.substring(0, 70))}</small>` : ''}
                                                    ${category.image ? '<br><small style="color:var(--success)">صورة مرفقة</small>' : ''}
                                                    ${(servicesCount || productsCount) ? `<br><small style="color:var(--text-muted)">خدمات: ${servicesCount} | منتجات: ${productsCount}</small>` : ''}
                                                </td>
                                                <td>${parent ? TZ.escapeHtml(parent.name) : '—'}</td>
                                                <td>${Number(category.sortOrder || 0)}</td>
                                                <td><code>${TZ.escapeHtml(category.slug || '')}</code></td>
                                                <td>${categoryStatusBadge(category.status || 'active')}</td>
                                                <td>${topNavStatusBadge(category)}</td>
                                                <td class="actions-cell">
                                                    <button class="action-btn edit-cat-btn" data-id="${category.id}" title="تعديل"><i class="fas fa-edit"></i></button>
                                                    <button class="action-btn success toggle-cat-btn" data-id="${category.id}" title="إظهار/إخفاء"><i class="fas fa-toggle-on"></i></button>
                                                    ${!category.parentId ? `<button class="action-btn warning toggle-nav-btn" data-id="${category.id}" title="إظهار/إخفاء في الشريط العلوي"><i class="fas fa-bars"></i></button>` : ''}
                                                    <button class="action-btn danger delete-cat-btn" data-id="${category.id}" title="حذف"><i class="fas fa-trash"></i></button>
                                                </td>
                                            </tr>
                                        `;
                                    }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div class="admin-panel" id="categoryFormPanel" style="display:none;">
                <div class="panel-header"><h2 id="catFormTitle"><i class="fas fa-plus"></i> إضافة فئة</h2></div>
                <div class="panel-body padded">
                    <div style="margin-bottom:18px;padding:14px;border:1px solid var(--border-color);border-radius:12px;background:var(--bg-lighter);display:grid;gap:8px;">
                        <strong>أفضل ترتيب للعمل</strong>
                        <div style="color:var(--text-muted);font-size:.92rem;">ابدأ بالفئة الرئيسية، ثم أضف الفئة الفرعية التابعة لها، وبعد الحفظ انتقل إلى قسم المنتجات.</div>
                        <div style="display:flex;gap:10px;flex-wrap:wrap;">
                            <button type="button" class="btn btn-outline btn-sm" id="jumpToProductsBtn">الذهاب إلى المنتجات</button>
                        </div>
                    </div>

                    <form class="admin-form" id="categoryForm">
                        <div class="form-grid">
                            <div class="admin-form-group">
                                <label>نوع الفئة *</label>
                                <select id="catType" required>
                                    <option value="main">رئيسية</option>
                                    <option value="sub">فرعية</option>
                                </select>
                            </div>
                            <div class="admin-form-group" id="parentWrap" style="display:none;">
                                <label>الفئة الرئيسية *</label>
                                <select id="catParentId">
                                    <option value="">اختر فئة رئيسية</option>
                                    ${mains.map((category) => `<option value="${category.id}">${TZ.escapeHtml(category.name)}</option>`).join('')}
                                </select>
                            </div>
                            <div class="admin-form-group">
                                <label>اسم الفئة *</label>
                                <div class="admin-input-wrap"><i class="fas fa-tag"></i><input type="text" id="catName" required></div>
                            </div>
                            <div class="admin-form-group">
                                <label>Slug (يتولد تلقائياً)</label>
                                <div class="admin-input-wrap"><i class="fas fa-link"></i><input type="text" id="catSlug" placeholder="auto-generated"></div>
                            </div>
                            <div class="admin-form-group">
                                <label>الحالة</label>
                                <select id="catStatus">
                                    <option value="active">ظاهر</option>
                                    <option value="hidden">مخفي</option>
                                </select>
                            </div>
                            <div class="admin-form-group" id="catTopNavWrap">
                                <label style="display:flex;align-items:center;gap:.5rem;cursor:pointer;">
                                    <input type="checkbox" id="catShowInNavbar" checked>
                                    إظهار الفئة الرئيسية في الشريط العلوي
                                </label>
                            </div>
                            <div class="admin-form-group">
                                <label>الترتيب</label>
                                <div class="admin-input-wrap"><i class="fas fa-sort-numeric-down"></i><input type="number" id="catSortOrder" min="0" value="0"></div>
                            </div>
                            <div class="admin-form-group">
                                <label>الأيقونة</label>
                                <div class="admin-input-wrap"><i class="fas fa-icons"></i><input type="text" id="catIcon" placeholder="fa-layer-group"></div>
                            </div>
                            <div class="admin-form-group full">
                                <label>الوصف</label>
                                <textarea id="catDescription" rows="3"></textarea>
                            </div>
                            <div class="admin-form-group full">
                                <label>صورة الفئة</label>
                                <div class="image-upload-area" id="catImageUploadArea" style="cursor:pointer;">
                                    <i class="fas fa-cloud-upload-alt"></i>
                                    <p>اضغط لرفع صورة (حد أقصى 1MB)</p>
                                    <input type="file" id="catImageInput" accept="image/*" style="display:none;">
                                </div>
                                <div id="catImagePreview" style="margin-top:10px;"></div>
                            </div>
                        </div>
                        <div style="margin-top:15px;display:flex;gap:10px;">
                            <button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> حفظ</button>
                            <button type="button" class="btn btn-outline" id="cancelCatBtn">إلغاء</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        bindCategoryEvents();
    }

    function bindCategoryEvents() {
        const formPanel = document.getElementById('categoryFormPanel');
        const form = document.getElementById('categoryForm');
        const typeInput = document.getElementById('catType');
        const parentWrap = document.getElementById('parentWrap');
        const parentInput = document.getElementById('catParentId');
        const nameInput = document.getElementById('catName');
        const slugInput = document.getElementById('catSlug');
        const statusInput = document.getElementById('catStatus');
        const topNavWrap = document.getElementById('catTopNavWrap');
        const showInNavbarInput = document.getElementById('catShowInNavbar');
        const sortInput = document.getElementById('catSortOrder');
        const iconInput = document.getElementById('catIcon');
        const descInput = document.getElementById('catDescription');
        const preview = document.getElementById('catImagePreview');
        let imageValue = '';

        function applyTypeVisibility() {
            const isSub = typeInput.value === 'sub';
            parentWrap.style.display = isSub ? '' : 'none';
            parentInput.required = isSub;
            if (!isSub) parentInput.value = '';
            topNavWrap.style.display = isSub ? 'none' : '';
            if (isSub) showInNavbarInput.checked = false;
        }

        function renderImagePreview() {
            if (!imageValue) {
                preview.innerHTML = '';
                return;
            }

            preview.innerHTML = `
                <div class="image-preview" style="display:inline-block;position:relative;">
                    <img src="${imageValue}" alt="صورة الفئة" style="max-width:120px;border-radius:8px;">
                    <button type="button" class="remove-img" style="position:absolute;top:-5px;right:-5px;background:#e74c3c;color:#fff;border:none;border-radius:50%;width:22px;height:22px;cursor:pointer;font-size:10px;"><i class="fas fa-times"></i></button>
                </div>
            `;

            preview.querySelector('.remove-img')?.addEventListener('click', () => {
                imageValue = '';
                renderImagePreview();
            });
        }

        function setFormData(category, forcedType) {
            const isSub = forcedType ? forcedType === 'sub' : !!category?.parentId;
            form.reset();
            slugInput.dataset.edited = '';
            typeInput.value = isSub ? 'sub' : 'main';
            applyTypeVisibility();
            statusInput.value = category?.status || 'active';
            sortInput.value = Number(category?.sortOrder || 0);
            iconInput.value = category?.icon || '';
            descInput.value = category?.description || '';
            nameInput.value = category?.name || '';
            slugInput.value = category?.slug || '';
            parentInput.value = category?.parentId || '';
            showInNavbarInput.checked = isSub ? false : (category ? shouldShowInTopNav(category) : true);
            imageValue = category?.image || '';
            renderImagePreview();
        }

        document.getElementById('addMainCategoryBtn').addEventListener('click', function () {
            A.editingCategoryId = null;
            document.getElementById('catFormTitle').innerHTML = '<i class="fas fa-plus"></i> إضافة فئة رئيسية';
            setFormData(null, 'main');
            formPanel.style.display = 'block';
            formPanel.scrollIntoView({ behavior: 'smooth' });
        });

        document.getElementById('addSubCategoryBtn').addEventListener('click', function () {
            if (mainCategories().length === 0) {
                A.showToast('أضف فئة رئيسية أولاً.');
                return;
            }
            A.editingCategoryId = null;
            document.getElementById('catFormTitle').innerHTML = '<i class="fas fa-folder-plus"></i> إضافة فئة فرعية';
            setFormData(null, 'sub');
            parentInput.value = mainCategories()[0]?.id || '';
            formPanel.style.display = 'block';
            formPanel.scrollIntoView({ behavior: 'smooth' });
        });

        document.getElementById('openProductsSectionBtn').addEventListener('click', function () {
            if (subCategories().length === 0) {
                A.showToast('أضف فئة فرعية واحدة على الأقل قبل إضافة المنتجات.');
                return;
            }
            switchAdminSection('products');
        });

        document.getElementById('jumpToProductsBtn').addEventListener('click', function () {
            if (subCategories().length === 0) {
                A.showToast('أضف فئة فرعية أولاً ثم انتقل إلى المنتجات.');
                return;
            }
            switchAdminSection('products');
        });

        document.getElementById('jumpMainCategoriesBtn')?.addEventListener('click', function () {
            switchAdminSection('main-categories');
        });

        document.getElementById('jumpSubCategoriesBtn')?.addEventListener('click', function () {
            switchAdminSection('subcategories');
        });

        document.getElementById('jumpCategoryHubBtn')?.addEventListener('click', function () {
            switchAdminSection('categories');
        });

        document.getElementById('cancelCatBtn').addEventListener('click', function () {
            formPanel.style.display = 'none';
        });

        typeInput.addEventListener('change', applyTypeVisibility);

        nameInput.addEventListener('input', function () {
            if (!slugInput.dataset.edited) {
                slugInput.value = slugifyArabic(nameInput.value);
            }
        });

        slugInput.addEventListener('input', function () {
            slugInput.dataset.edited = '1';
            slugInput.value = slugifyArabic(slugInput.value);
        });

        document.querySelectorAll('.edit-cat-btn').forEach((button) => {
            button.addEventListener('click', function () {
                const category = TZ.db.categories.find((item) => item.id === this.dataset.id);
                if (!category) return;
                A.editingCategoryId = category.id;
                document.getElementById('catFormTitle').innerHTML = '<i class="fas fa-edit"></i> تعديل الفئة';
                setFormData(category);
                slugInput.dataset.edited = '1';
                formPanel.style.display = 'block';
                formPanel.scrollIntoView({ behavior: 'smooth' });
            });
        });

        document.querySelectorAll('.toggle-cat-btn').forEach((button) => {
            button.addEventListener('click', function () {
                const category = TZ.db.categories.find((item) => item.id === this.dataset.id);
                if (!category) return;
                category.status = category.status === 'active' ? 'hidden' : 'active';
                TZ.commitDb('category_toggle', TZ.getSession()?.userId, `${category.name}: ${category.status}`, { type: 'category', data: category });
                A.renderSection(A.currentSection);
                A.showToast('تم تحديث حالة الفئة.');
            });
        });

        document.querySelectorAll('.toggle-nav-btn').forEach((button) => {
            button.addEventListener('click', function () {
                const category = TZ.db.categories.find((item) => item.id === this.dataset.id);
                if (!category || category.parentId) return;
                const next = !shouldShowInTopNav(category);
                const navMap = getTopNavVisibilityMap();
                navMap[category.id] = next;
                category.showInNavbar = next;
                TZ.commitDb('settings_update', TZ.getSession()?.userId, `تحديث ظهور الفئة في الشريط: ${category.name}`, { type: 'settings_update', data: TZ.db.settings });
                A.renderSection(A.currentSection);
                A.showToast('تم تحديث ظهور الفئة في الشريط العلوي.');
            });
        });

        document.querySelectorAll('.delete-cat-btn').forEach((button) => {
            button.addEventListener('click', function () {
                const category = TZ.db.categories.find((item) => item.id === this.dataset.id);
                if (!category) return;

                const categoryIdsToDelete = new Set([category.id]);
                let changed = true;
                while (changed) {
                    changed = false;
                    TZ.db.categories.forEach((item) => {
                        if (item.parentId && categoryIdsToDelete.has(item.parentId) && !categoryIdsToDelete.has(item.id)) {
                            categoryIdsToDelete.add(item.id);
                            changed = true;
                        }
                    });
                }

                const categoriesToDelete = TZ.db.categories.filter((item) => categoryIdsToDelete.has(item.id));
                const productsToDelete = TZ.db.products.filter((product) => categoryIdsToDelete.has(product.categoryId));
                const servicesToDelete = (TZ.db.services || []).filter((service) => categoryIdsToDelete.has(service.subcategoryId || service.categoryId));
                const summary = `سيتم حذف ${categoriesToDelete.length} فئة، ${productsToDelete.length} منتج، ${servicesToDelete.length} خدمة.`;

                A.showConfirmModal('حذف الفئة وما بداخلها', `${summary} هل تريد المتابعة؟`, () => {
                    TZ.db.categories = TZ.db.categories.filter((item) => !categoryIdsToDelete.has(item.id));
                    TZ.db.products = TZ.db.products.filter((product) => !categoryIdsToDelete.has(product.categoryId));
                    TZ.db.services = (TZ.db.services || []).filter((service) => !categoryIdsToDelete.has(service.subcategoryId || service.categoryId));

                    A.renderSection(A.currentSection);
                    A.showToast('تم حذف الفئة وكل العناصر المرتبطة بها.');

                    categoriesToDelete.forEach((item) => {
                        TZ.commitDb('category_delete', TZ.getSession()?.userId, item.name, { type: 'category_delete', data: { id: item.id } });
                    });
                    productsToDelete.forEach((item) => {
                        TZ.commitDb('product_delete', TZ.getSession()?.userId, item.name, { type: 'product_delete', data: { id: item.id } });
                    });
                    servicesToDelete.forEach((item) => {
                        TZ.commitDb('service_delete', TZ.getSession()?.userId, item.name, { type: 'service_delete', data: { id: item.id } });
                    });
                });
            });
        });

        const imageUpload = document.getElementById('catImageUploadArea');
        const imageInput = document.getElementById('catImageInput');
        imageUpload.addEventListener('click', () => imageInput.click());
        imageInput.addEventListener('change', function () {
            const file = this.files[0];
            if (!file) return;
            if (file.size > 1048576) {
                A.showToast('حجم الصورة يتجاوز 1MB.');
                return;
            }
            const reader = new FileReader();
            reader.onload = function (event) {
                imageValue = event.target.result;
                renderImagePreview();
            };
            reader.readAsDataURL(file);
        });

        form.addEventListener('submit', function (event) {
            event.preventDefault();

            const type = typeInput.value;
            const parentId = type === 'sub' ? parentInput.value : null;
            const name = nameInput.value.trim();
            const status = statusInput.value;
            const showInNavbar = type === 'main' ? !!showInNavbarInput.checked : false;
            const sortOrder = Number(sortInput.value || 0);
            const icon = iconInput.value.trim() || 'fa-folder';
            const description = descInput.value.trim();

            if (!name) {
                A.showToast('يرجى إدخال اسم الفئة.');
                return;
            }

            if (type === 'sub' && !parentId) {
                A.showToast('اختر الفئة الرئيسية أولاً.');
                return;
            }

            let slug = slugifyArabic(slugInput.value || name);
            slug = upsertUniqueSlug(slug, A.editingCategoryId);

            if (A.editingCategoryId) {
                const category = TZ.db.categories.find((item) => item.id === A.editingCategoryId);
                if (!category) return;

                if (type === 'sub' && parentId === category.id) {
                    A.showToast('لا يمكن ربط الفئة بنفسها.');
                    return;
                }

                Object.assign(category, {
                    name,
                    parentId,
                    status,
                    showInNavbar,
                    sortOrder,
                    icon,
                    description,
                    image: imageValue || '',
                    slug
                });

                if (!parentId) {
                    getTopNavVisibilityMap()[category.id] = showInNavbar;
                    TZ.commitDb('settings_update', TZ.getSession()?.userId, `تحديث ظهور الفئة في الشريط: ${name}`, { type: 'settings_update', data: TZ.db.settings });
                }

                TZ.commitDb('category_update', TZ.getSession()?.userId, name, { type: 'category', data: category });
                A.showToast('تم تحديث الفئة.');
            } else {
                const newCategory = {
                    id: TZ.generateId('cat-'),
                    name,
                    parentId,
                    status,
                    showInNavbar,
                    sortOrder,
                    icon,
                    description,
                    image: imageValue || '',
                    slug
                };

                TZ.db.categories.push(newCategory);

                if (!parentId) {
                    getTopNavVisibilityMap()[newCategory.id] = showInNavbar;
                    TZ.commitDb('settings_update', TZ.getSession()?.userId, `تحديث ظهور الفئة في الشريط: ${name}`, { type: 'settings_update', data: TZ.db.settings });
                }

                TZ.commitDb('category_create', TZ.getSession()?.userId, name, { type: 'category', data: newCategory });
                A.showToast('تمت إضافة الفئة.');
            }

            A.renderSection(A.currentSection);
        });
    }

    A.sections.categories = () => renderCategories('all');
    A.sections['main-categories'] = () => renderCategories('main');
    A.sections.subcategories = () => renderCategories('sub');
})();
