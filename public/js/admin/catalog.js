/**
 * TechZone Admin - Digital catalog section.
 *
 * Manages rows stored in the shared `services` table.
 */
(function () {
    'use strict';

    var A = window.AdminApp;
    var H = window.CatalogAdminHelpers;
    if (!A || !H) return;

    var CATALOG_IMAGE_BUCKET = 'catalog-service-images';
    var ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    var MAX_IMAGE_SIZE_BYTES = 3 * 1024 * 1024;
    var pendingImageFile = null;
    var filters = { categoryId: '', query: '', status: '', subcategoryId: '' };

    function esc(value) { return TZ.escapeHtml(value == null ? '' : String(value)); }
    function getCategories() { return Array.isArray(TZ.db.categories) ? TZ.db.categories : []; }
    function getCatalogServices() { return Array.isArray(TZ.db.catalogServices) ? TZ.db.catalogServices : []; }

    function getCategoryName(categoryId) {
        var category = getCategories().find(function (item) { return item.id === categoryId; });
        return category ? category.name : '—';
    }

    function buildPreviewMarkup(image) {
        var normalizedImage = H.normalizeCatalogImage(image);
        return normalizedImage
            ? '<img src="' + esc(normalizedImage) + '" alt="صورة الخدمة" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">'
            : '<i class="fas fa-image" style="font-size:1.4rem;opacity:0.3;"></i>';
    }

    async function ensureCatalogBucket() {
        var bucketResult = await TZ.supabase.storage.getBucket(CATALOG_IMAGE_BUCKET);
        if (bucketResult.data) return;
        if (bucketResult.error && !String(bucketResult.error.message || '').toLowerCase().includes('not found')) return;
        await TZ.supabase.storage.createBucket(CATALOG_IMAGE_BUCKET, {
            public: true,
            fileSizeLimit: MAX_IMAGE_SIZE_BYTES,
            allowedMimeTypes: ALLOWED_IMAGE_TYPES
        });
    }

    async function uploadCatalogImage(file) {
        if (!file) return null;
        if (!ALLOWED_IMAGE_TYPES.includes(String(file.type || '').toLowerCase())) {
            A.showErrorToast('CLG-110', 'نوع ملف الصورة غير مدعوم.');
            return null;
        }
        if (Number(file.size || 0) > MAX_IMAGE_SIZE_BYTES) {
            A.showErrorToast('CLG-111', 'حجم الصورة يتجاوز 3MB.');
            return null;
        }

        try {
            await ensureCatalogBucket();
            var ext = String(file.name || 'catalog.jpg').split('.').pop() || 'jpg';
            var path = 'services/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
            var uploadResult = await TZ.supabase.storage.from(CATALOG_IMAGE_BUCKET).upload(path, file, {
                contentType: file.type || 'application/octet-stream',
                upsert: false
            });
            if (uploadResult.error) {
                A.showErrorToast('CLG-312', 'فشل رفع صورة الخدمة: ' + String(uploadResult.error.message || ''));
                return null;
            }
            return TZ.supabase.storage.from(CATALOG_IMAGE_BUCKET).getPublicUrl(path).data?.publicUrl || null;
        } catch (error) {
            A.showErrorToast('CLG-313', 'حدث خطأ أثناء رفع صورة الخدمة.');
            return null;
        }
    }

    function buildFormMarkup(service) {
        var currentService = service || {};
        return '<div class="admin-slideover-head"><h3><i class="fas ' + (currentService.id ? 'fa-edit' : 'fa-plus') + '"></i> ' + (currentService.id ? 'تعديل الخدمة' : 'إضافة خدمة رقمية') + '</h3><button class="btn btn-ghost btn-sm close-catalog-form"><i class="fas fa-times"></i></button></div>'
            + '<div class="admin-slideover-body"><form class="admin-form"><div class="form-grid">'
            + '<div class="admin-form-group full"><label>اسم الخدمة *</label><div class="admin-input-wrap"><i class="fas fa-gift"></i><input type="text" id="catalogName" value="' + esc(currentService.name || '') + '" required></div></div>'
            + '<div class="admin-form-group"><label>الفئة الرئيسية *</label><select id="catalogCategory">' + H.buildMainCategoryOptions({ categories: getCategories(), selectedId: currentService.categoryId || currentService.category_id || '' }) + '</select></div>'
            + '<div class="admin-form-group"><label>الفئة الفرعية</label><select id="catalogSubcategory">' + H.buildSubcategoryOptions({ categories: getCategories(), parentId: currentService.categoryId || currentService.category_id || '', selectedId: currentService.subcategoryId || currentService.subcategory_id || '' }) + '</select></div>'
            + '<div class="admin-form-group"><label>السعر *</label><div class="admin-input-wrap"><i class="fas fa-wallet"></i><input type="number" id="catalogPrice" value="' + esc(currentService.price || '') + '" min="0" step="0.01" required></div></div>'
            + '<div class="admin-form-group"><label>سعر التكلفة</label><div class="admin-input-wrap"><i class="fas fa-money-bill-wave"></i><input type="number" id="catalogCostPrice" value="' + esc(currentService.costPrice || currentService.cost_price || '') + '" min="0" step="0.01"></div></div>'
            + '<div class="admin-form-group"><label>أقل كمية</label><input type="number" id="catalogMinQty" value="' + esc(currentService.minQty || currentService.min_qty || 1) + '" min="1"></div>'
            + '<div class="admin-form-group"><label>أعلى كمية</label><input type="number" id="catalogMaxQty" value="' + esc(currentService.maxQty || currentService.max_qty || 9999) + '" min="1"></div>'
            + '<div class="admin-form-group"><label>الحالة</label><select id="catalogStatus"><option value="active"' + ((currentService.status || 'active') === 'active' ? ' selected' : '') + '>نشطة</option><option value="draft"' + (currentService.status === 'draft' ? ' selected' : '') + '>مسودة</option></select></div>'
            + '<div class="admin-form-group"><label>الترتيب</label><input type="number" id="catalogSortOrder" value="' + esc(currentService.sortOrder || currentService.sort_order || 0) + '" min="0"></div>'
            + '<div class="admin-form-group"><label>Slug</label><div class="admin-input-wrap"><i class="fas fa-link"></i><input type="text" id="catalogSlug" value="' + esc(currentService.slug || '') + '" placeholder="يولد تلقائياً من الاسم"></div></div>'
            + '<div class="admin-form-group"><label>معرف المزود</label><div class="admin-input-wrap"><i class="fas fa-hashtag"></i><input type="text" id="catalogProviderId" value="' + esc(currentService.providerServiceId || currentService.provider_service_id || '') + '"></div></div>'
            + '<div class="admin-form-group full"><label>صورة الخدمة</label><div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;"><div id="catalogImagePreview" style="width:82px;height:82px;border-radius:10px;border:2px dashed rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;overflow:hidden;background:rgba(0,0,0,0.15);flex-shrink:0;">' + buildPreviewMarkup(currentService.image) + '</div><div style="flex:1;min-width:220px;display:grid;gap:8px;"><input type="file" id="catalogImageFile" accept="image/jpeg,image/png,image/webp"><div class="admin-input-wrap"><i class="fas fa-link"></i><input type="text" id="catalogImage" value="' + esc(currentService.image || '') + '" placeholder="أو ضع رابط صورة خارجي"></div></div></div></div>'
            + '<div class="admin-form-group full"><label>الوصف</label><textarea id="catalogDescription" rows="4">' + esc(currentService.description || '') + '</textarea></div>'
            + '</div></form></div><div class="admin-slideover-footer"><button class="btn btn-primary" id="saveCatalogBtn"><i class="fas fa-save"></i> ' + (currentService.id ? 'تحديث' : 'إضافة') + '</button><button class="btn btn-outline close-catalog-form">إلغاء</button></div>';
    }

    function bindImagePreview(panel) {
        var fileInput = panel.querySelector('#catalogImageFile');
        var preview = panel.querySelector('#catalogImagePreview');
        var urlInput = panel.querySelector('#catalogImage');
        if (!fileInput || !preview) return;

        fileInput.addEventListener('change', function () {
            var file = this.files && this.files[0];
            if (!file) {
                pendingImageFile = null;
                preview.innerHTML = buildPreviewMarkup(urlInput && urlInput.value);
                return;
            }
            pendingImageFile = file;
            var reader = new FileReader();
            reader.onload = function (event) { preview.innerHTML = '<img src="' + event.target.result + '" alt="معاينة الصورة" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">'; };
            reader.readAsDataURL(file);
        });

        urlInput?.addEventListener('input', function () {
            pendingImageFile = null;
            fileInput.value = '';
            preview.innerHTML = buildPreviewMarkup(this.value);
        });
    }

    async function saveCatalogService(input) {
        try {
            var imageUrl = pendingImageFile ? await uploadCatalogImage(pendingImageFile) : null;
            pendingImageFile = null;
            if (input.pendingImage && !imageUrl) return false;

            var payload = H.buildCatalogServicePayload({
                ...input,
                image: imageUrl || input.image
            });
            var query = input.id
                ? TZ.supabase.from('services').update(payload).eq('id', input.id)
                : TZ.supabase.from('services').insert([payload]);
            var result = await query;

            if (result.error) {
                A.showErrorToast('CLG-301', 'فشل حفظ الخدمة الرقمية: ' + String(result.error.message || ''));
                return false;
            }
            A.showToast(input.id ? 'تم تحديث الخدمة الرقمية' : 'تمت إضافة الخدمة الرقمية');
            return true;
        } catch (error) {
            A.showErrorToast('CLG-302', 'تعذر حفظ الخدمة الرقمية حالياً.');
            return false;
        }
    }

    async function deleteCatalogService(serviceId) {
        if (!confirm('هل أنت متأكد من حذف هذه الخدمة الرقمية؟')) return;
        var result = await TZ.supabase.from('services').delete().eq('id', serviceId);
        if (result.error) {
            A.showErrorToast('CLG-303', 'فشل حذف الخدمة الرقمية.');
            return;
        }
        A.showToast('تم حذف الخدمة الرقمية');
        await TZ.refreshData();
        renderCatalog();
    }

    function openCatalogForm(service) {
        var currentService = service || {};
        var backdrop = document.createElement('div');
        var panel = document.createElement('div');
        pendingImageFile = null;
        backdrop.className = 'admin-slideover-backdrop';
        panel.className = 'admin-slideover';
        panel.innerHTML = buildFormMarkup(currentService);
        document.body.appendChild(backdrop);
        document.body.appendChild(panel);
        bindImagePreview(panel);

        function close() { pendingImageFile = null; backdrop.remove(); panel.remove(); }
        backdrop.addEventListener('click', close);
        panel.querySelectorAll('.close-catalog-form').forEach(function (button) { button.addEventListener('click', close); });
        panel.querySelector('#catalogCategory')?.addEventListener('change', function () {
            panel.querySelector('#catalogSubcategory').innerHTML = H.buildSubcategoryOptions({ categories: getCategories(), parentId: this.value, selectedId: '' });
        });
        panel.querySelector('#saveCatalogBtn').addEventListener('click', async function () {
            var saveButton = this;
            var name = panel.querySelector('#catalogName').value.trim();
            var categoryId = panel.querySelector('#catalogCategory').value;
            var price = panel.querySelector('#catalogPrice').value;
            if (!name || !categoryId || !String(price || '').trim()) {
                A.showErrorToast('CLG-101', 'أكمل الاسم والفئة الرئيسية والسعر.');
                return;
            }
            saveButton.disabled = true;
            saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';

            var ok = await saveCatalogService({
                id: currentService.id || null,
                name: name,
                categoryId: categoryId,
                subcategoryId: panel.querySelector('#catalogSubcategory').value || null,
                price: price,
                costPrice: panel.querySelector('#catalogCostPrice').value,
                minQty: panel.querySelector('#catalogMinQty').value,
                maxQty: panel.querySelector('#catalogMaxQty').value,
                status: panel.querySelector('#catalogStatus').value,
                sortOrder: panel.querySelector('#catalogSortOrder').value,
                slug: panel.querySelector('#catalogSlug').value.trim(),
                providerServiceId: panel.querySelector('#catalogProviderId').value.trim(),
                image: panel.querySelector('#catalogImage').value.trim(),
                description: panel.querySelector('#catalogDescription').value.trim(),
                pendingImage: Boolean(pendingImageFile)
            });
            if (!ok) {
                saveButton.disabled = false;
                saveButton.innerHTML = '<i class="fas fa-save"></i> ' + (currentService.id ? 'تحديث' : 'إضافة');
                return;
            }
            close();
            await TZ.refreshData();
            renderCatalog();
        });
    }

    function buildTableRows(services) {
        if (services.length === 0) {
            return '<tr><td colspan="8"><div class="empty-state"><i class="fas fa-gift"></i><p>لا توجد خدمات رقمية مطابقة</p></div></td></tr>';
        }

        return services.map(function (service) {
            return '<tr><td><div style="width:44px;height:44px;border-radius:8px;overflow:hidden;display:grid;place-items:center;background:rgba(255,255,255,0.05);">' + buildPreviewMarkup(service.image) + '</div></td><td><strong>' + esc(service.name) + '</strong><br><small style="color:var(--text-muted);">' + esc(service.id) + '</small></td><td>' + esc(getCategoryName(service.categoryId || service.category_id)) + '</td><td>' + esc(getCategoryName(service.subcategoryId || service.subcategory_id)) + '</td><td style="font-weight:600;">' + TZ.formatPrice(service.price) + '</td><td>' + esc((service.minQty || 1) + ' - ' + (service.maxQty || 9999)) + '</td><td><span class="status-badge ' + esc(service.status || '') + '">' + esc(service.status === 'active' ? 'نشطة' : 'مسودة') + '</span></td><td class="actions-cell"><button class="action-btn edit-catalog-btn" data-id="' + esc(service.id) + '"><i class="fas fa-edit"></i></button><button class="action-btn danger del-catalog-btn" data-id="' + esc(service.id) + '"><i class="fas fa-trash"></i></button></td></tr>';
        }).join('');
    }

    function bindFilters() {
        A.adminContent.querySelector('#catalogSearch')?.addEventListener('input', function () { filters.query = this.value; renderCatalog(); });
        A.adminContent.querySelector('#catalogCategoryFilter')?.addEventListener('change', function () {
            filters.categoryId = this.value;
            filters.subcategoryId = '';
            A.adminContent.querySelector('#catalogSubcategoryFilter').innerHTML = H.buildSubcategoryOptions({ categories: getCategories(), parentId: this.value, selectedId: '' });
            renderCatalog();
        });
        A.adminContent.querySelector('#catalogSubcategoryFilter')?.addEventListener('change', function () { filters.subcategoryId = this.value; renderCatalog(); });
        A.adminContent.querySelector('#catalogStatusFilter')?.addEventListener('change', function () { filters.status = this.value; renderCatalog(); });
        A.adminContent.querySelector('#addCatalogBtn')?.addEventListener('click', function () { openCatalogForm(null); });
        A.adminContent.querySelector('#openServaCatalogFromCatalogBtn')?.addEventListener('click', function () { A.renderSection('serva-catalog', { history: 'push' }); });
        A.adminContent.querySelectorAll('.edit-catalog-btn').forEach(function (button) {
            button.addEventListener('click', function () {
                var service = getCatalogServices().find(function (item) { return item.id === button.dataset.id; });
                if (service) openCatalogForm(service);
            });
        });
        A.adminContent.querySelectorAll('.del-catalog-btn').forEach(function (button) {
            button.addEventListener('click', function () { deleteCatalogService(button.dataset.id); });
        });
    }

    function renderCatalog() {
        var visibleServices = H.filterCatalogServices({ ...filters, services: getCatalogServices() });
        var categoryFilterOptions = H.buildMainCategoryOptions({ categories: getCategories(), selectedId: filters.categoryId })
            .replace('>اختر الفئة الرئيسية<', '>كل الفئات الرئيسية<');
        A.adminContent.innerHTML = '<div class="admin-section-header"><div><h2><i class="fas fa-gift"></i> البطاقات والكتالوج</h2><p>' + getCatalogServices().length + ' خدمة رقمية داخل جدول services</p></div><div class="admin-section-actions"><button class="btn btn-outline btn-sm" id="openServaCatalogFromCatalogBtn"><i class="fas fa-cloud-download-alt"></i> استيراد من Serva-S</button><button class="btn btn-primary btn-sm" id="addCatalogBtn"><i class="fas fa-plus"></i> إضافة خدمة</button></div></div>'
            + '<div class="filter-bar"><input type="search" id="catalogSearch" placeholder="ابحث بالاسم أو المعرف..." value="' + esc(filters.query) + '"><select id="catalogCategoryFilter">' + categoryFilterOptions + '</select><select id="catalogSubcategoryFilter">' + H.buildSubcategoryOptions({ categories: getCategories(), parentId: filters.categoryId, selectedId: filters.subcategoryId }).replace('>بدون فئة فرعية<', '>كل الفئات الفرعية<') + '</select><select id="catalogStatusFilter"><option value="">كل الحالات</option><option value="active"' + (filters.status === 'active' ? ' selected' : '') + '>نشطة</option><option value="draft"' + (filters.status === 'draft' ? ' selected' : '') + '>مسودة</option></select></div>'
            + '<div class="admin-panel"><div class="panel-body"><div class="table-wrap"><table class="data-table"><thead><tr><th>الصورة</th><th>الخدمة</th><th>الرئيسية</th><th>الفرعية</th><th>السعر</th><th>الحدود</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody>' + buildTableRows(visibleServices) + '</tbody></table></div></div></div>';
        bindFilters();
    }

    A.sections.catalog = renderCatalog;
})();
