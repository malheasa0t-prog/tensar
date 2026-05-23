/**
 * TechZone Admin - Services section.
 *
 * Manages repair and maintenance services via Supabase.
 */
(function () {
    'use strict';

    var A = window.AdminApp;
    if (!A) return;

    var SERVICE_IMAGE_BUCKET = 'repair-service-images';
    var ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    var MAX_IMAGE_SIZE_BYTES = 3 * 1024 * 1024;
    var pendingServiceImageFile = null;

    /**
     * Escapes unsafe HTML fragments before injecting them into the DOM.
     *
     * @param {unknown} value - Raw value.
     * @returns {string} Safe HTML value.
     */
    function esc(value) {
        return TZ.escapeHtml(value == null ? '' : String(value));
    }

    /**
     * Normalizes a service image path so blank values are not persisted.
     *
     * @param {unknown} value - Image URL/path.
     * @returns {string|null} Normalized image value.
     */
    function normalizeServiceImage(value) {
        var normalizedValue = String(value || '').trim();
        return normalizedValue || null;
    }

    /**
     * Returns known category rows for service category suggestions.
     *
     * @returns {Array<Record<string, unknown>>} Category rows.
     */
    function getServiceCategoryRows() {
        if (typeof TZ === 'undefined' || !TZ.db) return [];
        return Array.isArray(TZ.db.categories) ? TZ.db.categories : [];
    }

    /**
     * Builds category option markup for service category datalist.
     *
     * @param {string} selectedCategory - Current service category.
     * @returns {string} Datalist options markup.
     */
    function buildServiceCategoryOptionsMarkup(selectedCategory) {
        var selectedValue = String(selectedCategory || '').trim();
        var seen = {};
        var options = '';

        getServiceCategoryRows().forEach(function (category) {
            var name = String(category.name || '').trim();
            if (!name || seen[name]) return;

            seen[name] = true;
            options += '<option value="' + esc(name) + '"></option>';
        });

        if (selectedValue && !seen[selectedValue]) {
            options += '<option value="' + esc(selectedValue) + '"></option>';
        }

        return options;
    }

    /**
     * Builds the database payload for a repair service row.
     *
     * @param {object} data - Form data.
     * @returns {object} Supabase payload.
     */
    function buildServicePayload(data) {
        var input = data || {};
        return {
            name: input.name,
            category: input.category || null,
            price: Number(input.price) || 0,
            duration: input.duration || null,
            description: input.description || null,
            image: normalizeServiceImage(input.image),
            status: input.status || 'active',
            updated_at: new Date().toISOString()
        };
    }

    /**
     * Ensures the public storage bucket exists before uploading.
     *
     * @returns {Promise<void>}
     */
    async function ensureServiceImageBucket() {
        var bucketRes = await TZ.supabase.storage.getBucket(SERVICE_IMAGE_BUCKET);
        if (bucketRes.data) return;

        var message = String(bucketRes.error?.message || '').toLowerCase();
        if (bucketRes.error && !message.includes('not found')) return;

        await TZ.supabase.storage.createBucket(SERVICE_IMAGE_BUCKET, {
            public: true,
            fileSizeLimit: MAX_IMAGE_SIZE_BYTES,
            allowedMimeTypes: ALLOWED_IMAGE_TYPES
        });
    }

    /**
     * Uploads a selected repair service image to Supabase Storage.
     *
     * @param {File|null} file - Selected image file.
     * @returns {Promise<string|null>} Public image URL.
     */
    async function uploadServiceImage(file) {
        if (!file) return null;

        var normalizedType = String(file.type || '').trim().toLowerCase();
        if (!ALLOWED_IMAGE_TYPES.includes(normalizedType)) {
            A.showErrorToast('SVC-110', 'نوع ملف الصورة غير مدعوم. استخدم JPEG أو PNG أو WebP.');
            return null;
        }

        if (Number(file.size || 0) > MAX_IMAGE_SIZE_BYTES) {
            A.showErrorToast('SVC-111', 'حجم الصورة يتجاوز 3MB.');
            return null;
        }

        try {
            await ensureServiceImageBucket();
            var extension = String(file.name || 'service.jpg').split('.').pop() || 'jpg';
            var objectPath = 'services/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + extension;
            var uploadRes = await TZ.supabase.storage.from(SERVICE_IMAGE_BUCKET).upload(objectPath, file, {
                contentType: file.type || 'application/octet-stream',
                upsert: false
            });

            if (uploadRes.error) {
                A.showErrorToast('SVC-312', 'فشل رفع صورة الخدمة: ' + (uploadRes.error.message || ''));
                return null;
            }

            var urlRes = TZ.supabase.storage.from(SERVICE_IMAGE_BUCKET).getPublicUrl(objectPath);
            return urlRes.data?.publicUrl || null;
        } catch (error) {
            A.showErrorToast('SVC-313', 'حدث خطأ أثناء رفع صورة الخدمة.');
            return null;
        }
    }

    /**
     * Creates the slide-over HTML for the service form.
     *
     * @param {object} service - Current service row.
     * @param {boolean} isEdit - Whether the form edits an existing service.
     * @returns {string} Form markup.
     */
    function buildServiceFormMarkup(service, isEdit) {
        var currentService = service || {};
        var existingImage = currentService.image || '';

        return '<div class="admin-slideover-head"><h3><i class="fas '
            + (isEdit ? 'fa-edit' : 'fa-plus')
            + '"></i> '
            + (isEdit ? 'تعديل الخدمة' : 'إضافة خدمة')
            + '</h3><button class="btn btn-ghost btn-sm close-svc"><i class="fas fa-times"></i></button></div>'
            + '<div class="admin-slideover-body"><form class="admin-form"><div class="form-grid">'
            + '<div class="admin-form-group full"><label>اسم الخدمة *</label><div class="admin-input-wrap"><i class="fas fa-wrench"></i><input type="text" id="svcName" value="' + esc(currentService.name || '') + '" required></div></div>'
            + '<div class="admin-form-group"><label>الفئة أو الفئة الفرعية</label><div class="admin-input-wrap"><i class="fas fa-tag"></i><input type="text" id="svcCategory" list="svcCategoryOptions" value="' + esc(currentService.category || '') + '" placeholder="اختر أو اكتب اسم الفئة"></div><datalist id="svcCategoryOptions">' + buildServiceCategoryOptionsMarkup(currentService.category || '') + '</datalist></div>'
            + '<div class="admin-form-group"><label>السعر *</label><div class="admin-input-wrap"><i class="fas fa-money-bill"></i><input type="number" id="svcPrice" value="' + esc(currentService.price || '') + '" min="0" step="0.01" required></div></div>'
            + '<div class="admin-form-group"><label>المدة المتوقعة</label><div class="admin-input-wrap"><i class="fas fa-clock"></i><input type="text" id="svcDuration" value="' + esc(currentService.duration || '') + '" placeholder="مثال: 2-3 أيام"></div></div>'
            + '<div class="admin-form-group full"><label>صورة الخدمة</label><div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">'
            + '<div id="svcImagePreview" style="width:82px;height:82px;border-radius:10px;border:2px dashed rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;overflow:hidden;background:rgba(0,0,0,0.15);flex-shrink:0;">'
            + (existingImage ? '<img src="' + esc(existingImage) + '" style="width:100%;height:100%;object-fit:cover;border-radius:8px;" alt="صورة الخدمة">' : '<i class="fas fa-image" style="font-size:1.4rem;opacity:0.3;"></i>')
            + '</div><div style="flex:1;min-width:220px;display:grid;gap:8px;">'
            + '<input type="file" id="svcImageFile" accept="image/jpeg,image/png,image/webp">'
            + '<div class="admin-input-wrap"><i class="fas fa-link"></i><input type="text" id="svcImage" value="' + esc(existingImage) + '" placeholder="أو ضع رابط صورة خارجي"></div>'
            + '<small style="color:var(--text-muted);">اختر صورة جديدة أو اترك الرابط الحالي كما هو. الحد الأقصى 3MB.</small>'
            + '</div></div></div>'
            + '<div class="admin-form-group"><label>الحالة</label><select id="svcStatus"><option value="active"'
            + (currentService.status === 'active' || !currentService.status ? ' selected' : '')
            + '>نشطة</option><option value="inactive"'
            + (currentService.status === 'inactive' ? ' selected' : '')
            + '>معطلة</option></select></div>'
            + '<div class="admin-form-group full"><label>الوصف</label><textarea id="svcDesc" rows="3">' + esc(currentService.description || '') + '</textarea></div>'
            + '</div></form></div>'
            + '<div class="admin-slideover-footer"><button class="btn btn-primary" id="saveSvcBtn"><i class="fas fa-save"></i> '
            + (isEdit ? 'تحديث' : 'إضافة')
            + '</button><button class="btn btn-outline close-svc">إلغاء</button></div>';
    }

    /**
     * Saves a service row to Supabase.
     *
     * @param {object} data - Form data.
     * @param {boolean} isEdit - Whether this is an update.
     * @returns {Promise<boolean>} True when saved.
     */
    async function saveService(data, isEdit) {
        var uploadedImageUrl = await uploadServiceImage(pendingServiceImageFile);
        var hadPendingImage = Boolean(pendingServiceImageFile);
        pendingServiceImageFile = null;

        if (hadPendingImage && !uploadedImageUrl) {
            return false;
        }

        var payload = buildServicePayload({
            ...data,
            image: uploadedImageUrl || data.image
        });
        var result;

        if (isEdit) {
            result = await TZ.supabase.from('repair_services').update(payload).eq('id', data.id);
        } else {
            result = await TZ.supabase.from('repair_services').insert([payload]);
        }

        if (result.error) {
            A.showErrorToast('SVC-301', 'فشل حفظ الخدمة');
            return false;
        }

        A.showToast(isEdit ? 'تم تحديث الخدمة' : 'تم إضافة الخدمة');
        return true;
    }

    /**
     * Deletes a service row from Supabase.
     *
     * @param {string} id - Service id.
     * @returns {Promise<void>}
     */
    async function deleteService(id) {
        if (!confirm('هل أنت متأكد من حذف هذه الخدمة؟')) return;

        var result = await TZ.supabase.from('repair_services').delete().eq('id', id);
        if (result.error) {
            A.showErrorToast('SVC-302', 'فشل حذف الخدمة');
            return;
        }

        A.showToast('تم حذف الخدمة');
        await TZ.refreshData();
        renderServices();
    }

    /**
     * Wires the image input preview for a service form.
     *
     * @param {HTMLElement} panel - Slide-over panel.
     * @returns {void}
     */
    function bindServiceImagePreview(panel) {
        var fileInput = panel.querySelector('#svcImageFile');
        var preview = panel.querySelector('#svcImagePreview');

        if (!fileInput || !preview) return;

        fileInput.addEventListener('change', function () {
            var file = this.files && this.files[0];
            if (!file) {
                pendingServiceImageFile = null;
                return;
            }

            if (!ALLOWED_IMAGE_TYPES.includes(String(file.type || '').toLowerCase())) {
                A.showErrorToast('SVC-110', 'نوع ملف الصورة غير مدعوم.');
                this.value = '';
                pendingServiceImageFile = null;
                return;
            }

            if (Number(file.size || 0) > MAX_IMAGE_SIZE_BYTES) {
                A.showErrorToast('SVC-111', 'حجم الصورة يتجاوز 3MB.');
                this.value = '';
                pendingServiceImageFile = null;
                return;
            }

            pendingServiceImageFile = file;
            var reader = new FileReader();
            reader.onload = function (event) {
                preview.innerHTML = '<img src="' + event.target.result + '" style="width:100%;height:100%;object-fit:cover;border-radius:8px;" alt="معاينة الصورة">';
            };
            reader.readAsDataURL(file);
        });
    }

    /**
     * Opens the service create/edit form.
     *
     * @param {object|null} service - Service row or null.
     * @returns {void}
     */
    function openServiceForm(service) {
        var currentService = service || {};
        var isEdit = Boolean(currentService.id);
        var backdrop = document.createElement('div');
        var panel = document.createElement('div');
        pendingServiceImageFile = null;

        backdrop.className = 'admin-slideover-backdrop';
        panel.className = 'admin-slideover';
        panel.innerHTML = buildServiceFormMarkup(currentService, isEdit);

        document.body.appendChild(backdrop);
        document.body.appendChild(panel);
        bindServiceImagePreview(panel);

        function close() {
            pendingServiceImageFile = null;
            backdrop.remove();
            panel.remove();
        }

        backdrop.addEventListener('click', close);
        panel.querySelectorAll('.close-svc').forEach(function (button) {
            button.addEventListener('click', close);
        });

        panel.querySelector('#saveSvcBtn').addEventListener('click', async function () {
            var saveButton = this;
            var name = panel.querySelector('#svcName').value.trim();

            if (!name) {
                A.showErrorToast('SVC-101', 'أدخل اسم الخدمة');
                return;
            }

            saveButton.disabled = true;
            saveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جار الحفظ...';

            var ok = await saveService({
                id: isEdit ? currentService.id : null,
                name: name,
                category: panel.querySelector('#svcCategory').value.trim(),
                price: panel.querySelector('#svcPrice').value,
                duration: panel.querySelector('#svcDuration').value.trim(),
                image: panel.querySelector('#svcImage').value.trim(),
                status: panel.querySelector('#svcStatus').value,
                description: panel.querySelector('#svcDesc').value.trim()
            }, isEdit);

            if (!ok) {
                saveButton.disabled = false;
                saveButton.innerHTML = '<i class="fas fa-save"></i> ' + (isEdit ? 'تحديث' : 'إضافة');
                return;
            }

            close();
            await TZ.refreshData();
            renderServices();
        });
    }

    /**
     * Builds a thumbnail cell for the services table.
     *
     * @param {string|null} image - Service image URL.
     * @returns {string} Thumbnail HTML.
     */
    function buildServiceThumbMarkup(image) {
        var normalizedImage = normalizeServiceImage(image);
        if (!normalizedImage) {
            return '<span style="width:44px;height:44px;border-radius:8px;display:grid;place-items:center;background:rgba(255,255,255,0.06);color:var(--text-muted);"><i class="fas fa-image"></i></span>';
        }

        return '<img src="' + esc(normalizedImage) + '" alt="" loading="lazy" style="width:44px;height:44px;border-radius:8px;object-fit:cover;border:1px solid rgba(255,255,255,0.08);">';
    }

    /**
     * Renders the services table inside the admin content area.
     *
     * @returns {void}
     */
    function renderServices() {
        var services = TZ.db.repairServices || [];
        var html = '<div class="admin-section-header"><div><h2><i class="fas fa-screwdriver-wrench"></i> خدمات الصيانة</h2><p>'
            + services.length
            + ' خدمة</p></div><div class="admin-section-actions"><button class="btn btn-primary btn-sm" id="addSvcBtn"><i class="fas fa-plus"></i> إضافة خدمة</button></div></div>';

        html += '<div class="admin-panel"><div class="panel-body"><div class="table-wrap"><table class="data-table"><thead><tr>'
            + '<th>الصورة</th><th>الخدمة</th><th>الفئة</th><th>السعر</th><th>المدة</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody>';

        if (services.length === 0) {
            html += '<tr><td colspan="7"><div class="empty-state"><i class="fas fa-screwdriver-wrench"></i><p>لا توجد خدمات</p></div></td></tr>';
        } else {
            services.forEach(function (service) {
                html += '<tr>'
                    + '<td>' + buildServiceThumbMarkup(service.image) + '</td>'
                    + '<td><strong>' + esc(service.name) + '</strong></td>'
                    + '<td>' + esc(service.category || '-') + '</td>'
                    + '<td style="font-weight:600;">' + TZ.formatPrice(service.price) + '</td>'
                    + '<td>' + esc(service.duration || '-') + '</td>'
                    + '<td><span class="status-badge ' + service.status + '">' + (service.status === 'active' ? 'نشطة' : 'معطلة') + '</span></td>'
                    + '<td class="actions-cell">'
                    + '<button class="action-btn edit-svc-btn" data-id="' + service.id + '"><i class="fas fa-edit"></i></button>'
                    + '<button class="action-btn danger del-svc-btn" data-id="' + service.id + '"><i class="fas fa-trash"></i></button>'
                    + '</td></tr>';
            });
        }

        html += '</tbody></table></div></div></div>';
        A.adminContent.innerHTML = html;

        document.getElementById('addSvcBtn')?.addEventListener('click', function () {
            openServiceForm(null);
        });

        document.querySelectorAll('.edit-svc-btn').forEach(function (button) {
            button.addEventListener('click', function () {
                var service = services.find(function (item) {
                    return item.id === button.dataset.id;
                });

                if (service) {
                    openServiceForm(service);
                }
            });
        });

        document.querySelectorAll('.del-svc-btn').forEach(function (button) {
            button.addEventListener('click', function () {
                deleteService(button.dataset.id);
            });
        });
    }

    A.sections.services = renderServices;
    A.sections['repair-services'] = renderServices;

    if (window.__ENABLE_SERVICE_ADMIN_TEST_HOOKS__) {
        window.__serviceAdminTestHooks = {
            buildServiceCategoryOptionsMarkup: buildServiceCategoryOptionsMarkup,
            buildServicePayload: buildServicePayload,
            normalizeServiceImage: normalizeServiceImage
        };
    }
})();
