// ===== TechZone Admin - Maintenance Services Only =====
(function () {
    'use strict';
    const A = window.AdminApp;

    function renderServices() {
        const services = (TZ.db.repairServices || []).slice().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

        A.adminContent.innerHTML = `
            <div class="filter-bar">
                <input type="text" id="serviceSearch" placeholder="بحث باسم الخدمة..." style="flex:1;min-width:220px;">
                <button class="btn btn-primary btn-sm" id="addServiceBtn"><i class="fas fa-plus"></i> إضافة خدمة صيانة</button>
            </div>

            <div class="admin-panel">
                <div class="panel-header"><h2><i class="fas fa-tools"></i> خدمات الصيانة (${services.length})</h2></div>
                <div class="panel-body">
                    <div class="table-wrap">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>الخدمة</th>
                                <th>القسم</th>
                                <th>السعر</th>
                                <th>المدة</th>
                                <th>الحالة</th>
                                <th>إجراءات</th>
                            </tr>
                        </thead>
                        <tbody id="servicesTableBody">
                            ${services.map(s => `
                                <tr data-service-id="${s.id}">
                                    <td>
                                        <strong>${TZ.escapeHtml(s.name || '')}</strong>
                                        ${s.description ? `<br><small style="color:var(--text-muted)">${TZ.escapeHtml((s.description || '').substring(0, 70))}</small>` : ''}
                                    </td>
                                    <td>${TZ.escapeHtml(s.category || 'خدمات الصيانة')}</td>
                                    <td>${TZ.formatPrice(Number(s.price || 0))}</td>
                                    <td>${TZ.escapeHtml(s.duration || '-')}</td>
                                    <td><span class="status-badge ${s.status === 'active' ? 'active' : 'hidden'}">${s.status === 'active' ? 'ظاهر' : 'مخفي'}</span></td>
                                    <td class="actions-cell">
                                        <button class="action-btn edit-service-btn" data-id="${s.id}" title="تعديل"><i class="fas fa-edit"></i></button>
                                        <button class="action-btn success toggle-service-btn" data-id="${s.id}" title="إظهار/إخفاء"><i class="fas fa-toggle-on"></i></button>
                                        <button class="action-btn danger delete-service-btn" data-id="${s.id}" title="حذف"><i class="fas fa-trash"></i></button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    </div>
                </div>
            </div>

            <div class="admin-panel" id="serviceFormPanel" style="display:none;">
                <div class="panel-header"><h2 id="serviceFormTitle"><i class="fas fa-plus"></i> إضافة خدمة صيانة</h2></div>
                <div class="panel-body padded">
                    <form class="admin-form" id="serviceForm">
                        <div class="form-grid">
                            <div class="admin-form-group">
                                <label>اسم الخدمة *</label>
                                <div class="admin-input-wrap"><i class="fas fa-tools"></i><input type="text" id="srvName" required></div>
                            </div>
                            <div class="admin-form-group">
                                <label>السعر *</label>
                                <div class="admin-input-wrap"><i class="fas fa-money-bill"></i><input type="number" id="srvPrice" min="0" step="0.01" required></div>
                            </div>
                            <div class="admin-form-group">
                                <label>مدة التنفيذ</label>
                                <div class="admin-input-wrap"><i class="fas fa-clock"></i><input type="text" id="srvDuration" placeholder="مثال: 30 دقيقة"></div>
                            </div>
                            <div class="admin-form-group">
                                <label>الأيقونة</label>
                                <div class="admin-input-wrap"><i class="fas fa-icons"></i><input type="text" id="srvIcon" placeholder="fa-wrench"></div>
                            </div>
                            <div class="admin-form-group">
                                <label>الحالة</label>
                                <select id="srvStatus">
                                    <option value="active">ظاهر</option>
                                    <option value="hidden">مخفي</option>
                                </select>
                            </div>
                            <div class="admin-form-group full">
                                <label>الوصف</label>
                                <textarea id="srvDescription" rows="3"></textarea>
                            </div>
                            <div class="admin-form-group full">
                                <label>صورة الخدمة</label>
                                <div class="image-upload-area" id="srvImageUploadArea" style="cursor:pointer;">
                                    <i class="fas fa-cloud-upload-alt"></i>
                                    <p>اضغط لرفع صورة (حد أقصى 1MB)</p>
                                    <input type="file" id="srvImageInput" accept="image/*" style="display:none;">
                                </div>
                                <div id="srvImagePreview" style="margin-top:10px;"></div>
                            </div>
                        </div>
                        <div style="margin-top:15px;display:flex;gap:10px;">
                            <button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> حفظ</button>
                            <button type="button" class="btn btn-outline" id="cancelServiceBtn">إلغاء</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        bindServiceEvents();
    }

    function bindServiceEvents() {
        const search = document.getElementById('serviceSearch');
        search.addEventListener('input', function () {
            const q = (this.value || '').toLowerCase().trim();
            document.querySelectorAll('#servicesTableBody tr').forEach(tr => {
                const service = (TZ.db.repairServices || []).find(s => s.id === tr.dataset.serviceId);
                const name = (service?.name || '').toLowerCase();
                tr.style.display = !q || name.includes(q) ? '' : 'none';
            });
        });

        const formPanel = document.getElementById('serviceFormPanel');
        const form = document.getElementById('serviceForm');
        const preview = document.getElementById('srvImagePreview');
        let imageValue = '';

        function fillForm(service) {
            if (service) {
                document.getElementById('srvName').value = service.name || '';
                document.getElementById('srvPrice').value = Number(service.price || 0);
                document.getElementById('srvDuration').value = service.duration || '';
                document.getElementById('srvIcon').value = service.icon || '';
                document.getElementById('srvStatus').value = service.status || 'active';
                document.getElementById('srvDescription').value = service.description || '';
                imageValue = service.image || '';
            } else {
                form.reset();
                document.getElementById('srvStatus').value = 'active';
                imageValue = '';
            }

            if (imageValue) {
                preview.innerHTML = `<div class="image-preview" style="display:inline-block;position:relative;"><img src="${imageValue}" alt="صورة الخدمة" style="max-width:120px;border-radius:8px;"><button type="button" class="remove-img" style="position:absolute;top:-5px;right:-5px;background:#e74c3c;color:#fff;border:none;border-radius:50%;width:22px;height:22px;cursor:pointer;font-size:10px;"><i class="fas fa-times"></i></button></div>`;
                preview.querySelector('.remove-img').addEventListener('click', () => {
                    imageValue = '';
                    preview.innerHTML = '';
                });
            } else {
                preview.innerHTML = '';
            }
        }

        document.getElementById('addServiceBtn').addEventListener('click', function () {
            A.editingServiceId = null;
            document.getElementById('serviceFormTitle').innerHTML = '<i class="fas fa-plus"></i> إضافة خدمة صيانة';
            fillForm(null);
            formPanel.style.display = 'block';
            formPanel.scrollIntoView({ behavior: 'smooth' });
        });

        document.getElementById('cancelServiceBtn').addEventListener('click', function () {
            formPanel.style.display = 'none';
        });

        document.querySelectorAll('.edit-service-btn').forEach(btn => {
            btn.addEventListener('click', function () {
                const service = (TZ.db.repairServices || []).find(s => s.id === this.dataset.id);
                if (!service) return;
                A.editingServiceId = service.id;
                document.getElementById('serviceFormTitle').innerHTML = '<i class="fas fa-edit"></i> تعديل خدمة الصيانة';
                fillForm(service);
                formPanel.style.display = 'block';
                formPanel.scrollIntoView({ behavior: 'smooth' });
            });
        });

        document.querySelectorAll('.toggle-service-btn').forEach(btn => {
            btn.addEventListener('click', function () {
                const service = (TZ.db.repairServices || []).find(s => s.id === this.dataset.id);
                if (!service) return;
                service.status = service.status === 'active' ? 'hidden' : 'active';
                TZ.commitDb('service_toggle', TZ.getSession()?.userId, `${service.name}: ${service.status}`, { type: 'repair_service', data: service });
                renderServices();
                A.showToast('تم تحديث حالة خدمة الصيانة');
            });
        });

        document.querySelectorAll('.delete-service-btn').forEach(btn => {
            btn.addEventListener('click', function () {
                const service = (TZ.db.repairServices || []).find(s => s.id === this.dataset.id);
                if (!service) return;
                A.showConfirmModal('حذف خدمة الصيانة', `هل أنت متأكد من حذف الخدمة "${TZ.escapeHtml(service.name)}"؟`, () => {
                    TZ.db.repairServices = (TZ.db.repairServices || []).filter(s => s.id !== service.id);
                    TZ.commitDb('service_delete', TZ.getSession()?.userId, service.name, { type: 'repair_service_delete', data: { id: service.id } });
                    renderServices();
                    A.showToast('تم حذف خدمة الصيانة');
                });
            });
        });

        const uploadArea = document.getElementById('srvImageUploadArea');
        const imageInput = document.getElementById('srvImageInput');
        uploadArea.addEventListener('click', () => imageInput.click());
        imageInput.addEventListener('change', function () {
            const file = this.files[0];
            if (!file) return;
            if (file.size > 1048576) {
                A.showToast('حجم الصورة يتجاوز 1MB');
                return;
            }
            const reader = new FileReader();
            reader.onload = function (e) {
                imageValue = e.target.result;
                preview.innerHTML = `<div class="image-preview" style="display:inline-block;position:relative;"><img src="${imageValue}" alt="صورة الخدمة" style="max-width:120px;border-radius:8px;"><button type="button" class="remove-img" style="position:absolute;top:-5px;right:-5px;background:#e74c3c;color:#fff;border:none;border-radius:50%;width:22px;height:22px;cursor:pointer;font-size:10px;"><i class="fas fa-times"></i></button></div>`;
                preview.querySelector('.remove-img').addEventListener('click', () => {
                    imageValue = '';
                    preview.innerHTML = '';
                });
            };
            reader.readAsDataURL(file);
        });

        form.addEventListener('submit', function (e) {
            e.preventDefault();

            const payload = {
                name: document.getElementById('srvName').value.trim(),
                category: 'خدمات الصيانة',
                price: Number(document.getElementById('srvPrice').value || 0),
                duration: document.getElementById('srvDuration').value.trim(),
                icon: document.getElementById('srvIcon').value.trim() || 'fa-wrench',
                description: document.getElementById('srvDescription').value.trim(),
                image: imageValue || '',
                status: document.getElementById('srvStatus').value,
                updatedAt: TZ.nowIso()
            };

            if (!payload.name) {
                A.showToast('⚠️ أدخل اسم الخدمة');
                return;
            }
            if (payload.price < 0) {
                A.showToast('⚠️ السعر يجب أن يكون صفر أو أكثر');
                return;
            }

            if (A.editingServiceId) {
                const existing = (TZ.db.repairServices || []).find(s => s.id === A.editingServiceId);
                if (!existing) return;
                Object.assign(existing, payload);
                TZ.commitDb('service_update', TZ.getSession()?.userId, payload.name, { type: 'repair_service', data: existing });
                A.showToast('تم تحديث خدمة الصيانة');
            } else {
                payload.id = TZ.generateId('srv-');
                payload.createdAt = TZ.nowIso();
                if (!TZ.db.repairServices) TZ.db.repairServices = [];
                TZ.db.repairServices.push(payload);
                TZ.commitDb('service_create', TZ.getSession()?.userId, payload.name, { type: 'repair_service', data: payload });
                A.showToast('تمت إضافة خدمة الصيانة');
            }

            renderServices();
        });
    }

    A.sections.services = renderServices;
})();
