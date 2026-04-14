// ===== TechZone Admin - Products Helpers =====
(function () {
    'use strict';

    function getAccessoryCatalog(A, TZ) {
        return A.accessoryCatalog || TZ.accessoryCatalog || {};
    }

    function isAccessoryCatalogCategoryId(accessoryCatalog, categoryId) {
        return typeof accessoryCatalog.isAccessoryCatalogCategoryId === 'function'
            ? accessoryCatalog.isAccessoryCatalogCategoryId(categoryId)
            : false;
    }

    function isAccessoryProduct(TZ, product) {
        return typeof TZ.isAccessoryProduct === 'function'
            ? TZ.isAccessoryProduct(product)
            : product?.productType === 'accessory';
    }

    function sortByOrder(left, right) {
        return (left.sortOrder || 0) - (right.sortOrder || 0);
    }

    function getMainCategories(TZ, accessoryCatalog) {
        return TZ.db.categories
            .filter((category) => !category.parentId && !isAccessoryCatalogCategoryId(accessoryCatalog, category.id))
            .sort(sortByOrder);
    }

    function getSubCategories(TZ, accessoryCatalog, mainCategoryId = '') {
        return TZ.db.categories
            .filter((category) => {
                if (!category.parentId) return false;
                if (isAccessoryCatalogCategoryId(accessoryCatalog, category.id)) return false;
                return !mainCategoryId || category.parentId === mainCategoryId;
            })
            .sort(sortByOrder);
    }

    function categoryLabel(TZ, categoryId) {
        const subCategory = TZ.db.categories.find((category) => category.id === categoryId);
        if (!subCategory) return '—';

        const mainCategory = subCategory.parentId
            ? TZ.db.categories.find((category) => category.id === subCategory.parentId)
            : null;

        return mainCategory ? `${mainCategory.name} / ${subCategory.name}` : subCategory.name;
    }

    function buildSubCategoryOptions(TZ, subCategories) {
        return subCategories
            .map((category) => {
                const parent = TZ.db.categories.find((item) => item.id === category.parentId);
                const label = parent
                    ? `${TZ.escapeHtml(parent.name)} / ${TZ.escapeHtml(category.name)}`
                    : TZ.escapeHtml(category.name);
                return `<option value="${category.id}">${label}</option>`;
            })
            .join('');
    }

    function buildCategoryFilterButton(TZ, categoryId) {
        const subCategory = TZ.db.categories.find((category) => category.id === categoryId);
        if (!subCategory) return '—';

        return `
            <button
                type="button"
                class="subcategory-link-btn"
                data-main-id="${subCategory.parentId || ''}"
                data-sub-id="${subCategory.id}"
                style="background:none;border:none;padding:0;color:var(--primary);font-weight:700;cursor:pointer;text-align:right;"
            >
                ${TZ.escapeHtml(categoryLabel(TZ, categoryId))}
            </button>
        `;
    }

    function buildSubCategoryQuickAccess(TZ, mainCategories, subCategories, products) {
        const countsBySubCategory = products.reduce((counts, product) => {
            if (!product.categoryId) return counts;
            counts[product.categoryId] = (counts[product.categoryId] || 0) + 1;
            return counts;
        }, {});

        const groupsMarkup = mainCategories
            .map((mainCategory) => {
                const children = subCategories.filter((category) => category.parentId === mainCategory.id);
                if (children.length === 0) return '';

                const childrenMarkup = children.map((subCategory) => `
                    <button
                        type="button"
                        class="btn btn-outline btn-sm subcategory-shortcut-btn"
                        data-main-id="${mainCategory.id}"
                        data-sub-id="${subCategory.id}"
                        style="display:inline-flex;align-items:center;gap:8px;"
                    >
                        <span>${TZ.escapeHtml(subCategory.name)}</span>
                        <span style="padding:2px 8px;border-radius:999px;background:rgba(255,255,255,0.08);font-size:0.78rem;">${countsBySubCategory[subCategory.id] || 0}</span>
                    </button>
                `).join('');

                return `
                    <div style="display:grid;gap:8px;">
                        <div style="font-size:0.82rem;color:var(--text-muted);font-weight:700;">${TZ.escapeHtml(mainCategory.name)}</div>
                        <div style="display:flex;gap:8px;flex-wrap:wrap;">${childrenMarkup}</div>
                    </div>
                `;
            })
            .filter(Boolean)
            .join('');

        if (!groupsMarkup) {
            return '';
        }

        return `
            <div class="admin-panel" style="margin-bottom:12px;">
                <div class="panel-body admin-form-stack">
                    <div class="admin-actions-row" style="justify-content:space-between;">
                        <div class="admin-form-stack" style="gap:4px;">
                            <strong>تصفح المنتجات حسب الفئة الفرعية</strong>
                            <span style="color:var(--text-muted);font-size:.9rem;">اضغط على أي فئة فرعية لتظهر منتجاتها فقط، وعند إضافة منتج جديد سيتم تهيئة النموذج عليها مباشرة.</span>
                        </div>
                        <button type="button" class="btn btn-outline btn-sm" id="clearSubCategoryFilterBtn">عرض كل المنتجات</button>
                    </div>
                    ${groupsMarkup}
                </div>
            </div>
        `;
    }

    function getProductBulkToolbarMarkup(bulkActions) {
        return bulkActions ? bulkActions.getToolbarMarkup({
            scopeKey: 'products',
            itemLabel: 'منتجات',
            actions: { status: true, delete: true, export: true }
        }) : '';
    }

    function buildProductExportRows(TZ, ids) {
        return (TZ.db.products || [])
            .filter((product) => ids.includes(product.id))
            .map((product) => ({
                name: product.name || '',
                category: categoryLabel(TZ, product.categoryId),
                brand: product.brand || '',
                price: product.price || 0,
                quantity: product.quantity || 0,
                status: product.status || 'active'
            }));
    }

    function buildProductRowsMarkup(TZ, bulkActions, products) {
        return products.map((product) => `
            <tr data-product-id="${product.id}">
                ${bulkActions ? bulkActions.getRowCheckboxMarkup('products', product.id) : ''}
                <td><img src="${product.images && product.images.length ? product.images[0] : 'https://placehold.co/100x100/1e293b/a9bww2?text=NA'}" alt="N/A" style="width:40px;height:40px;border-radius:6px;object-fit:cover;"></td>
                <td><strong>${TZ.escapeHtml(product.name)}</strong></td>
                <td>${buildCategoryFilterButton(TZ, product.categoryId)}</td>
                <td>${TZ.escapeHtml(product.brand || '-')}</td>
                <td>${product.discountPrice ? `<s style="color:var(--text-muted)">${TZ.formatPrice(product.price)}</s><br>${TZ.formatPrice(product.discountPrice)}` : TZ.formatPrice(product.price)}</td>
                <td><span class="status-badge ${product.quantity > 5 ? 'active' : product.quantity > 0 ? 'pending' : 'hidden'}">${product.quantity}</span></td>
                <td>${product.sold}</td>
                <td><span class="status-badge ${product.status}">${product.status === 'active' ? 'نشط' : 'مخفي'}</span></td>
                <td class="actions-cell">
                    <button class="action-btn edit-product-btn" data-id="${product.id}" title="تعديل"><i class="fas fa-edit"></i></button>
                    <button class="action-btn success toggle-product-btn" data-id="${product.id}" title="تبديل الحالة"><i class="fas fa-toggle-on"></i></button>
                    <button class="action-btn danger delete-product-btn" data-id="${product.id}" title="حذف"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `).join('');
    }

    function buildProductsViewMarkup(input) {
        const { A, TZ, bulkActions, products, mainCategories, subCategories } = input;
        const mainCategoryOptions = mainCategories
            .map((category) => `<option value="${category.id}">${TZ.escapeHtml(category.name)}</option>`)
            .join('');
        const subCategoryOptions = buildSubCategoryOptions(TZ, subCategories);
        const noMainCategories = mainCategories.length === 0;
        const noSubCategories = mainCategories.length > 0 && subCategories.length === 0;

        return `
            <div class="admin-panel" style="margin-bottom:18px;">
                <div class="panel-header"><h2><i class="fas fa-diagram-project"></i> ترتيب الإضافة السريع</h2></div>
                <div class="panel-body">
                    <div class="admin-quick-grid">
                        <div class="admin-insight-card">
                            <div style="font-size:.85rem;color:var(--text-muted);">الخطوة 1</div>
                            <strong>أضف فئة رئيسية</strong>
                            <div style="font-size:.9rem;color:var(--text-muted);">ابدأ بالقسم الأعلى مثل: صيانة، بطاقات ألعاب، أو أي قسم رئيسي تريد البناء تحته.</div>
                            <div style="font-size:1.2rem;font-weight:800;">${mainCategories.length}</div>
                            <button type="button" class="btn btn-outline btn-sm quick-add-main-btn">إضافة فئة رئيسية</button>
                        </div>
                        <div class="admin-insight-card">
                            <div style="font-size:.85rem;color:var(--text-muted);">الخطوة 2</div>
                            <strong>أضف فئة فرعية</strong>
                            <div style="font-size:.9rem;color:var(--text-muted);">بعد اختيار القسم الرئيسي، أنشئ الفئة الفرعية التي سيتم ربط المنتج بها.</div>
                            <div style="font-size:1.2rem;font-weight:800;">${subCategories.length}</div>
                            <button type="button" class="btn btn-outline btn-sm quick-add-sub-btn">إضافة فئة فرعية</button>
                        </div>
                        <div class="admin-insight-card">
                            <div style="font-size:.85rem;color:var(--text-muted);">الخطوة 3</div>
                            <strong>أضف المنتج</strong>
                            <div style="font-size:.9rem;color:var(--text-muted);">اختر الفئة الرئيسية ثم الفرعية ثم أكمل بيانات المنتج.</div>
                            <div style="font-size:1.2rem;font-weight:800;">${products.length}</div>
                            <button type="button" class="btn btn-primary btn-sm" id="addProductBtn">إضافة منتج</button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="filter-bar">
                <input type="text" id="productSearch" placeholder="بحث باسم المنتج..." style="flex:1;min-width:200px;">
                <select id="productMainFilter">
                    <option value="">كل الفئات الرئيسية</option>
                    ${mainCategoryOptions}
                </select>
                <select id="productCatFilter">
                    <option value="">كل الفئات الفرعية</option>
                    ${subCategoryOptions}
                </select>
            </div>

            ${buildSubCategoryQuickAccess(TZ, mainCategories, subCategories, products)}
            ${noMainCategories ? '<div class="admin-panel" style="margin-bottom:12px;"><div class="panel-body"><div style="color:var(--warning,#f39c12);font-weight:700;">يجب إضافة فئة رئيسية أولًا قبل إضافة الفئات الفرعية أو المنتجات.</div></div></div>' : ''}
            ${noSubCategories ? '<div class="admin-panel" style="margin-bottom:12px;"><div class="panel-body"><div style="color:var(--warning,#f39c12);font-weight:700;">أضف فئة فرعية واحدة على الأقل داخل الفئات قبل إنشاء المنتجات.</div></div></div>' : ''}

            <div class="admin-panel">
                <div class="panel-header"><h2><i class="fas fa-box"></i> المنتجات (${products.length})</h2></div>
                <div class="panel-body">
                    ${getProductBulkToolbarMarkup(bulkActions)}
                    <div class="table-wrap">
                        <table class="data-table" id="productsTable" data-paginated="true" data-item-label="منتج" data-page-size-options="10,25,50">
                            <thead>
                                <tr>
                                    ${bulkActions ? bulkActions.getHeaderCheckboxMarkup('products') : ''}
                                    <th style="width:50px;">الصورة</th>
                                    <th>المنتج</th>
                                    <th>الفئة</th>
                                    <th>الماركة</th>
                                    <th>السعر</th>
                                    <th>المخزون</th>
                                    <th>المبيعات</th>
                                    <th>الحالة</th>
                                    <th>إجراءات</th>
                                </tr>
                            </thead>
                            <tbody id="productsTableBody">${buildProductRowsMarkup(TZ, bulkActions, products)}</tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div class="admin-panel" id="productFormPanel" style="display:none;">
                <div class="panel-header"><h2 id="productFormTitle"><i class="fas fa-plus"></i> إضافة منتج جديد</h2></div>
                <div class="panel-body padded">
                    <div style="margin-bottom:18px;padding:14px;border:1px solid var(--border-color);border-radius:12px;background:var(--bg-lighter);display:grid;gap:8px;">
                        <strong>تسلسل الإضافة</strong>
                        <div style="color:var(--text-muted);font-size:.92rem;">1) اختر الفئة الرئيسية، 2) اختر الفئة الفرعية التابعة لها، 3) أكمل بيانات المنتج واحفظ.</div>
                        <div style="display:flex;gap:10px;flex-wrap:wrap;">
                            <button type="button" class="btn btn-outline btn-sm open-categories-btn">إدارة الفئات</button>
                        </div>
                    </div>
                    <form class="admin-form" id="productForm">
                        <div class="form-grid">
                            <div class="admin-form-group"><label>نوع المنتج *</label><select id="pProductType" required><option value="physical">منتج ملموس (فيزيائي)</option><option value="digital">منتج رقمي</option></select></div>
                            <div class="admin-form-group"><label>اسم المنتج *</label><div class="admin-input-wrap"><i class="fas fa-box"></i><input type="text" id="pName" required></div></div>
                            <div class="admin-form-group"><label>الفئة الرئيسية *</label><select id="pMainCategory" required><option value="">اختر الفئة الرئيسية</option>${mainCategoryOptions}</select></div>
                            <div class="admin-form-group"><label>الفئة الفرعية *</label><select id="pCategory" required disabled><option value="">اختر الفئة الفرعية</option></select></div>
                            <div class="admin-form-group"><label>الماركة</label><div class="admin-input-wrap"><i class="fas fa-tag"></i><input type="text" id="pBrand"></div></div>
                            <div class="admin-form-group"><label>السعر *</label><div class="admin-input-wrap"><i class="fas fa-money-bill"></i><input type="number" id="pPrice" min="0" step="0.01" required></div></div>
                            <div class="admin-form-group"><label>سعر الخصم</label><div class="admin-input-wrap"><i class="fas fa-percent"></i><input type="number" id="pDiscount" min="0" step="0.01"></div></div>
                            <div class="admin-form-group"><label>الكمية *</label><div class="admin-input-wrap"><i class="fas fa-cubes"></i><input type="number" id="pQuantity" min="0" required></div></div>
                            <div class="admin-form-group"><label>تنبيه المخزون المنخفض</label><div class="admin-input-wrap"><i class="fas fa-exclamation-triangle"></i><input type="number" id="pLowStock" min="0" value="5"></div></div>
                            <div class="admin-form-group full"><label>الوصف</label><textarea id="pDescription" rows="3"></textarea></div>
                        </div>
                        <h3 style="margin:20px 0 10px;font-size:0.95rem;">المواصفات</h3>
                        <div class="dynamic-rows" id="specsRows"></div>
                        <button type="button" class="add-row-btn" id="addSpecBtn"><i class="fas fa-plus"></i> إضافة مواصفة</button>
                        <h3 style="margin:20px 0 10px;font-size:0.95rem;">المتغيرات (ألوان، أحجام...)</h3>
                        <div class="dynamic-rows" id="variantsRows"></div>
                        <button type="button" class="add-row-btn" id="addVariantBtn"><i class="fas fa-plus"></i> إضافة متغير</button>
                        <h3 style="margin:20px 0 10px;font-size:0.95rem;">الصور</h3>
                        <div class="image-upload-area" id="imageUploadArea">
                            <i class="fas fa-cloud-upload-alt"></i>
                            <p>اضغط أو اسحب الصور هنا (حد أقصى ${A.getAdminImageUploadLimitText()} لكل صورة)</p>
                            <input type="file" id="imageInput" accept="image/*" multiple style="display:none;">
                        </div>
                        <div class="image-previews" id="imagePreviews"></div>
                        <div style="margin-top:25px;display:flex;gap:10px;">
                            <button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> حفظ المنتج</button>
                            <button type="button" class="btn btn-outline" id="cancelProductBtn">إلغاء</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    }

    window.AdminProductsHelpers = {
        buildProductExportRows,
        buildProductsViewMarkup,
        buildSubCategoryOptions,
        categoryLabel,
        getAccessoryCatalog,
        getMainCategories,
        getSubCategories,
        isAccessoryProduct
    };
})();
