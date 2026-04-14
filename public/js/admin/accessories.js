// ===== TechZone Admin - Accessories =====
(function () {
    'use strict';

    const A = window.AdminApp;
    const accessoryCatalog = A.accessoryCatalog || TZ.accessoryCatalog || {
        publicLabel: 'إكسسوارات',
        mainCategoryId: 'cat-accessories-direct-root',
        subcategoryId: 'cat-accessories-direct-items',
        mainCategorySeed: { id: 'cat-accessories-direct-root', name: 'منتجات إكسسوارات', parentId: null, status: 'active', sortOrder: 9991, icon: 'fa-headphones', image: '', description: '', slug: 'accessories-direct-root', showInNavbar: false },
        subcategorySeed: { id: 'cat-accessories-direct-items', name: 'قسم مباشر', parentId: 'cat-accessories-direct-root', status: 'active', sortOrder: 9992, icon: 'fa-box-open', image: '', description: '', slug: 'accessories-direct-items', showInNavbar: false }
    };
    const state = A.accessoriesState || (A.accessoriesState = {
        search: '',
        form: null,
        drafts: {},
        error: '',
        creating: false,
        savingId: '',
        modalProductId: '',
        modalError: ''
    });

    function escapeText(value) {
        return TZ.escapeHtml(value == null ? '' : String(value));
    }

    function getActorId() {
        return TZ.getSession ? TZ.getSession()?.userId : null;
    }

    function emptyForm() {
        return {
            name: '',
            brand: '',
            price: '',
            discountPrice: '',
            quantity: '0',
            lowStockAlert: '5',
            status: 'active',
            description: '',
            imagePreviewUrl: ''
        };
    }

    function sanitizeImageUrl(value) {
        const raw = String(value || '').trim();
        if (!raw) return '';
        if (raw.startsWith('data:image/') || raw.startsWith('blob:')) return raw;

        try {
            const url = new URL(raw, window.location.origin);
            if (url.protocol === 'http:' || url.protocol === 'https:') return url.href;
        } catch (error) {
            void error;
        }

        return '';
    }

    function readImageFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => resolve(typeof event.target?.result === 'string' ? event.target.result : '');
            reader.onerror = () => reject(new Error('تعذر قراءة الصورة.'));
            reader.readAsDataURL(file);
        });
    }

    function getProducts() {
        return (TZ.db.products || [])
            .filter((product) => typeof TZ.isAccessoryProduct === 'function' ? TZ.isAccessoryProduct(product) : product?.productType === 'accessory')
            .sort((first, second) => new Date(second.createdAt || 0) - new Date(first.createdAt || 0));
    }

    function getProduct(productId) {
        return (TZ.db.products || []).find((item) => item.id === productId) || null;
    }

    function buildDraft(product) {
        return {
            name: product.name || '',
            brand: product.brand || '',
            price: String(product.price ?? ''),
            discountPrice: String(product.discountPrice ?? ''),
            quantity: String(product.quantity ?? 0),
            lowStockAlert: String(product.lowStockAlert ?? 5),
            status: product.status === 'inactive' ? 'inactive' : 'active',
            description: product.description || '',
            imagePreviewUrl: sanitizeImageUrl(Array.isArray(product.images) ? product.images[0] : '')
        };
    }

    function getDraft(productId, product) {
        const currentProduct = product || getProduct(productId) || {};
        if (!state.drafts[productId]) state.drafts[productId] = buildDraft(currentProduct);
        return state.drafts[productId];
    }

    function captureState() {
        return {
            categories: TZ.clone(TZ.db.categories || []),
            products: TZ.clone(TZ.db.products || []),
            settings: TZ.clone(TZ.db.settings || {})
        };
    }

    function restoreState(snapshot) {
        TZ.db.categories = TZ.clone(snapshot.categories || []);
        TZ.db.products = TZ.clone(snapshot.products || []);
        TZ.db.settings = TZ.clone(snapshot.settings || {});
    }

    async function commitChange(action, details, resource) {
        await Promise.resolve(TZ.commitDb(action, getActorId(), details, resource));
    }

    async function runMutation(mutator, successMessage, fallbackMessage, errorKey = 'error') {
        const snapshot = captureState();
        try {
            const tasks = await mutator();
            for (const task of tasks || []) await task();
            state.error = '';
            state.modalError = '';
            render();
            A.showToast(successMessage);
        } catch (error) {
            restoreState(snapshot);
            state[errorKey] = error?.message || fallbackMessage;
            render();
        } finally {
            state.creating = false;
            state.savingId = '';
        }
    }

    function buildPayload(source) {
        return {
            name: String(source.name || '').trim(),
            brand: String(source.brand || '').trim(),
            price: Number(source.price || 0),
            discountPrice: source.discountPrice === '' ? 0 : Number(source.discountPrice || 0),
            quantity: Number(source.quantity || 0),
            lowStockAlert: Number(source.lowStockAlert || 5),
            status: source.status === 'inactive' ? 'inactive' : 'active',
            description: String(source.description || '').trim(),
            imageUrl: sanitizeImageUrl(source.imagePreviewUrl || '')
        };
    }

    function validatePayload(payload) {
        if (!payload.name) return 'اسم المنتج مطلوب.';
        if (!Number.isFinite(payload.price) || payload.price < 0) return 'السعر غير صالح.';
        if (!Number.isFinite(payload.discountPrice) || payload.discountPrice < 0) return 'سعر الخصم غير صالح.';
        if (payload.discountPrice > payload.price) return 'سعر الخصم يجب أن يكون أقل من السعر الأساسي.';
        if (!Number.isFinite(payload.quantity) || payload.quantity < 0) return 'الكمية غير صالحة.';
        if (!Number.isFinite(payload.lowStockAlert) || payload.lowStockAlert < 0) return 'حد التنبيه غير صالح.';
        return '';
    }

    async function ensureAccessoryCategories() {
        if (!TZ.db.settings) TZ.db.settings = {};
        if (!TZ.db.settings.categoryNavVisibility) TZ.db.settings.categoryNavVisibility = {};

        const tasks = [];
        let mainCategory = (TZ.db.categories || []).find((item) => item.id === accessoryCatalog.mainCategoryId);
        let subcategory = (TZ.db.categories || []).find((item) => item.id === accessoryCatalog.subcategoryId);

        if (!mainCategory) {
            mainCategory = TZ.clone(accessoryCatalog.mainCategorySeed);
            TZ.db.categories.push(mainCategory);
            tasks.push(() => commitChange('category_create', mainCategory.name, { type: 'category', data: mainCategory }));
        }

        if (!subcategory) {
            subcategory = TZ.clone(accessoryCatalog.subcategorySeed);
            TZ.db.categories.push(subcategory);
            tasks.push(() => commitChange('category_create', subcategory.name, { type: 'category', data: subcategory }));
        }

        mainCategory.parentId = null;
        mainCategory.showInNavbar = false;
        subcategory.parentId = accessoryCatalog.mainCategoryId;
        subcategory.showInNavbar = false;
        TZ.db.settings.categoryNavVisibility[accessoryCatalog.mainCategoryId] = false;
        tasks.push(() => commitChange('category_update', mainCategory.name, { type: 'category', data: mainCategory }));
        tasks.push(() => commitChange('category_update', subcategory.name, { type: 'category', data: subcategory }));
        tasks.push(() => commitChange('settings_update', 'إخفاء الفئة الداخلية من الصفحة الرئيسية', { type: 'settings_update', data: TZ.db.settings }));

        for (const task of tasks) await task();
    }

    function renderImageSurface(imageUrl, height) {
        return imageUrl
            ? `<img src="${escapeText(imageUrl)}" alt="صورة المنتج" style="width:100%;height:${height}px;object-fit:cover;border-radius:16px;border:1px solid rgba(255,255,255,0.08);background:#09111d;">`
            : `<div style="height:${height}px;border-radius:16px;border:1px dashed rgba(255,255,255,0.10);display:grid;place-items:center;color:var(--text-muted);background:rgba(255,255,255,0.03);">لا توجد صورة</div>`;
    }

    function formatCurrency(value) {
        return `${Number(value || 0).toFixed(2)} د.أ`;
    }

    function getDisplayPrice(source) {
        const price = Number(source.price || 0);
        const discountPrice = Number(source.discountPrice || 0);
        return discountPrice > 0 && discountPrice < price ? discountPrice : price;
    }

    function getStockState(source) {
        const quantity = Number(source.quantity || 0);
        const lowStockAlert = Number(source.lowStockAlert || 0);

        if (quantity <= 0) return { tone: 'hidden', label: 'نفد المخزون' };
        if (quantity <= lowStockAlert) return { tone: 'hidden', label: 'مخزون منخفض' };
        return { tone: 'active', label: 'مخزون جيد' };
    }

    function buildSearchText(product) {
        return [product.name, product.brand, product.id].filter(Boolean).join(' ').toLowerCase();
    }

    function openEditModal(productId) {
        const product = getProduct(productId);
        if (!product) return;
        state.modalProductId = productId;
        state.modalError = '';
        state.drafts[productId] = buildDraft(product);
        render();
    }

    function closeEditModal() {
        state.modalProductId = '';
        state.modalError = '';
        render();
    }

    function renderMetricCard(label, value, hint) {
        return `
            <div class="accessory-summary-metric">
                <span>${label}</span>
                <strong>${value}</strong>
                ${hint ? `<small>${hint}</small>` : ''}
            </div>
        `;
    }

    function renderCard(product) {
        const stock = getStockState(product);
        const currentPrice = getDisplayPrice(product);
        const hasDiscount = Number(product.discountPrice || 0) > 0 && currentPrice < Number(product.price || 0);
        const imageUrl = sanitizeImageUrl(Array.isArray(product.images) ? product.images[0] : '');

        return `
            <article class="admin-panel accessory-summary-card" data-search="${escapeText(buildSearchText(product))}">
                <div class="panel-body accessory-summary-grid">
                    <div class="accessory-summary-media">
                        ${renderImageSurface(imageUrl, 148)}
                    </div>
                    <div class="accessory-summary-body">
                        <div class="accessory-summary-head">
                            <div class="accessory-summary-title">
                                <h3>${escapeText(product.name || 'منتج بدون اسم')}</h3>
                                <div class="accessory-summary-meta">
                                    <span class="status-badge ${product.status === 'active' ? 'active' : 'hidden'}">${product.status === 'active' ? 'نشط' : 'مخفي'}</span>
                                    <span class="status-badge ${stock.tone}">${stock.label}</span>
                                    ${product.brand ? `<span class="accessory-summary-caption">العلامة: ${escapeText(product.brand)}</span>` : ''}
                                </div>
                            </div>
                            <span class="accessory-summary-caption">#${escapeText(product.id)}</span>
                        </div>
                        <p class="accessory-summary-description">${escapeText(product.description || 'لا يوجد وصف مضاف لهذا المنتج حتى الآن.')}</p>
                        <div class="accessory-summary-metrics">
                            ${renderMetricCard('السعر الحالي', formatCurrency(currentPrice), hasDiscount ? `بدلاً من ${formatCurrency(product.price)}` : '')}
                            ${renderMetricCard('الكمية المتاحة', escapeText(product.quantity ?? 0), `تنبيه عند ${escapeText(product.lowStockAlert ?? 0)}`)}
                            ${renderMetricCard('حالة العرض', product.status === 'active' ? 'ظاهر للعملاء' : 'مخفي حالياً', product.brand ? escapeText(product.brand) : 'بدون علامة تجارية')}
                        </div>
                    </div>
                    <div class="accessory-summary-actions">
                        <button class="btn btn-outline btn-sm" type="button" data-action="edit" data-id="${product.id}">
                            <i class="fas fa-pen"></i> تعديل
                        </button>
                        <button class="btn btn-outline btn-sm" type="button" data-action="delete" data-id="${product.id}" style="border-color:rgba(231,76,60,0.4);color:#ff7675;">
                            <i class="fas fa-trash"></i> حذف
                        </button>
                    </div>
                </div>
            </article>
        `;
    }

    function renderEditModal() {
        const product = getProduct(state.modalProductId);
        if (!product) return '';

        const draft = getDraft(product.id, product);
        const stock = getStockState(draft);
        const displayPrice = getDisplayPrice(draft);
        const originalPrice = Number(draft.price || 0);
        const hasDiscount = Number(draft.discountPrice || 0) > 0 && displayPrice < originalPrice;
        const imageInputId = `accessory-modal-image-${product.id}`;
        const isSaving = state.savingId === product.id;

        return `
            <div id="accessoryEditModal" class="modal-overlay admin-edit-modal" role="dialog" aria-modal="true" aria-labelledby="accessoryEditTitle">
                <div class="modal-card admin-edit-modal-card">
                    <div class="admin-edit-modal-header">
                        <div class="admin-edit-modal-title">
                            <h3 id="accessoryEditTitle"><i class="fas fa-pen"></i> تعديل الإكسسوار</h3>
                            <p>عدّل التفاصيل في شاشة مخصصة ثم احفظ التغييرات بعد مراجعة المعاينة والحالة.</p>
                        </div>
                        <button class="btn btn-ghost btn-sm" type="button" data-action="close-edit-modal">
                            <i class="fas fa-times"></i> إغلاق
                        </button>
                    </div>
                    <div class="admin-edit-modal-body">
                        <div class="admin-edit-modal-sidebar">
                            ${renderImageSurface(sanitizeImageUrl(draft.imagePreviewUrl), 260)}
                            <label class="admin-field-group">
                                <span class="admin-field-label">رابط الصورة</span>
                                <input data-modal-field="imagePreviewUrl" value="${escapeText(draft.imagePreviewUrl)}" placeholder="https://example.com/image.jpg">
                            </label>
                            <input id="${imageInputId}" class="accessory-modal-image-input" type="file" accept="image/*" style="display:none;">
                            <div class="admin-form-actions">
                                <button class="btn btn-outline btn-sm" type="button" data-action="pick-modal-image" data-input-id="${imageInputId}">
                                    <i class="fas fa-image"></i> اختيار صورة
                                </button>
                                <button class="btn btn-outline btn-sm" type="button" data-action="clear-modal-image">
                                    <i class="fas fa-eraser"></i> مسح الصورة
                                </button>
                            </div>
                            <div class="admin-modal-helper">
                                <strong>المعاينة الحالية</strong>
                                <span>هذه الصورة والحالة هما ما سيظهران في صفحة الإكسسوارات بعد الحفظ.</span>
                            </div>
                            <div class="admin-edit-modal-stats">
                                ${renderMetricCard('السعر الحالي', formatCurrency(displayPrice), hasDiscount ? `بدلاً من ${formatCurrency(originalPrice)}` : 'بدون خصم')}
                                ${renderMetricCard('الكمية المتاحة', escapeText(draft.quantity || 0), `تنبيه عند ${escapeText(draft.lowStockAlert || 0)}`)}
                                ${renderMetricCard('حالة المخزون', stock.label, draft.status === 'active' ? 'سيظهر للعملاء' : 'مخفي عن الواجهة')}
                            </div>
                        </div>
                        <form id="accessoryEditForm" class="admin-edit-modal-form">
                            <div class="admin-polish-grid admin-polish-grid--modal">
                                <label class="admin-field-group">
                                    <span class="admin-field-label">اسم المنتج</span>
                                    <input data-modal-field="name" value="${escapeText(draft.name)}" placeholder="اسم المنتج" required>
                                </label>
                                <label class="admin-field-group">
                                    <span class="admin-field-label">العلامة التجارية</span>
                                    <input data-modal-field="brand" value="${escapeText(draft.brand)}" placeholder="العلامة التجارية">
                                </label>
                                <label class="admin-field-group">
                                    <span class="admin-field-label">السعر الأساسي</span>
                                    <input data-modal-field="price" type="number" min="0" step="0.01" value="${escapeText(draft.price)}" placeholder="0.00">
                                </label>
                                <label class="admin-field-group">
                                    <span class="admin-field-label">سعر الخصم</span>
                                    <input data-modal-field="discountPrice" type="number" min="0" step="0.01" value="${escapeText(draft.discountPrice)}" placeholder="0.00">
                                </label>
                                <label class="admin-field-group">
                                    <span class="admin-field-label">الكمية</span>
                                    <input data-modal-field="quantity" type="number" min="0" step="1" value="${escapeText(draft.quantity)}" placeholder="0">
                                </label>
                                <label class="admin-field-group">
                                    <span class="admin-field-label">حد التنبيه</span>
                                    <input data-modal-field="lowStockAlert" type="number" min="0" step="1" value="${escapeText(draft.lowStockAlert)}" placeholder="5">
                                </label>
                                <label class="admin-field-group">
                                    <span class="admin-field-label">الحالة</span>
                                    <select data-modal-field="status">
                                        <option value="active" ${draft.status === 'active' ? 'selected' : ''}>نشط</option>
                                        <option value="inactive" ${draft.status === 'inactive' ? 'selected' : ''}>غير نشط</option>
                                    </select>
                                </label>
                                <div class="admin-modal-helper">
                                    <strong>معرّف المنتج</strong>
                                    <span>${escapeText(product.id)}</span>
                                </div>
                            </div>
                            <label class="admin-field-group">
                                <span class="admin-field-label">الوصف</span>
                                <textarea data-modal-field="description" rows="6" placeholder="وصف مختصر وواضح يشرح المنتج وفائدته.">${escapeText(draft.description)}</textarea>
                            </label>
                        </form>
                    </div>
                    ${state.modalError ? `<div class="status-box warning" style="margin:0 24px 20px;">${escapeText(state.modalError)}</div>` : ''}
                    <div class="admin-edit-modal-footer">
                        <div class="admin-edit-modal-status">
                            <span class="status-badge ${draft.status === 'active' ? 'active' : 'hidden'}">${draft.status === 'active' ? 'نشط' : 'مخفي'}</span>
                            <span class="status-badge ${stock.tone}">${stock.label}</span>
                            ${draft.brand ? `<span class="accessory-summary-caption">العلامة: ${escapeText(draft.brand)}</span>` : ''}
                        </div>
                        <div class="admin-edit-modal-actions">
                            <button class="btn btn-outline btn-sm" type="button" data-action="delete-modal" style="border-color:rgba(231,76,60,0.4);color:#ff7675;">
                                <i class="fas fa-trash"></i> حذف
                            </button>
                            <button class="btn btn-outline btn-sm" type="button" data-action="close-edit-modal">
                                <i class="fas fa-times"></i> إلغاء
                            </button>
                            <button class="btn btn-primary btn-sm" type="submit" form="accessoryEditForm" ${isSaving ? 'disabled' : ''}>
                                <i class="fas fa-save"></i> ${isSaving ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function render() {
        if (!state.form) state.form = emptyForm();
        const products = getProducts();

        products.forEach((product) => {
            if (!state.drafts[product.id]) state.drafts[product.id] = buildDraft(product);
        });

        A.adminContent.innerHTML = `
            <div class="admin-panel" style="margin-bottom:18px;">
                <div class="panel-header"><h2>إضافة منتج إكسسوارات</h2></div>
                <div class="panel-body padded">
                    <form id="accessoryCreateForm" class="admin-form admin-form-stack">
                        <div class="admin-polish-grid">
                            <input data-form-field="name" placeholder="اسم المنتج" value="${escapeText(state.form.name)}" required>
                            <input data-form-field="brand" placeholder="العلامة التجارية" value="${escapeText(state.form.brand)}">
                            <input data-form-field="price" type="number" min="0" step="0.01" placeholder="السعر" value="${escapeText(state.form.price)}" required>
                            <input data-form-field="discountPrice" type="number" min="0" step="0.01" placeholder="سعر الخصم" value="${escapeText(state.form.discountPrice)}">
                            <input data-form-field="quantity" type="number" min="0" step="1" placeholder="الكمية" value="${escapeText(state.form.quantity)}">
                            <input data-form-field="lowStockAlert" type="number" min="0" step="1" placeholder="حد التنبيه" value="${escapeText(state.form.lowStockAlert)}">
                            <select data-form-field="status"><option value="active" ${state.form.status === 'active' ? 'selected' : ''}>نشط</option><option value="inactive" ${state.form.status === 'inactive' ? 'selected' : ''}>غير نشط</option></select>
                        </div>
                        <textarea data-form-field="description" rows="3" placeholder="وصف مختصر">${escapeText(state.form.description)}</textarea>
                        <div class="admin-edit-grid" style="align-items:start;">
                            <div>${renderImageSurface(sanitizeImageUrl(state.form.imagePreviewUrl), 180)}</div>
                            <div class="admin-fields-column">
                                <input data-form-field="imagePreviewUrl" placeholder="رابط الصورة" value="${escapeText(state.form.imagePreviewUrl)}">
                                <input id="accessoryCreateImageInput" type="file" accept="image/*" style="display:none;">
                                <div class="admin-form-actions">
                                    <button class="btn btn-outline btn-sm" type="button" id="pickCreateAccessoryImageBtn">اختيار صورة</button>
                                    <button class="btn btn-outline btn-sm" type="button" id="clearCreateAccessoryImageBtn">مسح الصورة</button>
                                    <button class="btn btn-primary btn-sm" type="submit">${state.creating ? 'جارٍ الإضافة...' : 'إضافة المنتج'}</button>
                                </div>
                            </div>
                        </div>
                    </form>
                    ${state.error ? `<div class="status-box warning">${escapeText(state.error)}</div>` : ''}
                </div>
            </div>
            <div class="admin-panel" style="margin-bottom:18px;">
                <div class="panel-body">
                    <input id="accessorySearchInput" placeholder="ابحث باسم المنتج أو الماركة..." value="${escapeText(state.search)}">
                </div>
            </div>
            <div id="accessoriesList" class="accessory-summary-list">
                ${products.length ? products.map((product) => renderCard(product)).join('') : '<div class="admin-panel"><div class="panel-body" style="text-align:center;color:var(--text-muted);">لا توجد منتجات إكسسوارات بعد.</div></div>'}
            </div>
            ${renderEditModal()}
        `;

        bindEvents();
        filterCards();
    }

    function filterCards() {
        const query = String(state.search || '').trim().toLowerCase();
        document.querySelectorAll('#accessoriesList [data-search]').forEach((card) => {
            card.style.display = !query || card.dataset.search.includes(query) ? '' : 'none';
        });
    }

    function bindEvents() {
        bindCreateEvents();
        bindListEvents();
        bindModalEvents();
    }

    function bindCreateEvents() {
        const form = document.getElementById('accessoryCreateForm');
        form?.addEventListener('input', handleCreateInput);
        form?.addEventListener('change', handleCreateInput);
        form?.addEventListener('submit', handleCreateSubmit);
        document.getElementById('pickCreateAccessoryImageBtn')?.addEventListener('click', () => document.getElementById('accessoryCreateImageInput')?.click());
        document.getElementById('clearCreateAccessoryImageBtn')?.addEventListener('click', () => {
            state.form.imagePreviewUrl = '';
            render();
        });
        document.getElementById('accessoryCreateImageInput')?.addEventListener('change', handleCreateImageChange);
        document.getElementById('accessorySearchInput')?.addEventListener('input', (event) => {
            state.search = event.target.value;
            filterCards();
        });
    }

    function bindListEvents() {
        document.getElementById('accessoriesList')?.addEventListener('click', handleListClick);
    }

    function bindModalEvents() {
        const modal = document.getElementById('accessoryEditModal');
        if (!modal) return;

        modal.addEventListener('click', handleModalClick);
        modal.addEventListener('input', handleModalInput);
        modal.addEventListener('change', handleModalChange);
        document.getElementById('accessoryEditForm')?.addEventListener('submit', handleModalSubmit);
    }

    function handleCreateInput(event) {
        const field = event.target?.dataset?.formField;
        if (field) state.form[field] = event.target.value;
    }

    async function handleCreateImageChange(event) {
        const file = event.target?.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) return A.showToast('الملف المختار ليس صورة.');
        state.form.imagePreviewUrl = await readImageFile(file);
        render();
    }

    async function handleCreateSubmit(event) {
        event.preventDefault();
        const payload = buildPayload(state.form);
        const error = validatePayload(payload);
        if (error) return A.showToast(error);
        state.creating = true;

        await runMutation(async () => {
            await ensureAccessoryCategories();
            const product = {
                id: TZ.generateId('acc-'),
                name: payload.name,
                brand: payload.brand,
                price: payload.price,
                discountPrice: payload.discountPrice,
                quantity: payload.quantity,
                lowStockAlert: payload.lowStockAlert,
                status: payload.status,
                description: payload.description,
                productType: 'accessory',
                categoryId: accessoryCatalog.subcategoryId,
                specs: [],
                images: payload.imageUrl ? [payload.imageUrl] : [],
                variants: [],
                rating: 0,
                sold: 0,
                createdAt: TZ.nowIso(),
                updatedAt: TZ.nowIso()
            };

            TZ.db.products.push(product);
            state.drafts[product.id] = buildDraft(product);
            state.form = emptyForm();
            return [() => commitChange('product_create', product.name, { type: 'product', data: product })];
        }, 'تمت إضافة منتج الإكسسوارات بنجاح.', 'تعذر إضافة منتج الإكسسوارات.');
    }

    async function handleListClick(event) {
        const trigger = event.target.closest('[data-action]');
        if (!trigger) return;

        const action = trigger.dataset.action;
        const id = trigger.dataset.id;

        if (action === 'edit' && id) return openEditModal(id);
        if (action === 'delete' && id) return confirmDelete(id);
    }

    async function confirmDelete(productId) {
        const product = getProduct(productId);
        if (!product) return;

        return A.showConfirmModal('حذف الإكسسوار', `هل تريد حذف "${escapeText(product.name)}"؟`, async () => {
            await runMutation(() => {
                TZ.db.products = (TZ.db.products || []).filter((item) => item.id !== productId);
                delete state.drafts[productId];
                if (state.modalProductId === productId) state.modalProductId = '';
                return [() => commitChange('product_delete', product.name, { type: 'product_delete', data: { id: productId } })];
            }, 'تم حذف الإكسسوار.', 'تعذر حذف الإكسسوار من قاعدة البيانات.');
        });
    }

    function handleModalInput(event) {
        const field = event.target?.dataset?.modalField;
        if (!field || !state.modalProductId) return;
        getDraft(state.modalProductId)[field] = event.target.value;
    }

    async function handleModalChange(event) {
        const target = event.target;
        if (!state.modalProductId || !target) return;

        if (target.classList.contains('accessory-modal-image-input')) {
            const file = target.files?.[0];
            if (!file) return;
            if (!file.type.startsWith('image/')) return A.showToast('الملف المختار ليس صورة.');
            getDraft(state.modalProductId).imagePreviewUrl = await readImageFile(file);
            return render();
        }

        const field = target.dataset?.modalField;
        if (!field) return;

        getDraft(state.modalProductId)[field] = target.value;
        if (['imagePreviewUrl', 'price', 'discountPrice', 'quantity', 'lowStockAlert', 'status', 'brand'].includes(field)) render();
    }

    function handleModalClick(event) {
        if (event.target === event.currentTarget) return closeEditModal();

        const trigger = event.target.closest('[data-action]');
        if (!trigger) return;

        const action = trigger.dataset.action;
        if (action === 'close-edit-modal') return closeEditModal();
        if (action === 'pick-modal-image') return document.getElementById(trigger.dataset.inputId)?.click();
        if (action === 'clear-modal-image') {
            getDraft(state.modalProductId).imagePreviewUrl = '';
            return render();
        }
        if (action === 'delete-modal') return confirmDelete(state.modalProductId);
    }

    async function handleModalSubmit(event) {
        event.preventDefault();
        const product = getProduct(state.modalProductId);
        if (!product) return;

        const payload = buildPayload(getDraft(product.id, product));
        const error = validatePayload(payload);
        if (error) {
            state.modalError = error;
            return render();
        }

        state.modalError = '';
        state.savingId = product.id;
        render();

        await runMutation(async () => {
            await ensureAccessoryCategories();
            Object.assign(product, {
                name: payload.name,
                brand: payload.brand,
                price: payload.price,
                discountPrice: payload.discountPrice,
                quantity: payload.quantity,
                lowStockAlert: payload.lowStockAlert,
                status: payload.status,
                description: payload.description,
                productType: 'accessory',
                categoryId: accessoryCatalog.subcategoryId,
                images: payload.imageUrl ? [payload.imageUrl] : [],
                updatedAt: TZ.nowIso()
            });

            state.drafts[product.id] = buildDraft(product);
            state.modalProductId = '';
            return [() => commitChange('product_update', product.name, { type: 'product', data: product })];
        }, 'تم حفظ تعديلات المنتج.', 'تعذر حفظ تعديلات المنتج.', 'modalError');
    }

    window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && state.modalProductId) closeEditModal();
    });

    A.sections.accessories = render;
})();
