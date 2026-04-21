/**
 * TechZone Admin — Accessories Section (Rebuilt)
 *
 * Manages accessory products (product_type = 'accessory') with CRUD via Supabase.
 */
(function () {
    'use strict';

    var A = window.AdminApp;
    if (!A) return;

    var searchQuery = '';
    var currentPage = 1;
    var PAGE_SIZE = 15;

    function esc(v) { return TZ.escapeHtml(v == null ? '' : String(v)); }

    function getAccessories() {
        return (TZ.db.products || []).filter(function (p) {
            return (p.productType === 'accessory' || p.product_type === 'accessory')
                || (typeof TZ.isAccessoryProduct === 'function' && TZ.isAccessoryProduct(p));
        });
    }

    function applyFilters(list) {
        if (!searchQuery) return list;
        var q = searchQuery.toLowerCase();
        return list.filter(function (p) { return (p.name || '').toLowerCase().includes(q) || (p.brand || '').toLowerCase().includes(q); });
    }

    function paginate(list) {
        var s = (currentPage - 1) * PAGE_SIZE;
        return { items: list.slice(s, s + PAGE_SIZE), total: list.length, pages: Math.ceil(list.length / PAGE_SIZE) || 1 };
    }

    async function saveAccessory(data, isEdit) {
        var payload = {
            name: data.name,
            category_id: data.categoryId || null,
            brand: data.brand || '',
            price: Number(data.price) || 0,
            quantity: Number(data.quantity) || 0,
            product_type: 'accessory',
            status: data.status || 'active',
            description: data.description || '',
            updated_at: new Date().toISOString()
        };
        var result;
        if (isEdit) result = await TZ.supabase.from('products').update(payload).eq('id', data.id);
        else result = await TZ.supabase.from('products').insert([payload]);
        if (result.error) { A.showToast('فشل حفظ الإكسسوار'); return false; }
        A.showToast(isEdit ? 'تم تحديث الإكسسوار' : 'تم إضافة الإكسسوار');
        return true;
    }

    async function deleteAccessory(id) {
        if (!confirm('هل أنت متأكد من الحذف؟')) return;
        var result = await TZ.supabase.from('products').delete().eq('id', id);
        if (result.error) { A.showToast('فشل الحذف'); return; }
        A.showToast('تم الحذف');
        await TZ.refreshData();
        renderAccessories();
    }

    function openForm(item) {
        var a = item || {};
        var isEdit = Boolean(a.id);
        var backdrop = document.createElement('div');
        backdrop.className = 'admin-slideover-backdrop';
        var panel = document.createElement('div');
        panel.className = 'admin-slideover';
        panel.innerHTML = '<div class="admin-slideover-head"><h3><i class="fas ' + (isEdit ? 'fa-edit' : 'fa-plus') + '"></i> ' + (isEdit ? 'تعديل' : 'إضافة') + ' إكسسوار</h3><button class="btn btn-ghost btn-sm close-acc"><i class="fas fa-times"></i></button></div>'
            + '<div class="admin-slideover-body"><form class="admin-form"><div class="form-grid">'
            + '<div class="admin-form-group full"><label>الاسم *</label><div class="admin-input-wrap"><i class="fas fa-headphones"></i><input type="text" id="accName" value="' + esc(a.name || '') + '" required></div></div>'
            + '<div class="admin-form-group"><label>العلامة التجارية</label><div class="admin-input-wrap"><i class="fas fa-tag"></i><input type="text" id="accBrand" value="' + esc(a.brand || '') + '"></div></div>'
            + '<div class="admin-form-group"><label>السعر *</label><div class="admin-input-wrap"><i class="fas fa-money-bill"></i><input type="number" id="accPrice" value="' + (a.price || '') + '" min="0" step="0.01" required></div></div>'
            + '<div class="admin-form-group"><label>الكمية</label><div class="admin-input-wrap"><i class="fas fa-cubes"></i><input type="number" id="accQty" value="' + (a.quantity || 0) + '" min="0"></div></div>'
            + '<div class="admin-form-group"><label>الحالة</label><select id="accStatus"><option value="active"' + (a.status === 'active' || !a.status ? ' selected' : '') + '>نشط</option><option value="draft"' + (a.status === 'draft' ? ' selected' : '') + '>مسودة</option></select></div>'
            + '<div class="admin-form-group full"><label>الوصف</label><textarea id="accDesc" rows="3">' + esc(a.description || '') + '</textarea></div>'
            + '</div></form></div>'
            + '<div class="admin-slideover-footer"><button class="btn btn-primary" id="saveAccBtn"><i class="fas fa-save"></i> ' + (isEdit ? 'تحديث' : 'إضافة') + '</button><button class="btn btn-outline close-acc">إلغاء</button></div>';

        document.body.appendChild(backdrop);
        document.body.appendChild(panel);
        function close() { backdrop.remove(); panel.remove(); }
        backdrop.addEventListener('click', close);
        panel.querySelectorAll('.close-acc').forEach(function (b) { b.addEventListener('click', close); });

        document.getElementById('saveAccBtn').addEventListener('click', async function () {
            var name = document.getElementById('accName').value.trim();
            if (!name) { A.showToast('أدخل الاسم'); return; }
            this.disabled = true;
            var ok = await saveAccessory({
                id: isEdit ? a.id : null, name: name,
                brand: document.getElementById('accBrand').value.trim(),
                price: document.getElementById('accPrice').value,
                quantity: document.getElementById('accQty').value,
                status: document.getElementById('accStatus').value,
                description: document.getElementById('accDesc').value.trim()
            }, isEdit);
            if (ok) { close(); await TZ.refreshData(); renderAccessories(); }
            else { this.disabled = false; }
        });
    }

    function renderAccessories() {
        var all = getAccessories();
        var filtered = applyFilters(all);
        var page = paginate(filtered);

        var html = '<div class="admin-section-header"><div><h2><i class="fas fa-headphones"></i> الإكسسوارات</h2><p>' + all.length + ' إكسسوار</p></div>'
            + '<div class="admin-section-actions"><button class="btn btn-primary btn-sm" id="addAccBtn"><i class="fas fa-plus"></i> إضافة</button></div></div>';

        html += '<div class="filter-bar"><input type="search" id="accSearch" placeholder="ابحث بالاسم أو العلامة..." value="' + esc(searchQuery) + '"></div>';

        html += '<div class="admin-panel"><div class="panel-body"><div class="table-wrap"><table class="data-table"><thead><tr>'
            + '<th>الاسم</th><th>العلامة</th><th>السعر</th><th>المخزون</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody>';

        if (page.items.length === 0) {
            html += '<tr><td colspan="6"><div class="empty-state"><i class="fas fa-headphones"></i><p>لا توجد إكسسوارات</p></div></td></tr>';
        } else {
            page.items.forEach(function (p) {
                html += '<tr>'
                    + '<td><strong>' + esc(p.name) + '</strong></td>'
                    + '<td>' + esc(p.brand || '-') + '</td>'
                    + '<td style="font-weight:600;">' + TZ.formatPrice(p.price) + '</td>'
                    + '<td>' + p.quantity + '</td>'
                    + '<td><span class="status-badge ' + p.status + '">' + (p.status === 'active' ? 'نشط' : 'مسودة') + '</span></td>'
                    + '<td class="actions-cell">'
                    + '<button class="action-btn edit-acc" data-id="' + p.id + '"><i class="fas fa-edit"></i></button>'
                    + '<button class="action-btn danger del-acc" data-id="' + p.id + '"><i class="fas fa-trash"></i></button>'
                    + '</td></tr>';
            });
        }
        html += '</tbody></table></div></div>';

        if (page.pages > 1) {
            html += '<div class="admin-table-pagination"><div class="admin-table-pagination-info">عرض ' + page.items.length + ' من ' + page.total + '</div>';
            html += '<div class="admin-table-pagination-controls">';
            for (var i = 1; i <= page.pages; i++) html += '<button data-page="' + i + '" class="' + (i === currentPage ? 'active' : '') + '">' + i + '</button>';
            html += '</div></div>';
        }
        html += '</div>';

        A.adminContent.innerHTML = html;

        document.getElementById('addAccBtn')?.addEventListener('click', function () { openForm(null); });
        document.getElementById('accSearch')?.addEventListener('input', function () { searchQuery = this.value; currentPage = 1; renderAccessories(); });
        document.querySelectorAll('[data-page]').forEach(function (b) { b.addEventListener('click', function () { currentPage = parseInt(b.dataset.page, 10); renderAccessories(); }); });
        document.querySelectorAll('.edit-acc').forEach(function (b) {
            b.addEventListener('click', function () {
                var item = all.find(function (p) { return p.id === b.dataset.id; });
                if (item) openForm(item);
            });
        });
        document.querySelectorAll('.del-acc').forEach(function (b) { b.addEventListener('click', function () { deleteAccessory(b.dataset.id); }); });
    }

    A.sections.accessories = renderAccessories;
})();
