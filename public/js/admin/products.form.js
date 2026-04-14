// ===== TechZone Admin - Products Form =====
(function () {
    'use strict';

    function addSpecRow(TZ, key, value) {
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

    function addVariantRow(TZ, name, options) {
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

    function renderImagePreviews(A) {
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
                renderImagePreviews(A);
            });
        });
    }

    function setSubCategoryOptions(TZ, helpers, accessoryCatalog, target, mainCategoryId, selectedSubCategoryId = '') {
        const filteredSubCategories = helpers.getSubCategories(TZ, accessoryCatalog, mainCategoryId);
        target.innerHTML = `<option value="">اختر الفئة الفرعية</option>${helpers.buildSubCategoryOptions(TZ, filteredSubCategories)}`;
        target.disabled = !mainCategoryId || filteredSubCategories.length === 0;
        target.value = filteredSubCategories.some((category) => category.id === selectedSubCategoryId) ? selectedSubCategoryId : '';
    }

    function buildProductPayload(TZ, A, subCategoryInput) {
        return {
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
    }

    function validateProductPayload(TZ, payload, mainCategoryId) {
        if (!payload.name) return 'يرجى إدخال اسم المنتج.';
        if (payload.name.length > 100) return 'اسم المنتج يجب ألا يتجاوز 100 حرف.';
        if (!mainCategoryId) return 'اختر الفئة الرئيسية أولًا.';
        if (!payload.categoryId) return 'اختر الفئة الفرعية قبل الحفظ.';
        if (payload.price <= 0) return 'السعر يجب أن يكون أكبر من صفر.';
        if (payload.discountPrice < 0) return 'سعر الخصم لا يمكن أن يكون سالبًا.';
        if (payload.discountPrice > 0 && payload.discountPrice >= payload.price) return 'سعر الخصم يجب أن يكون أقل من السعر الأصلي.';
        if (payload.quantity < 0) return 'الكمية لا يمكن أن تكون سالبة.';

        const selectedCategory = TZ.db.categories.find((category) => category.id === payload.categoryId);
        if (!selectedCategory || selectedCategory.parentId !== mainCategoryId) {
            return 'الفئة الفرعية المختارة لا تتبع الفئة الرئيسية المحددة.';
        }

        return '';
    }

    function saveProduct(TZ, A, payload) {
        if (A.editingProductId) {
            const product = TZ.db.products.find((item) => item.id === A.editingProductId);
            if (!product) return;
            Object.assign(product, payload);
            TZ.commitDb('product_update', TZ.getSession()?.userId, payload.name, { type: 'product', data: product });
            A.showToast('تم تحديث المنتج.');
            return;
        }

        const newProduct = {
            ...payload,
            id: TZ.generateId('prd-'),
            status: payload.quantity > 0 ? 'active' : 'hidden',
            sold: 0,
            rating: 0,
            createdAt: TZ.nowIso()
        };
        TZ.db.products.push(newProduct);
        TZ.commitDb('product_create', TZ.getSession()?.userId, payload.name, { type: 'product', data: newProduct });
        A.showToast('تمت إضافة المنتج.');
    }

    function bindProductEvents(input) {
        const { A, TZ, helpers, accessoryCatalog, renderProducts, switchAdminSection } = input;
        const uiState = A.productsUiState || (A.productsUiState = { search: '', mainCategoryId: '', subCategoryId: '' });
        const search = document.getElementById('productSearch');
        const mainFilter = document.getElementById('productMainFilter');
        const catFilter = document.getElementById('productCatFilter');
        const clearFilterButton = document.getElementById('clearSubCategoryFilterBtn');
        const productFormPanel = document.getElementById('productFormPanel');
        const productForm = document.getElementById('productForm');
        const mainCategoryInput = document.getElementById('pMainCategory');
        const subCategoryInput = document.getElementById('pCategory');
        const formTitle = document.getElementById('productFormTitle');

        function updateSubCategoryFilter(selectedSubCategoryId = catFilter.value) {
            const filtered = helpers.getSubCategories(TZ, accessoryCatalog, mainFilter.value);
            catFilter.innerHTML = `<option value="">كل الفئات الفرعية</option>${helpers.buildSubCategoryOptions(TZ, filtered)}`;
            catFilter.value = filtered.some((category) => category.id === selectedSubCategoryId) ? selectedSubCategoryId : '';
        }

        function filterProducts() {
            const query = (search.value || '').toLowerCase();
            uiState.search = search.value || '';
            uiState.mainCategoryId = mainFilter.value;
            uiState.subCategoryId = catFilter.value;

            document.querySelectorAll('#productsTableBody tr').forEach((row) => {
                const product = TZ.getProductById(row.dataset.productId);
                const selectedSubCategory = TZ.db.categories.find((category) => category.id === product?.categoryId);
                const matchesQuery = !query || product?.name?.toLowerCase().includes(query);
                const matchesMain = !mainFilter.value || selectedSubCategory?.parentId === mainFilter.value;
                const matchesSub = !catFilter.value || product?.categoryId === catFilter.value;
                row.style.display = matchesQuery && matchesMain && matchesSub ? '' : 'none';
            });
        }

        function syncSubCategoryQuickAccess() {
            document.querySelectorAll('.subcategory-shortcut-btn').forEach((button) => {
                const isActive = !!catFilter.value && button.dataset.subId === catFilter.value;
                button.classList.toggle('btn-primary', isActive);
                button.classList.toggle('btn-outline', !isActive);
            });
        }

        function setCategoryFilter(mainCategoryId, subCategoryId) {
            mainFilter.value = mainCategoryId || '';
            updateSubCategoryFilter(subCategoryId || '');
            filterProducts();
            syncSubCategoryQuickAccess();
        }

        function openProductForm(product) {
            const selectedFilterSubCategoryId = uiState.subCategoryId || '';
            const selectedFilterMainCategoryId = selectedFilterSubCategoryId
                ? (TZ.db.categories.find((category) => category.id === selectedFilterSubCategoryId)?.parentId || uiState.mainCategoryId || '')
                : (uiState.mainCategoryId || '');
            const defaultMainCategoryId = product
                ? (TZ.db.categories.find((category) => category.id === product.categoryId)?.parentId || '')
                : (selectedFilterMainCategoryId || helpers.getMainCategories(TZ, accessoryCatalog)[0]?.id || '');

            A.editingProductId = product?.id || null;
            A.productImages = TZ.clone(product?.images || []);
            productForm.reset();
            document.getElementById('specsRows').innerHTML = '';
            document.getElementById('imagePreviews').innerHTML = '';
            document.getElementById('pLowStock').value = '5';
            document.getElementById('pProductType').value = product?.productType && product.productType !== 'accessory' ? product.productType : 'physical';
            mainCategoryInput.value = defaultMainCategoryId;
            setSubCategoryOptions(TZ, helpers, accessoryCatalog, subCategoryInput, defaultMainCategoryId, product?.categoryId || selectedFilterSubCategoryId || '');

            if (product) {
                formTitle.innerHTML = '<i class="fas fa-edit"></i> تعديل المنتج';
                document.getElementById('pName').value = product.name || '';
                document.getElementById('pBrand').value = product.brand || '';
                document.getElementById('pPrice').value = product.price || 0;
                document.getElementById('pDiscount').value = product.discountPrice || '';
                document.getElementById('pQuantity').value = product.quantity || 0;
                document.getElementById('pLowStock').value = product.lowStockAlert || 5;
                document.getElementById('pDescription').value = product.description || '';
                (product.specs || []).forEach((spec) => addSpecRow(TZ, spec.key, spec.value));
                (product.variants || []).forEach((variant) => addVariantRow(TZ, variant.name, (variant.options || []).join('، ')));
                renderImagePreviews(A);
            } else {
                formTitle.innerHTML = '<i class="fas fa-plus"></i> إضافة منتج جديد';
            }

            productFormPanel.style.display = 'block';
            productFormPanel.scrollIntoView({ behavior: 'smooth' });
        }

        search.value = uiState.search || '';
        mainFilter.value = uiState.mainCategoryId || '';
        updateSubCategoryFilter(uiState.subCategoryId || '');

        search.addEventListener('input', () => { filterProducts(); syncSubCategoryQuickAccess(); });
        mainFilter.addEventListener('change', () => { updateSubCategoryFilter(''); filterProducts(); syncSubCategoryQuickAccess(); });
        catFilter.addEventListener('change', () => { filterProducts(); syncSubCategoryQuickAccess(); });
        clearFilterButton?.addEventListener('click', () => { mainFilter.value = ''; updateSubCategoryFilter(''); filterProducts(); syncSubCategoryQuickAccess(); });
        document.querySelectorAll('.subcategory-shortcut-btn').forEach((button) => button.addEventListener('click', () => setCategoryFilter(button.dataset.mainId, button.dataset.subId)));
        document.querySelectorAll('.subcategory-link-btn').forEach((button) => button.addEventListener('click', () => { setCategoryFilter(button.dataset.mainId, button.dataset.subId); document.querySelector('.filter-bar')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }));
        document.querySelector('.quick-add-main-btn')?.addEventListener('click', () => { switchAdminSection('main-categories'); setTimeout(() => document.getElementById('addMainCategoryBtn')?.click(), 0); });
        document.querySelector('.quick-add-sub-btn')?.addEventListener('click', () => { if (helpers.getMainCategories(TZ, accessoryCatalog).length === 0) { A.showToast('أضف فئة رئيسية أولًا ثم أضف الفئة الفرعية.'); switchAdminSection('main-categories'); return; } switchAdminSection('subcategories'); setTimeout(() => document.getElementById('addSubCategoryBtn')?.click(), 0); });
        document.querySelectorAll('.open-categories-btn').forEach((button) => button.addEventListener('click', () => switchAdminSection('main-categories')));

        document.getElementById('addProductBtn').addEventListener('click', () => {
            if (helpers.getMainCategories(TZ, accessoryCatalog).length === 0) {
                A.showToast('أضف فئة رئيسية أولًا قبل إضافة المنتج.');
                switchAdminSection('main-categories');
                return;
            }

            if (helpers.getSubCategories(TZ, accessoryCatalog).length === 0) {
                A.showToast('أضف فئة فرعية أولًا قبل إضافة المنتج.');
                switchAdminSection('subcategories');
                return;
            }

            openProductForm(null);
        });

        document.getElementById('cancelProductBtn').addEventListener('click', () => { productFormPanel.style.display = 'none'; });
        mainCategoryInput.addEventListener('change', () => setSubCategoryOptions(TZ, helpers, accessoryCatalog, subCategoryInput, mainCategoryInput.value));
        document.querySelectorAll('.edit-product-btn').forEach((button) => button.addEventListener('click', () => { const product = TZ.getProductById(button.dataset.id); if (product) openProductForm(product); }));
        document.querySelectorAll('.toggle-product-btn').forEach((button) => button.addEventListener('click', () => {
            const product = TZ.db.products.find((item) => item.id === button.dataset.id);
            if (!product) return;
            product.status = product.status === 'active' ? 'hidden' : 'active';
            TZ.commitDb('product_toggle', TZ.getSession()?.userId, `${product.name}: ${product.status}`, { type: 'product', data: product });
            renderProducts();
            A.showToast('تم تحديث حالة المنتج.');
        }));

        document.querySelectorAll('.delete-product-btn').forEach((button) => button.addEventListener('click', () => {
            const id = button.dataset.id;
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
                }, () => TZ.commitDb('product_delete', TZ.getSession()?.userId, product.name, { type: 'product_delete', data: { id: product.id } }));
            });
        }));

        document.getElementById('addSpecBtn').addEventListener('click', () => addSpecRow(TZ, '', ''));
        document.getElementById('addVariantBtn').addEventListener('click', () => addVariantRow(TZ, '', ''));

        const uploadArea = document.getElementById('imageUploadArea');
        const imageInput = document.getElementById('imageInput');
        uploadArea.addEventListener('click', () => imageInput.click());
        imageInput.addEventListener('change', function () {
            Array.from(this.files || []).forEach((file) => {
                if (A.isAdminImageUploadTooLarge(file)) {
                    A.showAdminImageUploadLimitToast();
                    return;
                }

                const reader = new FileReader();
                reader.onload = function (event) {
                    A.productImages.push(event.target.result);
                    renderImagePreviews(A);
                };
                reader.readAsDataURL(file);
            });
        });

        productForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const payload = buildProductPayload(TZ, A, subCategoryInput);
            const validationMessage = validateProductPayload(TZ, payload, mainCategoryInput.value);
            if (validationMessage) {
                A.showToast(validationMessage);
                return;
            }

            saveProduct(TZ, A, payload);
            uiState.mainCategoryId = mainCategoryInput.value;
            uiState.subCategoryId = payload.categoryId;
            renderProducts();
        });

        filterProducts();
        syncSubCategoryQuickAccess();
    }

    function mountProductBulkActions(input) {
        const { A, TZ, helpers, bulkActions, renderProducts } = input;
        if (!bulkActions) return;

        async function updateBulkProductStatus(ids, status) {
            const products = (TZ.db.products || []).filter((product) => ids.includes(product.id));
            await Promise.all(products.map((product) => {
                product.status = status;
                return Promise.resolve(TZ.commitDb('product_bulk_status', TZ.getSession()?.userId, `${product.name}: ${status}`, {
                    type: 'product',
                    data: product
                }));
            }));
            renderProducts();
            A.showToast(`تم تحديث حالة ${products.length} منتجات.`);
        }

        async function deleteBulkProducts(ids) {
            const products = (TZ.db.products || []).filter((product) => ids.includes(product.id));
            TZ.db.products = (TZ.db.products || []).filter((product) => !ids.includes(product.id));
            await Promise.all(products.map((product) => Promise.resolve(TZ.commitDb('product_delete', TZ.getSession()?.userId, product.name, {
                type: 'product_delete',
                data: { id: product.id }
            }))));
            renderProducts();
            A.showToast(`تم حذف ${products.length} منتجات.`);
        }

        bulkActions.mount({
            scopeKey: 'products',
            tableSelector: '#productsTable',
            status: {
                title: 'تغيير حالة المنتجات المحددة',
                options: [{ value: 'active', label: 'نشط' }, { value: 'hidden', label: 'مخفي' }],
                run: updateBulkProductStatus
            },
            delete: {
                title: 'حذف المنتجات المحددة',
                message: 'سيتم حذف المنتجات المحددة نهائيًا. هل تريد المتابعة؟',
                run: deleteBulkProducts
            },
            export: {
                filename: 'products-export.csv',
                columns: [
                    { key: 'name', label: 'المنتج' },
                    { key: 'category', label: 'الفئة' },
                    { key: 'brand', label: 'العلامة' },
                    { key: 'price', label: 'السعر' },
                    { key: 'quantity', label: 'المخزون' },
                    { key: 'status', label: 'الحالة' }
                ],
                buildRows: (ids) => helpers.buildProductExportRows(TZ, ids)
            }
        });
    }

    window.AdminProductsForm = {
        bindProductEvents,
        mountProductBulkActions
    };
})();
