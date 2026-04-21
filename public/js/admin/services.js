/**
 * TechZone Admin — Services Section (Rebuilt)
 *
 * Manages repair/maintenance services via Supabase.
 */
(function () {
    'use strict';

    var A = window.AdminApp;
    if (!A) return;

    function esc(v) { return TZ.escapeHtml(v == null ? '' : String(v)); }

    async function saveService(data, isEdit) {
        var payload = {
            name: data.name,
            category: data.category || null,
            price: Number(data.price) || 0,
            duration: data.duration || null,
            description: data.description || null,
            status: data.status || 'active',
            updated_at: new Date().toISOString()
        };
        var result;
        if (isEdit) result = await TZ.supabase.from('repair_services').update(payload).eq('id', data.id);
        else result = await TZ.supabase.from('repair_services').insert([payload]);
        if (result.error) { A.showToast('فشل حفظ الخدمة'); return false; }
        A.showToast(isEdit ? 'تم تحديث الخدمة' : 'تم إضافة الخدمة');
        return true;
    }

    async function deleteService(id) {
        if (!confirm('هل أنت متأكد من حذف هذه الخدمة؟')) return;
        var result = await TZ.supabase.from('repair_services').delete().eq('id', id);
        if (result.error) { A.showToast('فشل حذف الخدمة'); return; }
        A.showToast('تم حذف الخدمة');
        await TZ.refreshData();
        renderServices();
    }

    function openServiceForm(service) {
        var s = service || {};
        var isEdit = Boolean(s.id);
        var backdrop = document.createElement('div');
        backdrop.className = 'admin-slideover-backdrop';
        var panel = document.createElement('div');
        panel.className = 'admin-slideover';
        panel.innerHTML = '<div class="admin-slideover-head"><h3><i class="fas ' + (isEdit ? 'fa-edit' : 'fa-plus') + '"></i> ' + (isEdit ? 'تعديل الخدمة' : 'إضافة خدمة') + '</h3><button class="btn btn-ghost btn-sm close-svc"><i class="fas fa-times"></i></button></div>'
            + '<div class="admin-slideover-body"><form class="admin-form"><div class="form-grid">'
            + '<div class="admin-form-group full"><label>اسم الخدمة *</label><div class="admin-input-wrap"><i class="fas fa-wrench"></i><input type="text" id="svcName" value="' + esc(s.name || '') + '" required></div></div>'
            + '<div class="admin-form-group"><label>الفئة</label><div class="admin-input-wrap"><i class="fas fa-tag"></i><input type="text" id="svcCategory" value="' + esc(s.category || '') + '"></div></div>'
            + '<div class="admin-form-group"><label>السعر *</label><div class="admin-input-wrap"><i class="fas fa-money-bill"></i><input type="number" id="svcPrice" value="' + (s.price || '') + '" min="0" step="0.01" required></div></div>'
            + '<div class="admin-form-group"><label>المدة المتوقعة</label><div class="admin-input-wrap"><i class="fas fa-clock"></i><input type="text" id="svcDuration" value="' + esc(s.duration || '') + '" placeholder="مثال: 2-3 أيام"></div></div>'
            + '<div class="admin-form-group"><label>الحالة</label><select id="svcStatus"><option value="active"' + (s.status === 'active' || !s.status ? ' selected' : '') + '>نشطة</option><option value="inactive"' + (s.status === 'inactive' ? ' selected' : '') + '>معطلة</option></select></div>'
            + '<div class="admin-form-group full"><label>الوصف</label><textarea id="svcDesc" rows="3">' + esc(s.description || '') + '</textarea></div>'
            + '</div></form></div>'
            + '<div class="admin-slideover-footer"><button class="btn btn-primary" id="saveSvcBtn"><i class="fas fa-save"></i> ' + (isEdit ? 'تحديث' : 'إضافة') + '</button><button class="btn btn-outline close-svc">إلغاء</button></div>';

        document.body.appendChild(backdrop);
        document.body.appendChild(panel);
        function close() { backdrop.remove(); panel.remove(); }
        backdrop.addEventListener('click', close);
        panel.querySelectorAll('.close-svc').forEach(function (b) { b.addEventListener('click', close); });

        document.getElementById('saveSvcBtn').addEventListener('click', async function () {
            var name = document.getElementById('svcName').value.trim();
            if (!name) { A.showToast('أدخل اسم الخدمة'); return; }
            this.disabled = true;
            var ok = await saveService({
                id: isEdit ? s.id : null, name: name,
                category: document.getElementById('svcCategory').value.trim(),
                price: document.getElementById('svcPrice').value,
                duration: document.getElementById('svcDuration').value.trim(),
                status: document.getElementById('svcStatus').value,
                description: document.getElementById('svcDesc').value.trim()
            }, isEdit);
            if (ok) { close(); await TZ.refreshData(); renderServices(); }
            else { this.disabled = false; }
        });
    }

    function renderServices() {
        var services = TZ.db.repairServices || [];
        var html = '<div class="admin-section-header"><div><h2><i class="fas fa-screwdriver-wrench"></i> خدمات الصيانة</h2><p>' + services.length + ' خدمة</p></div>'
            + '<div class="admin-section-actions"><button class="btn btn-primary btn-sm" id="addSvcBtn"><i class="fas fa-plus"></i> إضافة خدمة</button></div></div>';

        html += '<div class="admin-panel"><div class="panel-body"><div class="table-wrap"><table class="data-table"><thead><tr>'
            + '<th>الخدمة</th><th>الفئة</th><th>السعر</th><th>المدة</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody>';

        if (services.length === 0) {
            html += '<tr><td colspan="6"><div class="empty-state"><i class="fas fa-screwdriver-wrench"></i><p>لا توجد خدمات</p></div></td></tr>';
        } else {
            services.forEach(function (s) {
                html += '<tr>'
                    + '<td><strong>' + esc(s.name) + '</strong></td>'
                    + '<td>' + esc(s.category || '-') + '</td>'
                    + '<td style="font-weight:600;">' + TZ.formatPrice(s.price) + '</td>'
                    + '<td>' + esc(s.duration || '-') + '</td>'
                    + '<td><span class="status-badge ' + s.status + '">' + (s.status === 'active' ? 'نشطة' : 'معطلة') + '</span></td>'
                    + '<td class="actions-cell">'
                    + '<button class="action-btn edit-svc-btn" data-id="' + s.id + '"><i class="fas fa-edit"></i></button>'
                    + '<button class="action-btn danger del-svc-btn" data-id="' + s.id + '"><i class="fas fa-trash"></i></button>'
                    + '</td></tr>';
            });
        }
        html += '</tbody></table></div></div></div>';
        A.adminContent.innerHTML = html;

        document.getElementById('addSvcBtn')?.addEventListener('click', function () { openServiceForm(null); });
        document.querySelectorAll('.edit-svc-btn').forEach(function (b) {
            b.addEventListener('click', function () {
                var svc = services.find(function (s) { return s.id === b.dataset.id; });
                if (svc) openServiceForm(svc);
            });
        });
        document.querySelectorAll('.del-svc-btn').forEach(function (b) { b.addEventListener('click', function () { deleteService(b.dataset.id); }); });
    }

    A.sections.services = renderServices;
    A.sections['repair-services'] = renderServices;
})();
