// ===== TechZone Admin - Accessories =====
(function () {
    'use strict';

    const A = window.AdminApp;
    const accessoryCatalog = A.accessoryCatalog || TZ.accessoryCatalog || {
        sectionName: 'منتجات اكسسوارات',
        publicLabel: 'إكسسوارات',
        mainCategoryId: 'cat-accessories-direct-root',
        subcategoryId: 'cat-accessories-direct-items',
        mainCategorySeed: {
            id: 'cat-accessories-direct-root',
            name: 'منتجات اكسسوارات',
            parentId: null,
            status: 'active',
            sortOrder: 9991,
            icon: 'fa-headphones',
            image: '',
            description: 'فئة داخلية مخصصة لمنتجات الإكسسوارات المباشرة.',
            slug: 'accessories-direct-root',
            showInNavbar: false
        },
        subcategorySeed: {
            id: 'cat-accessories-direct-items',
            name: 'قسم مباشر',
            parentId: 'cat-accessories-direct-root',
            status: 'active',
            sortOrder: 9992,
            icon: 'fa-box-open',
            image: '',
            description: 'فئة فرعية داخلية تحفظ منتجات الإكسسوارات التي تظهر مباشرة في صفحة المنتجات.',
            slug: 'accessories-direct-items',
            showInNavbar: false
        }
    };

    const EMPTY_FORM = {
        name: '',
        brand: '',
        price: '',
        discountPrice: '',
        quantity: '',
        status: 'active',
        description: '',
        lowStockAlert: '5'
    };

    function getState() {
        if (!A.accessoriesState) {
            A.accessoriesState = {
                search: '',
                form: { ...EMPTY_FORM },
                drafts: {},
                error: '',
                savingId: ''
            };
        }
        return A.accessoriesState;
    }

    function buildDraft(product) {
        return {
            name: product.name || '',
            brand: product.brand || '',
            price: String(product.price ?? ''),
            discountPrice: String(product.discountPrice ?? ''),
            quantity: String(product.quantity ?? ''),
            status: normalizeStatus(product.status),
            description: product.description || '',
            lowStockAlert: String(product.lowStockAlert ?? 5)
        };
    }

    function normalizeStatus(status) {
        return status === 'hidden' || status === 'inactive' ? 'inactive' : 'active';
    }

    function money(value) {
        return TZ.formatPrice ? TZ.formatPrice(Number(value || 0)) : `${Number(value || 0).toFixed(2)} د.أ`;
    }

    function formatUpdatedAt(value) {
        if (!value) return 'غير متاح';
        return new Date(value).toLocaleString('ar-JO');
    }

    function getActorId() {
        return TZ.getSession ? TZ.getSession()?.userId : null;
    }

    function escapeValue(value) {
        return TZ.escapeHtml(value == null ? '' : String(value));
    }

    function getProducts() {
        const items = TZ.clone(TZ.db.products || []).filter((product) => (
            typeof TZ.isAccessoryProduct === 'function'
                ? TZ.isAccessoryProduct(product)
                : product?.productType === 'accessory'
        ));

        return items.sort((first, second) => new Date(second.createdAt || 0) - new Date(first.createdAt || 0));
    }

    function ensureAccessoryCategories() {
        const actorId = getActorId();
        let mainCategory = TZ.db.categories.find((category) => category.id === accessoryCatalog.mainCategoryId);
        let subcategory = TZ.db.categories.find((category) => category.id === accessoryCatalog.subcategoryId);
        let settingsChanged = false;

        if (!mainCategory) {
            mainCategory = TZ.clone(accessoryCatalog.mainCategorySeed);
            TZ.db.categories.push(mainCategory);
            if (actorId) {
                TZ.commitDb('category_create', actorId, mainCategory.name, { type: 'category', data: mainCategory });
            }
        } else if (mainCategory.parentId) {
            mainCategory.parentId = null;
            if (actorId) {
                TZ.commitDb('category_update', actorId, mainCategory.name, { type: 'category', data: mainCategory });
            }
        }

        if (!subcategory) {
            subcategory = TZ.clone(accessoryCatalog.subcategorySeed);
            TZ.db.categories.push(subcategory);
            if (actorId) {
                TZ.commitDb('category_create', actorId, subcategory.name, { type: 'category', data: subcategory });
            }
        } else if (subcategory.parentId !== accessoryCatalog.mainCategoryId) {
            subcategory.parentId = accessoryCatalog.mainCategoryId;
            if (actorId) {
                TZ.commitDb('category_update', actorId, subcategory.name, { type: 'category', data: subcategory });
            }
        }

        mainCategory.showInNavbar = false;
        subcategory.showInNavbar = false;

        if (!TZ.db.settings) TZ.db.settings = {};
        if (!TZ.db.settings.categoryNavVisibility) TZ.db.settings.categoryNavVisibility = {};
        if (TZ.db.settings.categoryNavVisibility[accessoryCatalog.mainCategoryId] !== false) {
            TZ.db.settings.categoryNavVisibility[accessoryCatalog.mainCategoryId] = false;
            settingsChanged = true;
        }

        TZ.db.categories.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

        if (settingsChanged && actorId) {
            TZ.commitDb(
                'settings_update',
                actorId,
                `إخفاء الفئة الداخلية من الشريط: ${mainCategory.name}`,
                { type: 'settings_update', data: TZ.db.settings }
            );
        }

        return { mainCategory, subcategory };
    }

    function syncDrafts(products) {
        const state = getState();
        const nextDrafts = {};

        products.forEach((product) => {
            nextDrafts[product.id] = {
                ...buildDraft(product),
                ...(state.drafts[product.id] || {})
            };
        });

        state.drafts = nextDrafts;
    }

    function buildProductPayload(source) {
        return {
            name: (source.name || '').trim(),
            brand: (source.brand || '').trim(),
            price: Number(source.price || 0),
            discountPrice: source.discountPrice === '' ? 0 : Number(source.discountPrice || 0),
            quantity: Number(source.quantity || 0),
            status: normalizeStatus(source.status),
            description: (source.description || '').trim(),
            lowStockAlert: Number(source.lowStockAlert || 5)
        };
    }

    function validatePayload(payload) {
        if (!payload.name) return 'اسم المنتج مطلوب.';
        if (!Number.isFinite(payload.price) || payload.price < 0) return 'السعر يجب أن يكون رقمًا صالحًا.';
        if (!Number.isFinite(payload.discountPrice) || payload.discountPrice < 0) return 'سعر الخصم غير صالح.';
        if (payload.discountPrice > 0 && payload.discountPrice > payload.price) return 'سعر الخصم يجب أن يكون أقل من أو يساوي السعر الأساسي.';
        if (!Number.isFinite(payload.quantity) || payload.quantity < 0) return 'الكمية يجب أن تكون رقمًا صحيحًا أو صفرًا.';
        if (!Number.isFinite(payload.lowStockAlert) || payload.lowStockAlert < 0) return 'حد التنبيه يجب أن يكون رقمًا صحيحًا أو صفرًا.';
        if (!['active', 'inactive'].includes(payload.status)) return 'حالة المنتج غير صالحة.';
        return '';
    }

    function renderAccessoryCard(product, draft) {
        const lowStock = Number(product.quantity || 0) <= Number(product.lowStockAlert || 0);
        const searchText = [product.name, product.brand, product.id].join(' ').toLowerCase();

        return `
            <article
                class="accessory-item"
                data-product-id="${product.id}"
                data-search-text="${escapeValue(searchText)}"
                style="background:var(--bg-lighter);border:1px solid var(--border-color);border-radius:16px;padding:16px;display:grid;gap:12px;"
            >
                <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center;">
                    <div style="display:grid;gap:4px;">
                        <strong>${escapeValue(product.name)}</strong>
                        <div style="color:var(--text-muted);font-size:0.85rem;">
                            ${escapeValue(accessoryCatalog.publicLabel)}${product.brand ? ` • ${escapeValue(product.brand)}` : ''} • ${escapeValue(product.id)}
                        </div>
                    </div>

                    <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;">
                        <span style="color:var(--primary);font-weight:700;">
                            ${money(product.discountPrice || product.price)}
                        </span>
                        <span style="color:${lowStock ? '#e74c3c' : 'var(--text-muted)'};font-weight:700;">
                            المخزون: ${Number(product.quantity || 0)}
                        </span>
                    </div>
                </div>

                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;">
                    <div style="display:grid;gap:6px;">
                        <label style="font-size:0.85rem;color:var(--text-muted);font-weight:700;">اسم المنتج</label>
                        <input data-product-id="${product.id}" data-field="name" value="${escapeValue(draft.name)}" style="padding:11px 12px;border-radius:10px;border:1px solid var(--border-color);background:var(--card-bg);color:var(--text-color);">
                    </div>
                    <div style="display:grid;gap:6px;">
                        <label style="font-size:0.85rem;color:var(--text-muted);font-weight:700;">العلامة التجارية</label>
                        <input data-product-id="${product.id}" data-field="brand" value="${escapeValue(draft.brand)}" style="padding:11px 12px;border-radius:10px;border:1px solid var(--border-color);background:var(--card-bg);color:var(--text-color);">
                    </div>
                    <div style="display:grid;gap:6px;">
                        <label style="font-size:0.85rem;color:var(--text-muted);font-weight:700;">السعر</label>
                        <input type="number" min="0" step="0.01" data-product-id="${product.id}" data-field="price" value="${escapeValue(draft.price)}" style="padding:11px 12px;border-radius:10px;border:1px solid var(--border-color);background:var(--card-bg);color:var(--text-color);">
                    </div>
                    <div style="display:grid;gap:6px;">
                        <label style="font-size:0.85rem;color:var(--text-muted);font-weight:700;">سعر الخصم</label>
                        <input type="number" min="0" step="0.01" data-product-id="${product.id}" data-field="discountPrice" value="${escapeValue(draft.discountPrice)}" style="padding:11px 12px;border-radius:10px;border:1px solid var(--border-color);background:var(--card-bg);color:var(--text-color);">
                    </div>
                    <div style="display:grid;gap:6px;">
                        <label style="font-size:0.85rem;color:var(--text-muted);font-weight:700;">الكمية</label>
                        <input type="number" min="0" step="1" data-product-id="${product.id}" data-field="quantity" value="${escapeValue(draft.quantity)}" style="padding:11px 12px;border-radius:10px;border:1px solid var(--border-color);background:var(--card-bg);color:var(--text-color);">
                    </div>
                    <div style="display:grid;gap:6px;">
                        <label style="font-size:0.85rem;color:var(--text-muted);font-weight:700;">حد التنبيه</label>
                        <input type="number" min="0" step="1" data-product-id="${product.id}" data-field="lowStockAlert" value="${escapeValue(draft.lowStockAlert)}" style="padding:11px 12px;border-radius:10px;border:1px solid var(--border-color);background:var(--card-bg);color:var(--text-color);">
                    </div>
                    <div style="display:grid;gap:6px;">
                        <label style="font-size:0.85rem;color:var(--text-muted);font-weight:700;">الحالة</label>
                        <select data-product-id="${product.id}" data-field="status" style="padding:11px 12px;border-radius:10px;border:1px solid var(--border-color);background:var(--card-bg);color:var(--text-color);">
                            <option value="active" ${draft.status === 'active' ? 'selected' : ''}>active</option>
                            <option value="inactive" ${draft.status === 'inactive' ? 'selected' : ''}>inactive</option>
                        </select>
                    </div>
                </div>

                <div style="display:grid;gap:6px;">
                    <label style="font-size:0.85rem;color:var(--text-muted);font-weight:700;">الوصف</label>
                    <textarea rows="3" data-product-id="${product.id}" data-field="description" style="padding:11px 12px;border-radius:10px;border:1px solid var(--border-color);background:var(--card-bg);color:var(--text-color);resize:vertical;min-height:88px;">${escapeValue(draft.description)}</textarea>
                </div>

                <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center;">
                    <div style="color:var(--text-muted);font-size:0.84rem;">
                        آخر تحديث: ${escapeValue(formatUpdatedAt(product.updatedAt || product.createdAt))}
                    </div>

                    <button type="button" class="btn btn-primary btn-sm save-accessory-btn" data-id="${product.id}">
                        حفظ التعديلات
                    </button>
                </div>
            </article>
        `;
    }

    function renderAccessories() {
        ensureAccessoryCategories();

        const state = getState();
        const products = getProducts();
        syncDrafts(products);

        const lowStockCount = products.filter((product) => Number(product.quantity || 0) <= Number(product.lowStockAlert || 0)).length;

        A.adminContent.innerHTML = `
            <div class="admin-panel" style="margin-bottom:18px;">
                <div class="panel-body" style="display:grid;gap:14px;">
                    <div style="display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap;align-items:center;">
                        <div>
                            <h2 style="margin:0 0 6px;">${escapeValue(accessoryCatalog.sectionName)}</h2>
                            <p style="margin:0;color:var(--text-muted);font-size:0.95rem;">
                                هذا نظام ثانٍ مستقل عن الفئات. المنتجات التي تضيفها هنا تظهر مباشرة ضمن الإكسسوارات دون الحاجة لإدخالها يدويًا داخل شجرة الفئات.
                            </p>
                        </div>

                        <div style="display:flex;gap:12px;flex-wrap:wrap;color:var(--text-muted);font-size:0.9rem;">
                            <span>المنتجات: <strong style="color:var(--text-color);">${products.length}</strong></span>
                            <span>التصنيف الظاهر: <strong style="color:var(--text-color);">${escapeValue(accessoryCatalog.publicLabel)}</strong></span>
                            <span>المخزون المنخفض: <strong style="color:#e74c3c;">${lowStockCount}</strong></span>
                        </div>
                    </div>

                    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px;">
                        <div style="background:var(--bg-lighter);border:1px solid var(--border-color);border-radius:14px;padding:14px;display:grid;gap:8px;">
                            <div style="font-size:0.82rem;color:var(--text-muted);">طبيعة هذا القسم</div>
                            <strong>قسم مباشر داخل صفحة المنتجات</strong>
                            <div style="font-size:0.9rem;color:var(--text-muted);">أي منتج يضاف هنا سيظهر في قسم الإكسسوارات المستقل دون ربطه بفئة فرعية يدوية.</div>
                        </div>
                        <div style="background:var(--bg-lighter);border:1px solid var(--border-color);border-radius:14px;padding:14px;display:grid;gap:8px;">
                            <div style="font-size:0.82rem;color:var(--text-muted);">أمثلة مناسبة</div>
                            <strong>ماوس، كيبورد، سماعات، كابلات، قواعد لابتوب، ماوس باد</strong>
                            <div style="font-size:0.9rem;color:var(--text-muted);">استخدم هذا القسم عندما تريد عرض الإكسسوارات مباشرة كجزء مستقل داخل المتجر.</div>
                        </div>
                        <div style="background:var(--bg-lighter);border:1px solid var(--border-color);border-radius:14px;padding:14px;display:grid;gap:8px;">
                            <div style="font-size:0.82rem;color:var(--text-muted);">النظام الأول</div>
                            <strong>يبقى كما هو</strong>
                            <div style="font-size:0.9rem;color:var(--text-muted);">إدارة المنتجات المرتبطة بفئة رئيسية ثم فرعية ما زالت متاحة داخل قسم المنتجات المعتاد.</div>
                        </div>
                    </div>
                </div>
            </div>

            ${state.error ? `
                <div style="margin-bottom:18px;background:rgba(231,76,60,0.12);border:1px solid rgba(231,76,60,0.25);border-radius:14px;padding:14px 16px;color:#e74c3c;text-align:center;">
                    ${escapeValue(state.error)}
                </div>
            ` : ''}

            <div class="admin-panel" style="margin-bottom:18px;">
                <div class="panel-header">
                    <h2><i class="fas fa-plus-circle"></i> إضافة منتج إكسسوارات</h2>
                </div>
                <div class="panel-body padded">
                    <p style="margin:0 0 14px;color:var(--text-muted);">
                        أدخل بيانات المنتج مباشرة، وسيتم ربطه داخليًا بقسم الإكسسوارات ليظهر في الواجهة العامة الحديثة.
                    </p>

                    <form id="accessoryCreateForm" style="display:grid;gap:12px;">
                        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;">
                            <div style="display:grid;gap:6px;">
                                <label style="font-size:0.85rem;color:var(--text-muted);font-weight:700;">اسم المنتج *</label>
                                <input required data-field="name" value="${escapeValue(state.form.name)}" placeholder="مثال: ماوس لاسلكي RGB" style="padding:11px 12px;border-radius:10px;border:1px solid var(--border-color);background:var(--bg-lighter);color:var(--text-color);">
                            </div>
                            <div style="display:grid;gap:6px;">
                                <label style="font-size:0.85rem;color:var(--text-muted);font-weight:700;">العلامة التجارية</label>
                                <input data-field="brand" value="${escapeValue(state.form.brand)}" placeholder="Logitech / Redragon / HP ..." style="padding:11px 12px;border-radius:10px;border:1px solid var(--border-color);background:var(--bg-lighter);color:var(--text-color);">
                            </div>
                            <div style="display:grid;gap:6px;">
                                <label style="font-size:0.85rem;color:var(--text-muted);font-weight:700;">السعر *</label>
                                <input required type="number" min="0" step="0.01" data-field="price" value="${escapeValue(state.form.price)}" placeholder="0.00" style="padding:11px 12px;border-radius:10px;border:1px solid var(--border-color);background:var(--bg-lighter);color:var(--text-color);">
                            </div>
                            <div style="display:grid;gap:6px;">
                                <label style="font-size:0.85rem;color:var(--text-muted);font-weight:700;">سعر الخصم</label>
                                <input type="number" min="0" step="0.01" data-field="discountPrice" value="${escapeValue(state.form.discountPrice)}" placeholder="اختياري" style="padding:11px 12px;border-radius:10px;border:1px solid var(--border-color);background:var(--bg-lighter);color:var(--text-color);">
                            </div>
                            <div style="display:grid;gap:6px;">
                                <label style="font-size:0.85rem;color:var(--text-muted);font-weight:700;">الكمية *</label>
                                <input required type="number" min="0" step="1" data-field="quantity" value="${escapeValue(state.form.quantity)}" placeholder="0" style="padding:11px 12px;border-radius:10px;border:1px solid var(--border-color);background:var(--bg-lighter);color:var(--text-color);">
                            </div>
                            <div style="display:grid;gap:6px;">
                                <label style="font-size:0.85rem;color:var(--text-muted);font-weight:700;">حد التنبيه</label>
                                <input type="number" min="0" step="1" data-field="lowStockAlert" value="${escapeValue(state.form.lowStockAlert)}" placeholder="5" style="padding:11px 12px;border-radius:10px;border:1px solid var(--border-color);background:var(--bg-lighter);color:var(--text-color);">
                            </div>
                            <div style="display:grid;gap:6px;">
                                <label style="font-size:0.85rem;color:var(--text-muted);font-weight:700;">الحالة</label>
                                <select data-field="status" style="padding:11px 12px;border-radius:10px;border:1px solid var(--border-color);background:var(--bg-lighter);color:var(--text-color);">
                                    <option value="active" ${state.form.status === 'active' ? 'selected' : ''}>active</option>
                                    <option value="inactive" ${state.form.status === 'inactive' ? 'selected' : ''}>inactive</option>
                                </select>
                            </div>
                        </div>

                        <div style="display:grid;gap:6px;">
                            <label style="font-size:0.85rem;color:var(--text-muted);font-weight:700;">وصف مختصر</label>
                            <textarea rows="3" data-field="description" placeholder="وصف سريع يوضح ماهية المنتج وفائدته الأساسية." style="padding:11px 12px;border-radius:10px;border:1px solid var(--border-color);background:var(--bg-lighter);color:var(--text-color);resize:vertical;min-height:96px;">${escapeValue(state.form.description)}</textarea>
                        </div>

                        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
                            <button type="submit" class="btn btn-primary">
                                إضافة المنتج مباشرة
                            </button>
                            <a href="http://localhost:3000/products#accessories-products" target="_blank" rel="noopener noreferrer" class="btn btn-outline">
                                معاينة صفحة المنتجات الحديثة
                            </a>
                        </div>
                    </form>
                </div>
            </div>

            <div class="admin-panel">
                <div class="panel-header">
                    <h2><i class="fas fa-headphones"></i> قائمة منتجات الإكسسوارات</h2>
                    <div style="color:var(--text-muted);font-size:0.9rem;">
                        العناصر الظاهرة الآن: <strong id="visibleAccessoriesCount" style="color:var(--text-color);">${products.length}</strong>
                    </div>
                </div>
                <div class="panel-body padded" style="display:grid;gap:14px;">
                    <p style="margin:0;color:var(--text-muted);">
                        ابحث ثم عدّل المنتجات التي تظهر مباشرة ضمن الإكسسوارات في الواجهة الحديثة.
                    </p>

                    <input
                        type="search"
                        id="accessorySearchInput"
                        value="${escapeValue(state.search)}"
                        placeholder="ابحث باسم المنتج أو العلامة التجارية..."
                        style="padding:11px 12px;border-radius:10px;border:1px solid var(--border-color);background:var(--bg-lighter);color:var(--text-color);min-width:240px;"
                    >

                    <div id="accessoriesEmptyState" style="display:${products.length ? 'none' : 'block'};text-align:center;padding:2rem;color:var(--text-muted);">
                        لا توجد منتجات إكسسوارات مطابقة.
                    </div>

                    <div id="accessoriesList" style="display:${products.length ? 'grid' : 'none'};gap:12px;">
                        ${products.map((product) => renderAccessoryCard(product, state.drafts[product.id] || buildDraft(product))).join('')}
                    </div>
                </div>
            </div>
        `;

        bindAccessoryEvents();
    }

    function bindAccessoryEvents() {
        const state = getState();
        const createForm = document.getElementById('accessoryCreateForm');
        const searchInput = document.getElementById('accessorySearchInput');
        const list = document.getElementById('accessoriesList');
        const emptyState = document.getElementById('accessoriesEmptyState');
        const visibleCount = document.getElementById('visibleAccessoriesCount');

        function applySearchFilter() {
            if (!list) return;

            const query = (searchInput?.value || '').trim().toLowerCase();
            state.search = searchInput?.value || '';
            let visible = 0;

            list.querySelectorAll('.accessory-item').forEach((card) => {
                const matches = !query || (card.dataset.searchText || '').includes(query);
                card.style.display = matches ? '' : 'none';
                if (matches) visible += 1;
            });

            if (visibleCount) visibleCount.textContent = String(visible);
            if (emptyState) emptyState.style.display = visible === 0 ? 'block' : 'none';
            if (list) list.style.display = visible === 0 ? 'none' : 'grid';
        }

        function showError(message) {
            state.error = message;
            renderAccessories();
        }

        if (createForm) {
            createForm.addEventListener('input', function (event) {
                const field = event.target?.dataset?.field;
                if (!field) return;
                state.form[field] = event.target.value;
            });

            createForm.addEventListener('change', function (event) {
                const field = event.target?.dataset?.field;
                if (!field) return;
                state.form[field] = event.target.value;
            });

            createForm.addEventListener('submit', function (event) {
                event.preventDefault();

                const payload = buildProductPayload(state.form);
                const error = validatePayload(payload);
                if (error) {
                    showError(error);
                    return;
                }

                const actorId = getActorId();
                state.error = '';

                const newProduct = {
                    id: TZ.generateId('acc-'),
                    name: payload.name,
                    brand: payload.brand,
                    price: payload.price,
                    discountPrice: payload.discountPrice,
                    quantity: payload.quantity,
                    status: payload.status,
                    description: payload.description,
                    lowStockAlert: payload.lowStockAlert,
                    productType: 'accessory',
                    categoryId: accessoryCatalog.subcategoryId,
                    specs: [],
                    images: [],
                    variants: [],
                    rating: 0,
                    sold: 0,
                    createdAt: TZ.nowIso(),
                    updatedAt: TZ.nowIso()
                };

                TZ.db.products.push(newProduct);
                TZ.commitDb('product_create', actorId, newProduct.name, { type: 'product', data: newProduct });

                state.form = { ...EMPTY_FORM };
                state.drafts[newProduct.id] = buildDraft(newProduct);
                A.showToast('تمت إضافة منتج الإكسسوارات بنجاح.');
                renderAccessories();
            });
        }

        if (searchInput) {
            searchInput.addEventListener('input', applySearchFilter);
        }

        if (list) {
            list.addEventListener('input', function (event) {
                const productId = event.target?.dataset?.productId;
                const field = event.target?.dataset?.field;
                if (!productId || !field) return;

                if (!state.drafts[productId]) {
                    const product = TZ.getProductById(productId);
                    state.drafts[productId] = buildDraft(product || {});
                }

                state.drafts[productId][field] = event.target.value;
            });

            list.addEventListener('change', function (event) {
                const productId = event.target?.dataset?.productId;
                const field = event.target?.dataset?.field;
                if (!productId || !field) return;

                if (!state.drafts[productId]) {
                    const product = TZ.getProductById(productId);
                    state.drafts[productId] = buildDraft(product || {});
                }

                state.drafts[productId][field] = event.target.value;
            });

            list.addEventListener('click', function (event) {
                const button = event.target.closest('.save-accessory-btn');
                if (!button) return;

                const id = button.dataset.id;
                const product = TZ.db.products.find((item) => item.id === id);
                if (!product) {
                    showError('تعذر العثور على المنتج المطلوب.');
                    return;
                }

                const payload = buildProductPayload(state.drafts[id] || buildDraft(product));
                const error = validatePayload(payload);
                if (error) {
                    showError(error);
                    return;
                }

                state.error = '';
                state.savingId = id;

                Object.assign(product, {
                    name: payload.name,
                    brand: payload.brand,
                    price: payload.price,
                    discountPrice: payload.discountPrice,
                    quantity: payload.quantity,
                    status: payload.status,
                    description: payload.description,
                    lowStockAlert: payload.lowStockAlert,
                    productType: 'accessory',
                    categoryId: accessoryCatalog.subcategoryId,
                    updatedAt: TZ.nowIso()
                });

                TZ.commitDb('product_update', getActorId(), product.name, { type: 'product', data: product });
                state.drafts[id] = buildDraft(product);
                state.savingId = '';
                A.showToast('تم حفظ تعديلات المنتج.');
                renderAccessories();
            });
        }

        applySearchFilter();
    }

    A.sections.accessories = renderAccessories;
})();
