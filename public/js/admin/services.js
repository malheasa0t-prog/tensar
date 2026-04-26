/**
 * TechZone Admin - Services section.
 *
 * Manages repair and maintenance services via Supabase.
 */
(function () {
    'use strict';

    var A = window.AdminApp;
    if (!A) return;

    /**
     * Escapes unsafe HTML fragments before injecting them into the DOM.
     *
     * @param {unknown} value
     * @returns {string}
     */
    function esc(value) {
        return TZ.escapeHtml(value == null ? '' : String(value));
    }

    /**
     * Normalizes a service image path so blank values are not persisted.
     *
     * @param {unknown} value
     * @returns {string|null}
     */
    function normalizeServiceImage(value) {
        var normalizedValue = String(value || '').trim();
        return normalizedValue || null;
    }

    /**
     * Builds the database payload for a repair service row.
     *
     * @param {object} data
     * @returns {object}
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
     * Creates the slide-over HTML for the service form.
     *
     * @param {object} service
     * @param {boolean} isEdit
     * @returns {string}
     */
    function buildServiceFormMarkup(service, isEdit) {
        var currentService = service || {};

        return '<div class="admin-slideover-head"><h3><i class="fas '
            + (isEdit ? 'fa-edit' : 'fa-plus')
            + '"></i> '
            + (isEdit ? 'تعديل الخدمة' : 'إضافة خدمة')
            + '</h3><button class="btn btn-ghost btn-sm close-svc"><i class="fas fa-times"></i></button></div>'
            + '<div class="admin-slideover-body"><form class="admin-form"><div class="form-grid">'
            + '<div class="admin-form-group full"><label>اسم الخدمة *</label><div class="admin-input-wrap"><i class="fas fa-wrench"></i><input type="text" id="svcName" value="' + esc(currentService.name || '') + '" required></div></div>'
            + '<div class="admin-form-group"><label>الفئة</label><div class="admin-input-wrap"><i class="fas fa-tag"></i><input type="text" id="svcCategory" value="' + esc(currentService.category || '') + '"></div></div>'
            + '<div class="admin-form-group"><label>السعر *</label><div class="admin-input-wrap"><i class="fas fa-money-bill"></i><input type="number" id="svcPrice" value="' + esc(currentService.price || '') + '" min="0" step="0.01" required></div></div>'
            + '<div class="admin-form-group"><label>المدة المتوقعة</label><div class="admin-input-wrap"><i class="fas fa-clock"></i><input type="text" id="svcDuration" value="' + esc(currentService.duration || '') + '" placeholder="مثال: 2-3 أيام"></div></div>'
            + '<div class="admin-form-group full"><label>رابط أو مسار الصورة</label><div class="admin-input-wrap"><i class="fas fa-image"></i><input type="text" id="svcImage" value="' + esc(currentService.image || '') + '" placeholder="https://example.com/service.jpg أو /images/service.jpg"></div></div>'
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
     * @param {object} data
     * @param {boolean} isEdit
     * @returns {Promise<boolean>}
     */
    async function saveService(data, isEdit) {
        var payload = buildServicePayload(data);
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
     * @param {string} id
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
     * Opens the service create/edit form.
     *
     * @param {object|null} service
     * @returns {void}
     */
    function openServiceForm(service) {
        var currentService = service || {};
        var isEdit = Boolean(currentService.id);
        var backdrop = document.createElement('div');
        var panel = document.createElement('div');

        backdrop.className = 'admin-slideover-backdrop';
        panel.className = 'admin-slideover';
        panel.innerHTML = buildServiceFormMarkup(currentService, isEdit);

        document.body.appendChild(backdrop);
        document.body.appendChild(panel);

        function close() {
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
                return;
            }

            close();
            await TZ.refreshData();
            renderServices();
        });
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
            + '<th>الخدمة</th><th>الفئة</th><th>السعر</th><th>المدة</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody>';

        if (services.length === 0) {
            html += '<tr><td colspan="6"><div class="empty-state"><i class="fas fa-screwdriver-wrench"></i><p>لا توجد خدمات</p></div></td></tr>';
        } else {
            services.forEach(function (service) {
                html += '<tr>'
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
            buildServicePayload: buildServicePayload,
            normalizeServiceImage: normalizeServiceImage
        };
    }
})();
