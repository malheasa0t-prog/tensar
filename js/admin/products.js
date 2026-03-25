// ===== TechZone Admin - Products =====
(function () {
    'use strict';

    const A = window.AdminApp;
    const accessoryCatalog = A.accessoryCatalog || TZ.accessoryCatalog || {};

    function isAccessoryCatalogCategoryId(categoryId) {
        return typeof accessoryCatalog.isAccessoryCatalogCategoryId === 'function'
            ? accessoryCatalog.isAccessoryCatalogCategoryId(categoryId)
            : false;
    }

    function isAccessoryProduct(product) {
        return typeof TZ.isAccessoryProduct === 'function'
            ? TZ.isAccessoryProduct(product)
            : product?.productType === 'accessory';
    }

    function getMainCategories() {
        return TZ.db.categories
            .filter((category) => !category.parentId && !isAccessoryCatalogCategoryId(category.id))
            .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    }

    function getSubCategories(mainCategoryId = '') {
        return TZ.db.categories
            .filter((category) => !!category.parentId && !isAccessoryCatalogCategoryId(category.id) && (!mainCategoryId || category.parentId === mainCategoryId))
            .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    }

    function categoryLabel(categoryId) {
        const sub = TZ.db.categories.find((category) => category.id === categoryId);
        if (!sub) return '—';
        const main = sub.parentId ? TZ.db.categories.find((category) => category.id === sub.parentId) : null;
        return main ? `${main.name} / ${sub.name}` : sub.name;
    }

    function switchAdminSection(section) {
        A.currentSection = section;
        document.querySelectorAll('.sidebar-link').forEach((link) => {
            link.classList.toggle('active', link.dataset.section === section);
        });
        A.renderSection(section);
    }

    function buildSubCategoryOptions(subCategories) {
        return subCategories
            .map((category) => {
                const parent = TZ.db.categories.find((item) => item.id === category.parentId);
                const label = parent ? `${TZ.escapeHtml(parent.name)} / ${TZ.escapeHtml(category.name)}` : TZ.escapeHtml(category.name);
                return `<option value="${category.id}">${label}</option>`;
            })
            .join('');
    }

    function renderProducts() {
        const products = TZ.clone(TZ.db.products).filter((product) => !isAccessoryProduct(product));
        const mainCategories = getMainCategories();
        const subCategories = getSubCategories();

        const mainCategoryOptions = mainCategories
            .map((category) => `<option value="${category.id}">${TZ.escapeHtml(category.name)}</option>`)
            .join('');

        const subCategoryOptions = buildSubCategoryOptions(subCategories);

        A.adminContent.innerHTML = `
            <div class="admin-panel" style="margin-bottom:18px;">
                <div class="panel-header">
                    <h2><i class="fas fa-diagram-project"></i> ترتيب الإضافة السريع</h2>
                </div>
                <div class="panel-body">
                    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;">
                        <div style="background:var(--bg-lighter);border:1px solid var(--border-color);border-radius:14px;padding:16px;display:grid;gap:10px;">
                            <div style="font-size:.85rem;color:var(--text-muted);">الخطوة 1</div>
                            <strong>أضف فئة رئيسية</strong>
                            <div style="font-size:.9rem;color:var(--text-muted);">ابدأ بالقسم الأعلى مثل: اكسسوارات، صيانة، بطاقات ألعاب.</div>
                            <div style="font-size:1.2rem;font-weight:800;">${mainCategories.length}</div>
                            <button type="button" class="btn btn-outline btn-sm quick-add-main-btn">إضافة فئة رئيسية</button>
                        </div>
                        <div style="background:var(--bg-lighter);border:1px solid var(--border-color);border-radius:14px;padding:16px;display:grid;gap:10px;">
                            <div style="font-size:.85rem;color:var(--text-muted);">الخطوة 2</div>
                            <strong>أضف فئة فرعية</strong>
                            <div style="font-size:.9rem;color:var(--text-muted);">بعد اختيار القسم الرئيسي، أنشئ الفئة الفرعية التي سيُنسب إليها المنتج.</div>
                            <div style="font-size:1.2rem;font-weight:800;">${subCategories.length}</div>
                            <button type="button" class="btn btn-outline btn-sm quick-add-sub-btn">إضافة فئة فرعية</button>
                        </div>
                        <div style="background:var(--bg-lighter);border:1px solid var(--border-color);border-radius:14px;padding:16px;display:grid;gap:10px;">
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

            ${mainCategories.length === 0 ? `
                <div class="admin-panel" style="margin-bottom:12px;">
                    <div class="panel-body">
                        <div style="color:var(--warning,#f39c12);font-weight:700;">يجب إضافة فئة رئيسية أولاً قبل إضافة الفئات الفرعية أو المنتجات.</div>
                    </div>
                </div>
            ` : ''}

            ${mainCategories.length > 0 && subCategories.length === 0 ? `
                <div class="admin-panel" style="margin-bottom:12px;">
                    <div class="panel-body">
                        <div style="color:var(--warning,#f39c12);font-weight:700;">أضف فئة فرعية واحدة على الأقل داخل الفئات قبل إنشاء المنتجات.</div>
                    </div>
                </div>
            ` : ''}

            <div class="admin-panel">
                <div class="panel-header"><h2><i class="fas fa-box"></i> المنتجات (${products.length})</h2></div>
                <div class="panel-body">
                    <div class="table-wrap">
                        <table class="data-table">
                            <thead>
                                <tr>
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
                            <tbody id="productsTableBody">
                                ${products.map((product) => `
                                    <tr data-product-id="${product.id}">
                                        <td><strong>${TZ.escapeHtml(product.name)}</strong></td>
                                        <td>${TZ.escapeHtml(categoryLabel(product.categoryId))}</td>
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
                                `).join('')}
                            </tbody>
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
                            <div class="admin-form-group">
                                <label>نوع المنتج *</label>
                                <select id="pProductType" required>
                                    <option value="physical">منتج ملموس (فيزيائي)</option>
                                    <option value="digital">منتج رقمي</option>
                                </select>
                            </div>
                            <div class="admin-form-group">
                                <label>اسم المنتج *</label>
                                <div class="admin-input-wrap"><i class="fas fa-box"></i><input type="text" id="pName" required></div>
                            </div>
                            <div class="admin-form-group">
                                <label>الفئة الرئيسية *</label>
                                <select id="pMainCategory" required>
                                    <option value="">اختر الفئة الرئيسية</option>
                                    ${mainCategoryOptions}
                                </select>
                            </div>
                            <div class="admin-form-group">
                                <label>الفئة الفرعية *</label>
                                <select id="pCategory" required disabled>
                                    <option value="">اختر الفئة الفرعية</option>
                                </select>
                            </div>
                            <div class="admin-form-group">
                                <label>الماركة</label>
                                <div class="admin-input-wrap"><i class="fas fa-tag"></i><input type="text" id="pBrand"></div>
                            </div>
                            <div class="admin-form-group">
                                <label>السعر *</label>
                                <div class="admin-input-wrap"><i class="fas fa-money-bill"></i><input type="number" id="pPrice" min="0" step="0.01" required></div>
                            </div>
                            <div class="admin-form-group">
                                <label>سعر الخصم</label>
                                <div class="admin-input-wrap"><i class="fas fa-percent"></i><input type="number" id="pDiscount" min="0" step="0.01"></div>
                            </div>
                            <div class="admin-form-group">
                                <label>الكمية *</label>
                                <div class="admin-input-wrap"><i class="fas fa-cubes"></i><input type="number" id="pQuantity" min="0" required></div>
                            </div>
                            <div class="admin-form-group">
                                <label>تنبيه المخزون المنخفض</label>
                                <div class="admin-input-wrap"><i class="fas fa-exclamation-triangle"></i><input type="number" id="pLowStock" min="0" value="5"></div>
                            </div>
                            <div class="admin-form-group full">
                                <label>الوصف</label>
                                <textarea id="pDescription" rows="3"></textarea>
                            </div>
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
                            <p>اضغط أو اسحب الصور هنا (حد أقصى 1MB لكل صورة)</p>
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

        bindProductEvents();
    }

    function bindProductEvents() {
        const search = document.getElementById('productSearch');
        const mainFilter = document.getElementById('productMainFilter');
        const catFilter = document.getElementById('productCatFilter');
        const productFormPanel = document.getElementById('productFormPanel');
        const form = document.getElementById('productForm');
        const mainCategoryInput = document.getElementById('pMainCategory');
        const subCategoryInput = document.getElementById('pCategory');
        const formTitle = document.getElementById('productFormTitle');

        function updateSubCategoryFilter() {
            const filteredSubCategories = getSubCategories(mainFilter.value);
            const currentValue = catFilter.value;
            catFilter.innerHTML = `<option value="">كل الفئات الفرعية</option>${buildSubCategoryOptions(filteredSubCategories)}`;
            if (currentValue && filteredSubCategories.some((category) => category.id === currentValue)) {
                catFilter.value = currentValue;
            }
        }

        function filterProducts() {
            const query = search.value.toLowerCase();
            const mainCategoryId = mainFilter.value;
            const subCategoryId = catFilter.value;

            document.querySelectorAll('#productsTableBody tr').forEach((row) => {
                const product = TZ.getProductById(row.dataset.productId);
                if (!product) return;
                const selectedSubCategory = TZ.db.categories.find((category) => category.id === product.categoryId);
                const matchesQuery = !query || product.name.toLowerCase().includes(query);
                const matchesMain = !mainCategoryId || selectedSubCategory?.parentId === mainCategoryId;
                const matchesSub = !subCategoryId || product.categoryId === subCategoryId;
                row.style.display = matchesQuery && matchesMain && matchesSub ? '' : 'none';
            });
        }

        function setSubCategoryOptions(mainCategoryId, selectedSubCategoryId = '') {
            const filteredSubCategories = getSubCategories(mainCategoryId);
            subCategoryInput.innerHTML = `<option value="">اختر الفئة الفرعية</option>${buildSubCategoryOptions(filteredSubCategories)}`;
            subCategoryInput.disabled = !mainCategoryId || filteredSubCategories.length === 0;
            if (selectedSubCategoryId && filteredSubCategories.some((category) => category.id === selectedSubCategoryId)) {
                subCategoryInput.value = selectedSubCategoryId;
                return;
            }
            subCategoryInput.value = '';
        }

        function openProductForm(product) {
            const defaultMainCategoryId = product
                ? (TZ.db.categories.find((category) => category.id === product.categoryId)?.parentId || '')
                : (getMainCategories()[0]?.id || '');

            A.editingProductId = product?.id || null;
            A.productImages = TZ.clone(product?.images || []);
            form.reset();
            document.getElementById('specsRows').innerHTML = '';
            document.getElementById('imagePreviews').innerHTML = '';
            document.getElementById('pLowStock').value = '5';
            document.getElementById('pProductType').value = product?.productType && product.productType !== 'accessory' ? product.productType : 'physical';
            
            mainCategoryInput.value = defaultMainCategoryId;
            setSubCategoryOptions(defaultMainCategoryId, product?.categoryId || '');

            if (product) {
                formTitle.innerHTML = '<i class="fas fa-edit"></i> تعديل المنتج';
                document.getElementById('pName').value = product.name || '';
                document.getElementById('pBrand').value = product.brand || '';
                document.getElementById('pPrice').value = product.price || 0;
                document.getElementById('pDiscount').value = product.discountPrice || '';
                document.getElementById('pQuantity').value = product.quantity || 0;
                document.getElementById('pLowStock').value = product.lowStockAlert || 5;
                document.getElementById('pDescription').value = product.description || '';
                (product.specs || []).forEach((spec) => addSpecRow(spec.key, spec.value));
                (product.variants || []).forEach((variant) => addVariantRow(variant.name, (variant.options || []).join('، ')));
                renderImagePreviews();
            } else {
                formTitle.innerHTML = '<i class="fas fa-plus"></i> إضافة منتج جديد';
            }

            productFormPanel.style.display = 'block';
            productFormPanel.scrollIntoView({ behavior: 'smooth' });
        }

        search.addEventListener('input', filterProducts);
        mainFilter.addEventListener('change', function () {
            updateSubCategoryFilter();
            filterProducts();
        });
        catFilter.addEventListener('change', filterProducts);
        updateSubCategoryFilter();

        document.querySelector('.quick-add-main-btn')?.addEventListener('click', function () {
            switchAdminSection('main-categories');
            setTimeout(() => document.getElementById('addMainCategoryBtn')?.click(), 0);
        });

        document.querySelector('.quick-add-sub-btn')?.addEventListener('click', function () {
            if (getMainCategories().length === 0) {
                A.showToast('أضف فئة رئيسية أولاً ثم أضف الفئة الفرعية.');
                switchAdminSection('main-categories');
                return;
            }
            switchAdminSection('subcategories');
            setTimeout(() => document.getElementById('addSubCategoryBtn')?.click(), 0);
        });

        document.querySelectorAll('.open-categories-btn').forEach((button) => {
            button.addEventListener('click', function () {
                switchAdminSection('main-categories');
            });
        });

        document.getElementById('addProductBtn').addEventListener('click', function () {
            if (getMainCategories().length === 0) {
                A.showToast('أضف فئة رئيسية أولاً قبل إضافة المنتج.');
                switchAdminSection('subcategories');
                return;
            }
            if (getSubCategories().length === 0) {
                A.showToast('أضف فئة فرعية أولاً قبل إضافة المنتج.');
                switchAdminSection('categories');
                return;
            }
            openProductForm(null);
        });

        document.getElementById('cancelProductBtn').addEventListener('click', function () {
            productFormPanel.style.display = 'none';
        });

        mainCategoryInput.addEventListener('change', function () {
            setSubCategoryOptions(this.value);
        });

        document.querySelectorAll('.edit-product-btn').forEach((button) => {
            button.addEventListener('click', function () {
                const product = TZ.getProductById(this.dataset.id);
                if (!product) return;
                openProductForm(product);
            });
        });

        document.querySelectorAll('.toggle-product-btn').forEach((button) => {
            button.addEventListener('click', function () {
                const product = TZ.db.products.find((item) => item.id === this.dataset.id);
                if (!product) return;
                product.status = product.status === 'active' ? 'hidden' : 'active';
                TZ.commitDb('product_toggle', TZ.getSession()?.userId, `${product.name}: ${product.status}`, { type: 'product', data: product });
                renderProducts();
                A.showToast('تم تحديث حالة المنتج.');
            });
        });

        document.querySelectorAll('.delete-product-btn').forEach((button) => {
            button.addEventListener('click', function () {
                const id = this.dataset.id;
                const product = TZ.getProductById(id);
                if (!product) return;
                A.showConfirmModal('حذف المنتج', `هل أنت متأكد من حذف المنتج "${TZ.escapeHtml(product.name)}"؟`, () => {
                    const backup = TZ.clone(product);
                    TZ.db.products = TZ.db.products.filter((item) => item.id !== id);
                    renderProducts();
                    A.showUndoToast('تم حذف المنتج.', () => {
                        TZ.db.products.push(backup);
                        renderProducts();
                        A.showToast('تمت استعادة المنتج.');
                    }, () => {
                        TZ.commitDb('product_delete', TZ.getSession()?.userId, product.name, { type: 'product_delete', data: { id: product.id } });
                    });
                });
            });
        });

        document.getElementById('addSpecBtn').addEventListener('click', () => addSpecRow('', ''));
        document.getElementById('addVariantBtn').addEventListener('click', () => addVariantRow('', ''));

        const uploadArea = document.getElementById('imageUploadArea');
        const imageInput = document.getElementById('imageInput');
        uploadArea.addEventListener('click', () => imageInput.click());
        imageInput.addEventListener('change', function () {
            Array.from(this.files || []).forEach((file) => {
                if (file.size > 1048576) {
                    A.showToast('حجم الصورة يتجاوز 1MB.');
                    return;
                }
                const reader = new FileReader();
                reader.onload = function (event) {
                    A.productImages.push(event.target.result);
                    renderImagePreviews();
                };
                reader.readAsDataURL(file);
            });
        });

        form.addEventListener('submit', function (event) {
            event.preventDefault();

            const data = {
                name: document.getElementById('pName').value.trim(),
                productType: document.getElementById('pProductType').value,
                categoryId: subCategoryInput.value,
                brand: document.getElementById('pBrand').value.trim(),
                price: parseFloat(document.getElementById('pPrice').value) || 0,
                discountPrice: parseFloat(document.getElementById('pDiscount').value) || 0,
                quantity: parseInt(document.getElementById('pQuantity').value, 10) || 0,
                lowStockAlert: parseInt(document.getElementById('pLowStock').value, 10) || 5,
                description: document.getElementById('pDescription').value.trim(),
                specs: getSpecRows(),
                variants: getVariantRows(),
                images: A.productImages,
                updatedAt: TZ.nowIso()
            };

            if (!data.name) {
                A.showToast('يرجى إدخال اسم المنتج.');
                return;
            }
            if (data.name.length > 100) {
                A.showToast('اسم المنتج يجب ألا يتجاوز 100 حرف.');
                return;
            }
            if (!mainCategoryInput.value) {
                A.showToast('اختر الفئة الرئيسية أولاً.');
                return;
            }
            if (!data.categoryId) {
                A.showToast('اختر الفئة الفرعية قبل الحفظ.');
                return;
            }
            if (data.price <= 0) {
                A.showToast('السعر يجب أن يكون أكبر من صفر.');
                return;
            }
            if (data.discountPrice < 0) {
                A.showToast('سعر الخصم لا يمكن أن يكون سالبًا.');
                return;
            }
            if (data.discountPrice > 0 && data.discountPrice >= data.price) {
                A.showToast('سعر الخصم يجب أن يكون أقل من السعر الأصلي.');
                return;
            }
            if (data.quantity < 0) {
                A.showToast('الكمية لا يمكن أن تكون سالبة.');
                return;
            }

            const selectedCategory = TZ.db.categories.find((category) => category.id === data.categoryId);
            if (!selectedCategory || selectedCategory.parentId !== mainCategoryInput.value) {
                A.showToast('الفئة الفرعية المختارة لا تتبع الفئة الرئيسية المحددة.');
                return;
            }

            if (A.editingProductId) {
                const product = TZ.db.products.find((item) => item.id === A.editingProductId);
                if (!product) return;
                Object.assign(product, data);
                TZ.commitDb('product_update', TZ.getSession()?.userId, data.name, { type: 'product', data: product });
                A.showToast('تم تحديث المنتج.');
            } else {
                const newProduct = {
                    ...data,
                    id: TZ.generateId('prd-'),
                    status: data.quantity > 0 ? 'active' : 'hidden',
                    sold: 0,
                    rating: 0,
                    createdAt: TZ.nowIso()
                };
                TZ.db.products.push(newProduct);
                TZ.commitDb('product_create', TZ.getSession()?.userId, data.name, { type: 'product', data: newProduct });
                A.showToast('تمت إضافة المنتج.');
            }

            renderProducts();
        });
    }

    function addSpecRow(key, value) {
        const row = document.createElement('div');
        row.className = 'dynamic-row';
        row.innerHTML = `
            <input type="text" placeholder="المواصفة (مثل: المعالج)" value="${TZ.escapeHtml(key)}">
            <input type="text" placeholder="القيمة (مثل: Core i7)" value="${TZ.escapeHtml(value)}">
            <button type="button" class="remove-row-btn"><i class="fas fa-times"></i></button>
        `;
        row.querySelector('.remove-row-btn').addEventListener('click', () => row.remove());
        document.getElementById('specsRows').appendChild(row);
    }

    function addVariantRow(name, options) {
        const row = document.createElement('div');
        row.className = 'dynamic-row';
        row.innerHTML = `
            <input type="text" placeholder="الاسم (مثل: اللون)" value="${TZ.escapeHtml(name)}">
            <input type="text" placeholder="الخيارات مفصولة بفاصلة" value="${TZ.escapeHtml(options)}">
            <button type="button" class="remove-row-btn"><i class="fas fa-times"></i></button>
        `;
        row.querySelector('.remove-row-btn').addEventListener('click', () => row.remove());
        document.getElementById('variantsRows').appendChild(row);
    }

    function getSpecRows() {
        return Array.from(document.querySelectorAll('#specsRows .dynamic-row'))
            .map((row) => {
                const inputs = row.querySelectorAll('input');
                return { key: inputs[0].value.trim(), value: inputs[1].value.trim() };
            })
            .filter((item) => item.key && item.value);
    }

    function getVariantRows() {
        return Array.from(document.querySelectorAll('#variantsRows .dynamic-row'))
            .map((row) => {
                const inputs = row.querySelectorAll('input');
                return {
                    name: inputs[0].value.trim(),
                    options: inputs[1].value.split(/[،,]/).map((option) => option.trim()).filter(Boolean)
                };
            })
            .filter((item) => item.name && item.options.length);
    }

    function renderImagePreviews() {
        const container = document.getElementById('imagePreviews');
        if (!container) return;
        container.innerHTML = A.productImages.map((image, index) => `
            <div class="image-preview">
                <img src="${image}" alt="صورة ${index + 1}">
                <button class="remove-img" data-index="${index}"><i class="fas fa-times"></i></button>
            </div>
        `).join('');

        container.querySelectorAll('.remove-img').forEach((button) => {
            button.addEventListener('click', function () {
                A.productImages.splice(parseInt(this.dataset.index, 10), 1);
                renderImagePreviews();
            });
        });
    }

    A.sections.products = renderProducts;
})();
