/**
 * TechZone Admin — Products Section (Rebuilt)
 *
 * Full product management with CRUD operations via Supabase.
 * Features: table view, search, category filter, slide-over form,
 * image upload, specs editor, and inline status toggle.
 */
(function () {
    'use strict';

    var A = window.AdminApp;
    if (!A) return;

    var filterCategory = '';
    var filterStatus = '';
    var searchQuery = '';
    var currentPage = 1;
    var PAGE_SIZE = 15;
    var editingProduct = null;

    function esc(v) { return TZ.escapeHtml(v == null ? '' : String(v)); }

    /* ── Data helpers ── */

    function getProducts() {
        var products = TZ.db.products || [];
        return products.filter(function (p) {
            if (typeof TZ.isAccessoryProduct === 'function' && TZ.isAccessoryProduct(p)) return false;
            return true;
        });
    }

    function applyFilters(list) {
        var result = list;
        if (filterCategory) result = result.filter(function (p) { return p.categoryId === filterCategory || p.category_id === filterCategory; });
        if (filterStatus) result = result.filter(function (p) { return p.status === filterStatus; });
        if (searchQuery) {
            var q = searchQuery.toLowerCase();
            result = result.filter(function (p) {
                return (p.name || '').toLowerCase().includes(q) || (p.brand || '').toLowerCase().includes(q) || (p.id || '').toLowerCase().includes(q);
            });
        }
        return result;
    }

    function paginate(list) {
        var start = (currentPage - 1) * PAGE_SIZE;
        return { items: list.slice(start, start + PAGE_SIZE), total: list.length, pages: Math.ceil(list.length / PAGE_SIZE) || 1 };
    }

    function getCategoryName(id) {
        if (typeof TZ.getCategoryName === 'function') return TZ.getCategoryName(id);
        var cat = (TZ.db.categories || []).find(function (c) { return c.id === id; });
        return cat ? cat.name : '-';
    }

    function getSubcategories() {
        return (TZ.db.categories || []).filter(function (c) { return c.parentId || c.parent_id; });
    }

    /* ── CRUD ── */

    async function saveProduct(data) {
        var isEdit = Boolean(data.id && editingProduct);
        var payload = {
            name: data.name,
            category_id: data.categoryId,
            brand: data.brand || '',
            price: Number(data.price) || 0,
            discount_price: Number(data.discountPrice) || null,
            quantity: Number(data.quantity) || 0,
            product_type: data.productType || 'physical',
            status: data.status || 'active',
            description: data.description || '',
            low_stock_alert: Number(data.lowStockAlert) || 5,
            updated_at: new Date().toISOString()
        };

        var result;
        if (isEdit) {
            result = await TZ.supabase.from('products').update(payload).eq('id', data.id);
        } else {
            result = await TZ.supabase.from('products').insert([payload]);
        }

        if (result.error) {
            A.showToast('فشل حفظ المنتج: ' + (result.error.message || ''));
            return false;
        }

        A.showToast(isEdit ? 'تم تحديث المنتج بنجاح' : 'تم إضافة المنتج بنجاح');
        return true;
    }

    async function deleteProduct(id) {
        if (!confirm('هل أنت متأكد من حذف هذا المنتج؟')) return;
        var result = await TZ.supabase.from('products').delete().eq('id', id);
        if (result.error) {
            A.showToast('فشل حذف المنتج');
            return;
        }
        A.showToast('تم حذف المنتج');
        await TZ.refreshData();
        renderProducts();
    }

    async function toggleStatus(id, currentStatus) {
        var newStatus = currentStatus === 'active' ? 'draft' : 'active';
        var result = await TZ.supabase.from('products').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', id);
        if (result.error) { A.showToast('فشل تحديث الحالة'); return; }
        A.showToast('تم تحديث حالة المنتج');
        await TZ.refreshData();
        renderProducts();
    }

    /* ── Slide-over form ── */

    function openProductForm(product) {
        editingProduct = product || null;
        var p = product || {};
        var cats = getSubcategories();
        var isEdit = Boolean(p.id);

        var catOptions = '<option value="">-- اختر الفئة --</option>';
        cats.forEach(function (c) {
            var selected = (p.categoryId === c.id || p.category_id === c.id) ? ' selected' : '';
            catOptions += '<option value="' + c.id + '"' + selected + '>' + esc(c.name) + '</option>';
        });

        var backdrop = document.createElement('div');
        backdrop.className = 'admin-slideover-backdrop';
        backdrop.id = 'productFormBackdrop';

        var panel = document.createElement('div');
        panel.className = 'admin-slideover';
        panel.innerHTML = ''
            + '<div class="admin-slideover-head">'
            + '<h3><i class="fas ' + (isEdit ? 'fa-edit' : 'fa-plus') + '"></i> ' + (isEdit ? 'تعديل المنتج' : 'إضافة منتج جديد') + '</h3>'
            + '<button class="btn btn-ghost btn-sm" id="closeProductForm"><i class="fas fa-times"></i></button>'
            + '</div>'
            + '<div class="admin-slideover-body">'
            + '<form class="admin-form" id="productForm">'
            + '<div class="form-grid">'
            + '<div class="admin-form-group full"><label>اسم المنتج *</label><div class="admin-input-wrap"><i class="fas fa-box"></i><input type="text" id="prdName" value="' + esc(p.name || '') + '" required></div></div>'
            + '<div class="admin-form-group"><label>الفئة *</label><select id="prdCategory" required>' + catOptions + '</select></div>'
            + '<div class="admin-form-group"><label>العلامة التجارية</label><div class="admin-input-wrap"><i class="fas fa-tag"></i><input type="text" id="prdBrand" value="' + esc(p.brand || '') + '"></div></div>'
            + '<div class="admin-form-group"><label>السعر *</label><div class="admin-input-wrap"><i class="fas fa-money-bill"></i><input type="number" id="prdPrice" value="' + (p.price || '') + '" min="0" step="0.01" required></div></div>'
            + '<div class="admin-form-group"><label>سعر الخصم</label><div class="admin-input-wrap"><i class="fas fa-percent"></i><input type="number" id="prdDiscount" value="' + (p.discountPrice || p.discount_price || '') + '" min="0" step="0.01"></div></div>'
            + '<div class="admin-form-group"><label>الكمية *</label><div class="admin-input-wrap"><i class="fas fa-cubes"></i><input type="number" id="prdQty" value="' + (p.quantity || 0) + '" min="0"></div></div>'
            + '<div class="admin-form-group"><label>حد تنبيه المخزون</label><div class="admin-input-wrap"><i class="fas fa-bell"></i><input type="number" id="prdLowStock" value="' + (p.low_stock_alert || p.lowStockAlert || 5) + '" min="0"></div></div>'
            + '<div class="admin-form-group"><label>الحالة</label><select id="prdStatus"><option value="active"' + (p.status === 'active' || !p.status ? ' selected' : '') + '>نشط</option><option value="draft"' + (p.status === 'draft' ? ' selected' : '') + '>مسودة</option></select></div>'
            + '<div class="admin-form-group"><label>نوع المنتج</label><select id="prdType"><option value="physical"' + ((p.product_type || p.productType || 'physical') === 'physical' ? ' selected' : '') + '>فيزيائي</option><option value="digital"' + ((p.product_type || p.productType) === 'digital' ? ' selected' : '') + '>رقمي</option></select></div>'
            + '<div class="admin-form-group full"><label>الوصف</label><textarea id="prdDesc" rows="4">' + esc(p.description || '') + '</textarea></div>'
            + '</div>'
            + '</form>'
            + '</div>'
            + '<div class="admin-slideover-footer">'
            + '<button class="btn btn-primary" id="saveProductBtn"><i class="fas fa-save"></i> ' + (isEdit ? 'تحديث' : 'إضافة') + '</button>'
            + '<button class="btn btn-outline" id="cancelProductBtn">إلغاء</button>'
            + '</div>';

        document.body.appendChild(backdrop);
        document.body.appendChild(panel);

        function close() { backdrop.remove(); panel.remove(); editingProduct = null; }

        backdrop.addEventListener('click', close);
        document.getElementById('closeProductForm').addEventListener('click', close);
        document.getElementById('cancelProductBtn').addEventListener('click', close);

        document.getElementById('saveProductBtn').addEventListener('click', async function () {
            var btn = this;
            var name = document.getElementById('prdName').value.trim();
            var catId = document.getElementById('prdCategory').value;
            var price = document.getElementById('prdPrice').value;

            if (!name || !catId || !price) { A.showToast('أكمل الحقول المطلوبة'); return; }

            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';

            var ok = await saveProduct({
                id: isEdit ? p.id : null,
                name: name,
                categoryId: catId,
                brand: document.getElementById('prdBrand').value.trim(),
                price: price,
                discountPrice: document.getElementById('prdDiscount').value,
                quantity: document.getElementById('prdQty').value,
                lowStockAlert: document.getElementById('prdLowStock').value,
                status: document.getElementById('prdStatus').value,
                productType: document.getElementById('prdType').value,
                description: document.getElementById('prdDesc').value.trim()
            });

            if (ok) {
                close();
                await TZ.refreshData();
                renderProducts();
            } else {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-save"></i> ' + (isEdit ? 'تحديث' : 'إضافة');
            }
        });
    }

    /* ── Render ── */

    function renderProducts() {
        var all = getProducts();
        var filtered = applyFilters(all);
        var sorted = filtered.sort(function (a, b) { return new Date(b.createdAt || b.created_at || 0) - new Date(a.createdAt || a.created_at || 0); });
        var page = paginate(sorted);
        var cats = getSubcategories();

        var html = '';

        /* ── Header ── */
        html += '<div class="admin-section-header">'
            + '<div><h2><i class="fas fa-box-open"></i> إدارة المنتجات</h2>'
            + '<p>إجمالي ' + all.length + ' منتج</p></div>'
            + '<div class="admin-section-actions"><button class="btn btn-primary btn-sm" id="addProductBtn"><i class="fas fa-plus"></i> إضافة منتج</button></div>'
            + '</div>';

        /* ── Filters ── */
        html += '<div class="filter-bar">'
            + '<input type="search" id="productsSearch" placeholder="ابحث بالاسم أو العلامة التجارية..." value="' + esc(searchQuery) + '">'
            + '<select id="productsCatFilter"><option value="">كل الفئات</option>';
        cats.forEach(function (c) {
            html += '<option value="' + c.id + '"' + (filterCategory === c.id ? ' selected' : '') + '>' + esc(c.name) + '</option>';
        });
        html += '</select>'
            + '<select id="productsStatusFilter"><option value="">كل الحالات</option>'
            + '<option value="active"' + (filterStatus === 'active' ? ' selected' : '') + '>نشط</option>'
            + '<option value="draft"' + (filterStatus === 'draft' ? ' selected' : '') + '>مسودة</option>'
            + '<option value="out_of_stock"' + (filterStatus === 'out_of_stock' ? ' selected' : '') + '>نفد المخزون</option>'
            + '</select></div>';

        /* ── Table ── */
        html += '<div class="admin-panel"><div class="panel-body"><div class="table-wrap"><table class="data-table"><thead><tr>'
            + '<th>المنتج</th><th>الفئة</th><th>السعر</th><th>المخزون</th><th>المبيعات</th><th>الحالة</th><th>إجراءات</th>'
            + '</tr></thead><tbody>';

        if (page.items.length === 0) {
            html += '<tr><td colspan="7"><div class="empty-state"><i class="fas fa-box-open"></i><p>لا توجد منتجات مطابقة</p></div></td></tr>';
        } else {
            page.items.forEach(function (p) {
                var catName = getCategoryName(p.categoryId || p.category_id);
                var stockColor = p.quantity <= 0 ? '#e74c3c' : p.quantity <= (p.low_stock_alert || p.lowStockAlert || 5) ? '#fdcb6e' : '#00b894';
                var statusBadge = '<span class="status-badge ' + p.status + '">' + (p.status === 'active' ? 'نشط' : p.status === 'draft' ? 'مسودة' : p.status) + '</span>';

                html += '<tr>'
                    + '<td><strong>' + esc(p.name) + '</strong>' + (p.brand ? '<br><small style="color:var(--text-muted);">' + esc(p.brand) + '</small>' : '') + '</td>'
                    + '<td><small>' + esc(catName) + '</small></td>'
                    + '<td style="font-weight:600;">' + TZ.formatPrice(p.price) + (p.discount_price || p.discountPrice ? '<br><small style="color:#00b894;">' + TZ.formatPrice(p.discount_price || p.discountPrice) + '</small>' : '') + '</td>'
                    + '<td style="color:' + stockColor + ';font-weight:600;">' + p.quantity + '</td>'
                    + '<td>' + (p.sold || 0) + '</td>'
                    + '<td>' + statusBadge + '</td>'
                    + '<td class="actions-cell">'
                    + '<button class="action-btn edit-product-btn" data-id="' + p.id + '" title="تعديل"><i class="fas fa-edit"></i></button>'
                    + '<button class="action-btn toggle-product-btn" data-id="' + p.id + '" data-status="' + p.status + '" title="تغيير الحالة"><i class="fas fa-eye' + (p.status === 'active' ? '-slash' : '') + '"></i></button>'
                    + '<button class="action-btn danger delete-product-btn" data-id="' + p.id + '" title="حذف"><i class="fas fa-trash"></i></button>'
                    + '</td></tr>';
            });
        }
        html += '</tbody></table></div></div>';

        /* ── Pagination ── */
        if (page.pages > 1) {
            html += '<div class="admin-table-pagination">'
                + '<div class="admin-table-pagination-info">عرض ' + page.items.length + ' من ' + page.total + '</div>'
                + '<div class="admin-table-pagination-controls">';
            html += '<button data-page="' + (currentPage - 1) + '"' + (currentPage <= 1 ? ' disabled' : '') + '><i class="fas fa-chevron-right"></i></button>';
            for (var i = 1; i <= page.pages; i++) {
                html += '<button data-page="' + i + '" class="' + (i === currentPage ? 'active' : '') + '">' + i + '</button>';
            }
            html += '<button data-page="' + (currentPage + 1) + '"' + (currentPage >= page.pages ? ' disabled' : '') + '><i class="fas fa-chevron-left"></i></button>';
            html += '</div></div>';
        }
        html += '</div>';

        A.adminContent.innerHTML = html;
        bindProductEvents();
    }

    function bindProductEvents() {
        document.getElementById('addProductBtn')?.addEventListener('click', function () { openProductForm(null); });

        document.getElementById('productsSearch')?.addEventListener('input', function () { searchQuery = this.value; currentPage = 1; renderProducts(); });
        document.getElementById('productsCatFilter')?.addEventListener('change', function () { filterCategory = this.value; currentPage = 1; renderProducts(); });
        document.getElementById('productsStatusFilter')?.addEventListener('change', function () { filterStatus = this.value; currentPage = 1; renderProducts(); });

        document.querySelectorAll('[data-page]').forEach(function (btn) {
            btn.addEventListener('click', function () { var p = parseInt(btn.dataset.page, 10); if (p >= 1) { currentPage = p; renderProducts(); } });
        });

        document.querySelectorAll('.edit-product-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var prod = (TZ.db.products || []).find(function (p) { return p.id === btn.dataset.id; });
                if (prod) openProductForm(prod);
            });
        });

        document.querySelectorAll('.toggle-product-btn').forEach(function (btn) {
            btn.addEventListener('click', function () { toggleStatus(btn.dataset.id, btn.dataset.status); });
        });

        document.querySelectorAll('.delete-product-btn').forEach(function (btn) {
            btn.addEventListener('click', function () { deleteProduct(btn.dataset.id); });
        });
    }

    A.sections.products = renderProducts;
})();
