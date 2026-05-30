/**
 * TechZone Admin - Products section.
 *
 * Manages physical products for the admin dashboard.
 */
(function () {
    'use strict';

    var A = window.AdminApp;
    if (!A) return;

    var filterCategory = '';
    var filterStatus = '';
    var searchQuery = '';
    var currentPage = 1;
    var pageSize = 15;
    var editingProduct = null;
    var pendingImageFile = null;
    var PRODUCT_IMAGE_BUCKET = 'product-images';
    var ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    var MAX_IMAGE_SIZE_BYTES = 4 * 1024 * 1024;

    function esc(value) {
        return TZ.escapeHtml(value == null ? '' : String(value));
    }

    function slugifyProduct(value) {
        var base = String(value == null ? '' : value)
            .trim()
            .toLowerCase()
            .replace(/[\s_]+/g, '-')
            .replace(/[^؀-ۿa-z0-9-]/g, '')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
        return base || null;
    }

    function normalizeType(product) {
        return String(product?.product_type || product?.productType || '').trim().toLowerCase();
    }

    function isPhysicalProduct(product) {
        var productType = normalizeType(product);
        return productType === '' || productType === 'physical';
    }

    function getProducts() {
        return (TZ.db.products || []).filter(function (product) {
            if (typeof TZ.isAccessoryProduct === 'function' && TZ.isAccessoryProduct(product)) return false;
            return isPhysicalProduct(product);
        });
    }

    function getSubcategories() {
        return (TZ.db.categories || []).filter(function (category) {
            return category.parentId || category.parent_id;
        });
    }

    function getCategoryName(categoryId) {
        if (typeof TZ.getCategoryName === 'function') {
            return TZ.getCategoryName(categoryId);
        }

        var category = (TZ.db.categories || []).find(function (item) {
            return item.id === categoryId;
        });

        return category ? category.name : '-';
    }

    function applyFilters(products) {
        var normalizedQuery = searchQuery.trim().toLowerCase();

        return products.filter(function (product) {
            if (filterCategory && (product.categoryId || product.category_id) !== filterCategory) return false;
            if (filterStatus && product.status !== filterStatus) return false;
            if (!normalizedQuery) return true;

            return [product.name, product.brand, product.id].some(function (value) {
                return String(value || '').toLowerCase().includes(normalizedQuery);
            });
        });
    }

    function paginate(products) {
        var startIndex = (currentPage - 1) * pageSize;
        var pages = Math.ceil(products.length / pageSize) || 1;

        return {
            items: products.slice(startIndex, startIndex + pageSize),
            pages: pages,
            total: products.length,
        };
    }

    async function ensureProductImageBucket() {
        var bucketRes = await TZ.supabase.storage.getBucket(PRODUCT_IMAGE_BUCKET);
        if (bucketRes.data) return;
        var msg = String(bucketRes.error?.message || '').toLowerCase();
        if (bucketRes.error && !msg.includes('not found')) return;
        await TZ.supabase.storage.createBucket(PRODUCT_IMAGE_BUCKET, {
            public: true,
            fileSizeLimit: MAX_IMAGE_SIZE_BYTES,
            allowedMimeTypes: ALLOWED_IMAGE_TYPES
        });
    }

    async function uploadProductImage(file) {
        if (!file) return null;
        var normalizedType = String(file.type || '').trim().toLowerCase();
        if (!ALLOWED_IMAGE_TYPES.includes(normalizedType)) {
            A.showErrorToast('PRM-110', 'نوع الملف غير مدعوم. استخدم JPEG أو PNG أو WebP.');
            return null;
        }
        if (Number(file.size || 0) > MAX_IMAGE_SIZE_BYTES) {
            A.showErrorToast('PRM-111', 'حجم الصورة يتجاوز 4MB.');
            return null;
        }
        try {
            await ensureProductImageBucket();
            var ext = file.name.split('.').pop() || 'jpg';
            var objectPath = 'products/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
            var uploadRes = await TZ.supabase.storage.from(PRODUCT_IMAGE_BUCKET).upload(objectPath, file, {
                contentType: file.type || 'application/octet-stream',
                upsert: false
            });
            if (uploadRes.error) {
                A.showErrorToast('PRM-312', 'فشل رفع الصورة: ' + (uploadRes.error.message || ''));
                return null;
            }
            var urlRes = TZ.supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(objectPath);
            return urlRes.data?.publicUrl || null;
        } catch (err) {
            A.showErrorToast('PRM-313', 'خطأ أثناء رفع الصورة.');
            return null;
        }
    }

    async function saveProduct(input) {
        var isEdit = Boolean(input.id && editingProduct);
        var imageUrl = await uploadProductImage(pendingImageFile);
        var existingImages = isEdit ? (editingProduct.images || []) : [];
        var images = imageUrl ? [imageUrl, ...existingImages] : existingImages;

        var payload = {
            name: input.name,
            category_id: input.categoryId,
            brand: input.brand || '',
            price: Number(input.price) || 0,
            discount_price: Number(input.discountPrice) || null,
            quantity: Number(input.quantity) || 0,
            product_type: 'physical',
            status: input.status || 'active',
            description: input.description || '',
            low_stock_alert: Number(input.lowStockAlert) || 5,
            sku: input.sku || null,
            slug: slugifyProduct(input.slug || input.name),
            icon: input.icon || null,
            is_featured: Boolean(input.isFeatured),
            images: images,
            updated_at: new Date().toISOString(),
        };

        var result = isEdit
            ? await TZ.supabase.from('products').update(payload).eq('id', input.id)
            : await TZ.supabase.from('products').insert([payload]);

        if (result.error) {
            A.showErrorToast('PRM-301', 'فشل حفظ المنتج: ' + (result.error.message || ''));
            return false;
        }

        pendingImageFile = null;
        A.showToast(isEdit ? 'تم تحديث المنتج بنجاح' : 'تم إضافة المنتج بنجاح');
        return true;
    }

    async function deleteProduct(productId) {
        if (!confirm('هل أنت متأكد من حذف هذا المنتج؟')) return;

        var result = await TZ.supabase.from('products').delete().eq('id', productId);
        if (result.error) {
            A.showErrorToast('PRM-302', 'فشل حذف المنتج');
            return;
        }

        A.showToast('تم حذف المنتج');
        await TZ.refreshData();
        renderProducts();
    }

    async function toggleStatus(productId, currentStatus) {
        var nextStatus = currentStatus === 'active' ? 'draft' : 'active';
        var result = await TZ.supabase
            .from('products')
            .update({ status: nextStatus, updated_at: new Date().toISOString() })
            .eq('id', productId);

        if (result.error) {
            A.showErrorToast('PRM-303', 'فشل تحديث الحالة');
            return;
        }

        A.showToast('تم تحديث حالة المنتج');
        await TZ.refreshData();
        renderProducts();
    }

    function buildCategoryOptions(product) {
        var selectedCategoryId = product.categoryId || product.category_id || '';
        var options = ['<option value="">-- اختر الفئة --</option>'];

        getSubcategories().forEach(function (category) {
            var selected = selectedCategoryId === category.id ? ' selected' : '';
            options.push('<option value="' + category.id + '"' + selected + '>' + esc(category.name) + '</option>');
        });

        return options.join('');
    }

    function closeProductForm(backdrop, panel) {
        backdrop.remove();
        panel.remove();
        editingProduct = null;
    }

    function clearElementChildren(element) {
        while (element && element.firstChild) {
            element.removeChild(element.firstChild);
        }
    }

    function createProductPreviewIcon() {
        var icon = document.createElement('i');
        icon.className = 'fas fa-image';
        icon.style.fontSize = '1.5rem';
        icon.style.opacity = '0.3';
        return icon;
    }

    function renderProductImagePreview(container, imageUrl, altText) {
        if (!container) return;

        clearElementChildren(container);
        if (!String(imageUrl || '').trim()) {
            container.appendChild(createProductPreviewIcon());
            return;
        }

        var image = document.createElement('img');
        image.src = String(imageUrl);
        image.alt = altText || 'Product image';
        image.style.width = '100%';
        image.style.height = '100%';
        image.style.objectFit = 'cover';
        image.style.borderRadius = '8px';
        container.appendChild(image);
    }

    function openProductForm(product) {
        editingProduct = product || null;
        pendingImageFile = null;
        var currentProduct = product || {};
        var existingImageUrl = (currentProduct.images && currentProduct.images.length > 0) ? currentProduct.images[0] : '';
        var isEdit = Boolean(currentProduct.id);
        var backdrop = document.createElement('div');
        var panel = document.createElement('div');

        backdrop.className = 'admin-slideover-backdrop';
        panel.className = 'admin-slideover';
        panel.innerHTML = `
            <div class="admin-slideover-head">
                <h3><i class="fas ${isEdit ? 'fa-edit' : 'fa-plus'}"></i> ${isEdit ? 'تعديل المنتج' : 'إضافة منتج جديد'}</h3>
                <button class="btn btn-ghost btn-sm" id="closeProductForm"><i class="fas fa-times"></i></button>
            </div>
            <div class="admin-slideover-body">
                <form class="admin-form" id="productForm">
                    <div class="form-grid">
                        <div class="admin-form-group full">
                            <label>اسم المنتج *</label>
                            <div class="admin-input-wrap"><i class="fas fa-box"></i><input type="text" id="prdName" value="${esc(currentProduct.name || '')}" required></div>
                        </div>
                        <div class="admin-form-group">
                            <label>الفئة *</label>
                            <select id="prdCategory" required>${buildCategoryOptions(currentProduct)}</select>
                        </div>
                        <div class="admin-form-group">
                            <label>العلامة التجارية</label>
                            <div class="admin-input-wrap"><i class="fas fa-tag"></i><input type="text" id="prdBrand" value="${esc(currentProduct.brand || '')}"></div>
                        </div>
                        <div class="admin-form-group">
                            <label>السعر *</label>
                            <div class="admin-input-wrap"><i class="fas fa-money-bill"></i><input type="number" id="prdPrice" value="${esc(currentProduct.price || '')}" min="0" step="0.01" required></div>
                        </div>
                        <div class="admin-form-group">
                            <label>سعر الخصم</label>
                            <div class="admin-input-wrap"><i class="fas fa-percent"></i><input type="number" id="prdDiscount" value="${esc(currentProduct.discountPrice || currentProduct.discount_price || '')}" min="0" step="0.01"></div>
                        </div>
                        <div class="admin-form-group">
                            <label>الكمية *</label>
                            <div class="admin-input-wrap"><i class="fas fa-cubes"></i><input type="number" id="prdQty" value="${esc(currentProduct.quantity || 0)}" min="0"></div>
                        </div>
                        <div class="admin-form-group">
                            <label>حد تنبيه المخزون</label>
                            <div class="admin-input-wrap"><i class="fas fa-bell"></i><input type="number" id="prdLowStock" value="${esc(currentProduct.low_stock_alert || currentProduct.lowStockAlert || 5)}" min="0"></div>
                        </div>
                        <div class="admin-form-group">
                            <label>الحالة</label>
                            <select id="prdStatus">
                                <option value="active"${currentProduct.status === 'draft' ? '' : ' selected'}>نشط</option>
                                <option value="draft"${currentProduct.status === 'draft' ? ' selected' : ''}>مسودة</option>
                            </select>
                        </div>
                        <div class="admin-form-group">
                            <label>رمز المنتج (SKU)</label>
                            <div class="admin-input-wrap"><i class="fas fa-barcode"></i><input type="text" id="prdSku" value="${esc(currentProduct.sku || '')}"></div>
                        </div>
                        <div class="admin-form-group">
                            <label>الرابط المختصر (Slug)</label>
                            <div class="admin-input-wrap"><i class="fas fa-link"></i><input type="text" id="prdSlug" value="${esc(currentProduct.slug || '')}" placeholder="يُولَّد تلقائياً من الاسم"></div>
                        </div>
                        <div class="admin-form-group">
                            <label>أيقونة (اختياري)</label>
                            <div class="admin-input-wrap"><i class="fas fa-icons"></i><input type="text" id="prdIcon" value="${esc(currentProduct.icon || '')}" placeholder="مثل: fa-laptop"></div>
                        </div>
                        <div class="admin-form-group">
                            <label>منتج مميّز</label>
                            <label class="admin-checkbox-row" style="display:flex;align-items:center;gap:8px;cursor:pointer;">
                                <input type="checkbox" id="prdFeatured"${currentProduct.isFeatured || currentProduct.is_featured ? ' checked' : ''}>
                                <span>عرض ضمن المنتجات المميّزة</span>
                            </label>
                        </div>
                        <div class="admin-form-group full">
                            <label>الوصف</label>
                            <textarea id="prdDesc" rows="4">${esc(currentProduct.description || '')}</textarea>
                        </div>
                        <div class="admin-form-group full">
                            <label>صورة المنتج (JPEG, PNG, WebP — حد أقصى 4MB)</label>
                            <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
                                <div id="prdImagePreview" style="width:80px;height:80px;border-radius:10px;border:2px dashed rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;overflow:hidden;background:rgba(0,0,0,0.15);flex-shrink:0;">
                                    ${existingImageUrl ? '<img src="' + esc(existingImageUrl) + '" style="width:100%;height:100%;object-fit:cover;border-radius:8px;" alt="صورة المنتج">' : '<i class="fas fa-image" style="font-size:1.5rem;opacity:0.3;"></i>'}
                                </div>
                                <div style="flex:1;min-width:0;">
                                    <input type="file" id="prdImageFile" accept="image/jpeg,image/png,image/webp" style="width:100%;">
                                    <small style="color:var(--text-muted);display:block;margin-top:4px;">اختر صورة جديدة لاستبدال الحالية أو اتركه فارغاً للإبقاء على الصورة الحالية.</small>
                                </div>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
            <div class="admin-slideover-footer">
                <button class="btn btn-primary" id="saveProductBtn"><i class="fas fa-save"></i> ${isEdit ? 'تحديث' : 'إضافة'}</button>
                <button class="btn btn-outline" id="cancelProductBtn">إلغاء</button>
            </div>
        `;

        document.body.appendChild(backdrop);
        document.body.appendChild(panel);
        renderProductImagePreview(panel.querySelector('#prdImagePreview'), existingImageUrl, 'Product image');

        function handleClose() {
            closeProductForm(backdrop, panel);
        }

        backdrop.addEventListener('click', handleClose);
        panel.querySelector('#closeProductForm').addEventListener('click', handleClose);
        panel.querySelector('#cancelProductBtn').addEventListener('click', handleClose);

        panel.querySelector('#prdImageFile')?.addEventListener('change', function () {
            var file = this.files && this.files[0];
            var preview = panel.querySelector('#prdImagePreview');
            if (!file) {
                pendingImageFile = null;
                renderProductImagePreview(preview, existingImageUrl, 'Product image');
                preview = null;
            }
            if (!ALLOWED_IMAGE_TYPES.includes(file.type.toLowerCase())) {
                A.showErrorToast('PRM-110', 'نوع الملف غير مدعوم.');
                this.value = '';
                renderProductImagePreview(preview, existingImageUrl, 'Product image');
                return;
            }
            if (file.size > MAX_IMAGE_SIZE_BYTES) {
                A.showErrorToast('PRM-111', 'حجم الصورة يتجاوز 4MB.');
                this.value = '';
                renderProductImagePreview(preview, existingImageUrl, 'Product image');
                return;
            }
            pendingImageFile = file;
            var reader = new FileReader();
            reader.onload = function (e) {
                renderProductImagePreview(preview, e.target?.result, 'Product preview');
                return;
                if (preview) preview.innerHTML = '<img src="' + e.target.result + '" style="width:100%;height:100%;object-fit:cover;border-radius:8px;" alt="معاينة">';
            };
            reader.readAsDataURL(file);
        });
        panel.querySelector('#saveProductBtn').addEventListener('click', async function () {
            var button = this;
            var name = panel.querySelector('#prdName').value.trim();
            var categoryId = panel.querySelector('#prdCategory').value;
            var price = panel.querySelector('#prdPrice').value;

            if (!name || !categoryId || !price) {
                A.showErrorToast('PRM-103', 'أكمل الحقول المطلوبة');
                return;
            }

            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';

            var success = await saveProduct({
                id: isEdit ? currentProduct.id : null,
                name: name,
                categoryId: categoryId,
                brand: panel.querySelector('#prdBrand').value.trim(),
                price: price,
                discountPrice: panel.querySelector('#prdDiscount').value,
                quantity: panel.querySelector('#prdQty').value,
                lowStockAlert: panel.querySelector('#prdLowStock').value,
                status: panel.querySelector('#prdStatus').value,
                description: panel.querySelector('#prdDesc').value.trim(),
                sku: panel.querySelector('#prdSku').value.trim(),
                slug: panel.querySelector('#prdSlug').value.trim(),
                icon: panel.querySelector('#prdIcon').value.trim(),
                isFeatured: panel.querySelector('#prdFeatured').checked,
            });

            if (!success) {
                button.disabled = false;
                button.innerHTML = '<i class="fas fa-save"></i> ' + (isEdit ? 'تحديث' : 'إضافة');
                return;
            }

            handleClose();
            await TZ.refreshData();
            renderProducts();
        });
    }

    function buildProductsTableRows(products) {
        if (products.length === 0) {
            return '<tr><td colspan="7"><div class="empty-state"><i class="fas fa-box-open"></i><p>لا توجد منتجات مطابقة</p></div></td></tr>';
        }

        return products.map(function (product) {
            var categoryName = getCategoryName(product.categoryId || product.category_id);
            var lowStockLimit = product.low_stock_alert || product.lowStockAlert || 5;
            var stockColor = product.quantity <= 0 ? '#e74c3c' : product.quantity <= lowStockLimit ? '#fdcb6e' : '#00b894';
            var statusLabel = product.status === 'active' ? 'نشط' : product.status === 'draft' ? 'مسودة' : product.status;

            var thumbUrl = (product.images && product.images.length > 0) ? product.images[0] : '';
            return `
                <tr>
                    <td style="display:flex;align-items:center;gap:10px;">
                        <div style="width:40px;height:40px;border-radius:8px;overflow:hidden;background:rgba(0,0,0,0.1);flex-shrink:0;display:flex;align-items:center;justify-content:center;">
                            ${thumbUrl ? '<img src="' + esc(thumbUrl) + '" style="width:100%;height:100%;object-fit:cover;" alt="" loading="lazy">' : '<i class="fas fa-image" style="opacity:0.25;"></i>'}
                        </div>
                        <div><strong>${esc(product.name)}</strong>${product.brand ? '<br><small style="color:var(--text-muted);">' + esc(product.brand) + '</small>' : ''}</div>
                    </td>
                    <td><small>${esc(categoryName)}</small></td>
                    <td style="font-weight:600;">${TZ.formatPrice(product.price)}${product.discount_price || product.discountPrice ? '<br><small style="color:#00b894;">' + TZ.formatPrice(product.discount_price || product.discountPrice) + '</small>' : ''}</td>
                    <td style="color:${stockColor};font-weight:600;">${product.quantity}</td>
                    <td>${product.sold || 0}</td>
                    <td><span class="status-badge ${esc(product.status || '')}">${esc(statusLabel)}</span></td>
                    <td class="actions-cell">
                        <button class="action-btn edit-product-btn" data-id="${esc(product.id)}" title="تعديل"><i class="fas fa-edit"></i></button>
                        <button class="action-btn toggle-product-btn" data-id="${esc(product.id)}" data-status="${esc(product.status || '')}" title="تغيير الحالة"><i class="fas fa-eye${product.status === 'active' ? '-slash' : ''}"></i></button>
                        <button class="action-btn danger delete-product-btn" data-id="${esc(product.id)}" title="حذف"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function renderProducts() {
        var allProducts = getProducts();
        var filteredProducts = applyFilters(allProducts).sort(function (first, second) {
            return new Date(second.createdAt || second.created_at || 0) - new Date(first.createdAt || first.created_at || 0);
        });
        var page = paginate(filteredProducts);
        var categoryOptions = ['<option value="">كل الفئات</option>'];

        getSubcategories().forEach(function (category) {
            var selected = filterCategory === category.id ? ' selected' : '';
            categoryOptions.push('<option value="' + category.id + '"' + selected + '>' + esc(category.name) + '</option>');
        });

        A.adminContent.innerHTML = `
            <div class="admin-section-header">
                <div>
                    <h2><i class="fas fa-box-open"></i> إدارة المنتجات</h2>
                    <p>إجمالي ${allProducts.length} منتج</p>
                </div>
                <div class="admin-section-actions">
                    <button class="btn btn-primary btn-sm" id="addProductBtn"><i class="fas fa-plus"></i> إضافة منتج</button>
                </div>
            </div>
            <div class="filter-bar">
                <input type="search" id="productsSearch" placeholder="ابحث بالاسم أو العلامة التجارية..." value="${esc(searchQuery)}">
                <select id="productsCatFilter">${categoryOptions.join('')}</select>
                <select id="productsStatusFilter">
                    <option value="">كل الحالات</option>
                    <option value="active"${filterStatus === 'active' ? ' selected' : ''}>نشط</option>
                    <option value="draft"${filterStatus === 'draft' ? ' selected' : ''}>مسودة</option>
                    <option value="out_of_stock"${filterStatus === 'out_of_stock' ? ' selected' : ''}>نفد المخزون</option>
                </select>
            </div>
            <div class="admin-panel">
                <div class="panel-body">
                    <div class="table-wrap">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>المنتج</th>
                                    <th>الفئة</th>
                                    <th>السعر</th>
                                    <th>المخزون</th>
                                    <th>المبيعات</th>
                                    <th>الحالة</th>
                                    <th>إجراءات</th>
                                </tr>
                            </thead>
                            <tbody>${buildProductsTableRows(page.items)}</tbody>
                        </table>
                    </div>
                </div>
                ${page.pages > 1 ? buildPagination(page) : ''}
            </div>
        `;

        bindProductEvents();
    }

    function buildPagination(page) {
        var buttons = [];
        buttons.push('<button data-page="' + (currentPage - 1) + '"' + (currentPage <= 1 ? ' disabled' : '') + '><i class="fas fa-chevron-right"></i></button>');

        for (var index = 1; index <= page.pages; index += 1) {
            buttons.push('<button data-page="' + index + '" class="' + (index === currentPage ? 'active' : '') + '">' + index + '</button>');
        }

        buttons.push('<button data-page="' + (currentPage + 1) + '"' + (currentPage >= page.pages ? ' disabled' : '') + '><i class="fas fa-chevron-left"></i></button>');

        return `
            <div class="admin-table-pagination">
                <div class="admin-table-pagination-info">عرض ${page.items.length} من ${page.total}</div>
                <div class="admin-table-pagination-controls">${buttons.join('')}</div>
            </div>
        `;
    }

    function bindProductEvents() {
        A.adminContent.querySelector('#addProductBtn')?.addEventListener('click', function () {
            openProductForm(null);
        });

        A.adminContent.querySelector('#productsSearch')?.addEventListener('input', function () {
            searchQuery = this.value;
            currentPage = 1;
            renderProducts();
        });

        A.adminContent.querySelector('#productsCatFilter')?.addEventListener('change', function () {
            filterCategory = this.value;
            currentPage = 1;
            renderProducts();
        });

        A.adminContent.querySelector('#productsStatusFilter')?.addEventListener('change', function () {
            filterStatus = this.value;
            currentPage = 1;
            renderProducts();
        });

        A.adminContent.querySelectorAll('[data-page]').forEach(function (button) {
            button.addEventListener('click', function () {
                var targetPage = Number(button.dataset.page);
                if (Number.isFinite(targetPage) && targetPage >= 1) {
                    currentPage = targetPage;
                    renderProducts();
                }
            });
        });

        A.adminContent.querySelectorAll('.edit-product-btn').forEach(function (button) {
            button.addEventListener('click', function () {
                var product = getProducts().find(function (item) {
                    return item.id === button.dataset.id;
                });

                if (product) openProductForm(product);
            });
        });

        A.adminContent.querySelectorAll('.toggle-product-btn').forEach(function (button) {
            button.addEventListener('click', function () {
                toggleStatus(button.dataset.id, button.dataset.status);
            });
        });

        A.adminContent.querySelectorAll('.delete-product-btn').forEach(function (button) {
            button.addEventListener('click', function () {
                deleteProduct(button.dataset.id);
            });
        });
    }

    A.sections.products = renderProducts;
})();
