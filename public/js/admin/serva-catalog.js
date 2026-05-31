/**
 * TechZone Admin - Serva-S catalog import section.
 *
 * Lets admins browse the provider catalog, map services into local categories,
 * and import one or many services into the local `services` table.
 */
(function () {
    'use strict';

    const A = window.AdminApp;
    if (!A) return;

    const PROVIDER_CATALOG_API = '/api/provider/services';
    const LOCAL_SERVICES_TABLE = 'services';
    const CATEGORIES_TABLE = 'categories';
    const MAX_SAFE_QUANTITY = 1000000;
    const state = {
        catalog: [],
        categories: [],
        existingIds: new Set(),
        selectedIds: new Set(),
        filterCategory: '',
        searchQuery: ''
    };

    /**
     * Escapes dynamic text before inserting it into admin HTML.
     *
     * @param {unknown} value
     * @returns {string}
     */
    function esc(value) {
        if (window.TZ && typeof TZ.escapeHtml === 'function') {
            return TZ.escapeHtml(value == null ? '' : String(value));
        }

        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * Returns a valid admin bearer token.
     *
     * @returns {Promise<string>}
     */
    async function getAuthToken() {
        const { data } = await TZ.supabase.auth.getSession();
        return data?.session?.access_token || '';
    }

    /**
     * Resolves the local API base URL when the admin shell runs on a split port.
     *
     * @returns {string}
     */
    function getApiBaseUrl() {
        const apiPort = window.__TZ_API_PORT || '3000';
        const currentPort = window.location.port;
        return currentPort && currentPort !== apiPort ? `http://localhost:${apiPort}` : '';
    }

    /**
     * Sanitizes free-form provider text before storing it locally.
     *
     * @param {unknown} value
     * @returns {string}
     */
    function sanitizeText(value) {
        return String(value || '').replace(/<[^>]*>/g, '').trim().slice(0, 500);
    }

    /**
     * Generates a URL-safe slug fragment.
     *
     * @param {string} text
     * @returns {string}
     */
    function slugify(text) {
        return String(text || '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^\u0600-\u06FFa-z0-9-]/g, '')
            .replace(/-+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 60);
    }

    /**
     * Clamps one candidate quantity into a safe positive integer range.
     *
     * @param {unknown} value
     * @param {number} fallback
     * @param {number} max
     * @returns {number}
     */
    function safePositiveInt(value, fallback, max) {
        const parsed = Math.floor(Number(value));
        if (!Number.isFinite(parsed) || parsed < 1) return fallback;
        return Math.min(parsed, max);
    }

    /**
     * Generates a local id with a fixed prefix.
     *
     * @param {string} prefix
     * @returns {string}
     */
    function generateId(prefix) {
        return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
    }

    /**
     * Returns the stable provider service identifier as a string.
     *
     * @param {Record<string, unknown>} service
     * @returns {string}
     */
    function getProviderServiceId(service) {
        return String(service?.service ?? '').trim();
    }

    /**
     * Returns a safe DOM id for the status cell of one provider service.
     *
     * @param {string} serviceId
     * @returns {string}
     */
    function getServiceStatusCellId(serviceId) {
        return `servaStatus_${String(serviceId || '').replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    }

    /**
     * Returns the best Arabic-facing service name from the provider row.
     *
     * @param {Record<string, unknown>} service
     * @returns {string}
     */
    function getProviderServiceName(service) {
        return String(service?.name_ar || service?.name || 'خدمة بدون اسم').trim();
    }

    /**
     * Returns the provider category label for filtering and display.
     *
     * @param {Record<string, unknown>} service
     * @returns {string}
     */
    function getProviderCategory(service) {
        return String(service?.category || '').trim();
    }

    /**
     * Fetches the provider catalog through the secured server route.
     *
     * @returns {Promise<Array<Record<string, unknown>>>}
     */
    async function fetchProviderCatalog() {
        const token = await getAuthToken();
        const response = await fetch(`${getApiBaseUrl()}${PROVIDER_CATALOG_API}`, {
            headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(payload.error || `تعذر تحميل كتالوج Serva-S (${response.status}).`);
        }

        return Array.isArray(payload.services) ? payload.services : [];
    }

    /**
     * Loads active local categories for mapping provider services.
     *
     * @returns {Promise<Array<Record<string, unknown>>>}
     */
    async function fetchLocalCategories() {
        const result = await TZ.supabase
            .from(CATEGORIES_TABLE)
            .select('id, name, parent_id, sort_order')
            .eq('status', 'active')
            .order('sort_order', { ascending: true });

        if (result.error) throw result.error;
        return result.data || [];
    }

    /**
     * Collects one de-duplicated set of non-empty provider ids from query rows.
     *
     * @param {Array<Record<string, unknown>> | null | undefined} rows
     * @returns {Set<string>}
     */
    function collectExistingProviderIds(rows) {
        return new Set(
            (Array.isArray(rows) ? rows : [])
                .map((row) => String(row?.provider_service_id || '').trim())
                .filter(Boolean)
        );
    }

    /**
     * Loads the local provider-linked service ids already imported into the site.
     *
     * @returns {Promise<Set<string>>}
     */
    async function fetchExistingProviderIds() {
        const result = await TZ.supabase
            .from(LOCAL_SERVICES_TABLE)
            .select('provider_service_id');

        if (result.error) throw result.error;
        return collectExistingProviderIds(result.data);
    }

    /**
     * Returns the filtered provider catalog for the current search and category state.
     *
     * @returns {Array<Record<string, unknown>>}
     */
    function getFilteredCatalog() {
        const normalizedQuery = state.searchQuery.trim().toLowerCase();
        return state.catalog.filter((service) => {
            const serviceId = getProviderServiceId(service).toLowerCase();
            const name = getProviderServiceName(service).toLowerCase();
            const category = getProviderCategory(service);
            const matchesCategory = !state.filterCategory || category === state.filterCategory;
            const matchesSearch = !normalizedQuery || name.includes(normalizedQuery) || serviceId.includes(normalizedQuery);
            return matchesCategory && matchesSearch;
        });
    }

    /**
     * Returns all unique provider categories sorted alphabetically.
     *
     * @returns {string[]}
     */
    function getCatalogCategories() {
        return [...new Set(state.catalog.map(getProviderCategory).filter(Boolean))].sort((first, second) => first.localeCompare(second, 'ar'));
    }

    /**
     * Builds category options for the local site category selector.
     *
     * @returns {string}
     */
    function buildCategoryOptions() {
        const byId = new Map(state.categories.map((category) => [category.id, category]));
        const options = state.categories.map((category) => {
            const parent = category.parent_id ? byId.get(category.parent_id) : null;
            const label = parent ? `${parent.name} / ${category.name}` : category.name;
            return `<option value="${esc(category.id)}">${esc(label)}</option>`;
        });

        return ['<option value="">اختر الفئة التي ستستقبل الخدمات</option>', ...options].join('');
    }

    /**
     * Builds the local insert payload for one provider service row.
     *
     * @param {Record<string, unknown>} service
     * @param {string} categoryId
     * @returns {Record<string, unknown>}
     */
    function buildLocalServiceRow(service, categoryId) {
        const name = sanitizeText(service.name_ar || service.name);
        const providerId = String(service.service || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
        const selectedCategory = state.categories.find((category) => category.id === categoryId);
        if (!name || !providerId) {
            throw new Error('بيانات الخدمة غير صالحة لأن الاسم أو المعرّف مفقود.');
        }
        if (!selectedCategory) {
            throw new Error('اختر الفئة المحلية التي ستستقبل الخدمات أولًا.');
        }

        const resolvedCategoryId = selectedCategory.parent_id || selectedCategory.id;
        const resolvedSubcategoryId = selectedCategory.parent_id ? selectedCategory.id : null;

        return {
            id: generateId('srv-'),
            name,
            slug: `${slugify(name)}-${providerId}`.slice(0, 90),
            category_id: resolvedCategoryId,
            subcategory_id: resolvedSubcategoryId,
            provider_service_id: providerId,
            price: Math.max(0, parseFloat(service.rate) || 0),
            cost_price: Math.max(0, parseFloat(service.rate) || 0),
            min_qty: safePositiveInt(service.min, 1, MAX_SAFE_QUANTITY),
            max_qty: safePositiveInt(service.max, 1000, MAX_SAFE_QUANTITY),
            description: sanitizeText(service.name_en || service.name_ar || service.name),
            image: sanitizeText(service.image || service.icon || '') || null,
            status: 'active',
            sort_order: 0,
            metadata: {
                link_required: Boolean(service.link_required),
                provider_fields: Array.isArray(service.fields) ? service.fields : [],
                pricing_type: String(service.pricing_type || 'default').slice(0, 32),
                has_quantity: Boolean(service.has_quantity),
                provider_category: getProviderCategory(service)
            }
        };
    }

    /**
     * Imports one provider service into the local services table.
     *
     * @param {Record<string, unknown>} service
     * @param {string} categoryId
     * @returns {Promise<void>}
     */
    async function importService(service, categoryId) {
        const token = await getAuthToken();
        if (!token) throw new Error('انتهت الجلسة. أعد تسجيل الدخول ثم حاول مرة أخرى.');

        const response = await fetch('/api/admin/db', {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                type: 'mutation',
                action: 'insert',
                table: LOCAL_SERVICES_TABLE,
                values: [buildLocalServiceRow(service, categoryId)]
            })
        });

        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload.error) {
            throw new Error(payload.error?.message || payload.error || 'فشل حفظ الخدمة عبر المسار الإداري الآمن.');
        }
    }

    /**
     * Returns one safe count of selected services that are visible in the current filter.
     *
     * @param {Array<Record<string, unknown>>} filtered
     * @returns {number}
     */
    function getVisibleSelectedCount(filtered) {
        return filtered.reduce((count, service) => count + (state.selectedIds.has(getProviderServiceId(service)) ? 1 : 0), 0);
    }

    /**
     * Renders the full Serva-S import experience.
     *
     * @returns {void}
     */
    function renderCatalog() {
        const filtered = getFilteredCatalog();
        const categories = getCatalogCategories();
        const importedCount = filtered.filter((service) => state.existingIds.has(getProviderServiceId(service))).length;
        const visibleSelectedCount = getVisibleSelectedCount(filtered);

        A.adminContent.innerHTML = `
            <div class="admin-section-header">
                <div>
                    <h2><i class="fas fa-cloud-download-alt"></i> استيراد خدمات Serva-S</h2>
                    <p>أضف خدمات المزود إلى موقعك بأرقام المزود الأصلية، مع ربط كل خدمة بفئة محلية داخل المتجر.</p>
                </div>
                <div class="admin-section-actions">
                    <button class="btn btn-outline btn-sm" id="servaRefreshBtn"><i class="fas fa-rotate"></i> تحديث الكتالوج</button>
                    <button class="btn btn-outline btn-sm" id="servaGoToServicesBtn"><i class="fas fa-table-list"></i> إدارة الكتالوج</button>
                </div>
            </div>
            <div class="admin-orders-summary">
                <div class="admin-orders-stat"><span><i class="fas fa-layer-group"></i> إجمالي المزود</span><strong>${state.catalog.length}</strong></div>
                <div class="admin-orders-stat"><span><i class="fas fa-filter"></i> ظاهر الآن</span><strong>${filtered.length}</strong></div>
                <div class="admin-orders-stat"><span><i class="fas fa-check-circle"></i> مضاف محليًا</span><strong>${importedCount}</strong></div>
                <div class="admin-orders-stat admin-orders-stat--highlight"><span><i class="fas fa-list-check"></i> محدد الآن</span><strong>${visibleSelectedCount}</strong></div>
            </div>
            <div class="filter-bar admin-orders-toolbar">
                <input type="search" id="servaCatalogSearch" placeholder="ابحث باسم الخدمة أو رقم المزود..." value="${esc(state.searchQuery)}">
                <select id="servaCatalogFilter"><option value="">كل فئات المزود</option>${categories.map((category) => `<option value="${esc(category)}"${state.filterCategory === category ? ' selected' : ''}>${esc(category)}</option>`).join('')}</select>
                <select id="servaTargetCategory">${buildCategoryOptions()}</select>
                <button class="btn btn-primary btn-sm" id="servaImportSelectedBtn"${state.selectedIds.size === 0 ? ' disabled' : ''}><i class="fas fa-plus"></i> استيراد المحدد (${state.selectedIds.size})</button>
            </div>
            <div class="admin-panel admin-orders-panel">
                <div class="panel-body">
                    <div class="table-wrap admin-orders-table-wrap">
                        <table class="data-table admin-orders-table">
                            <thead>
                                <tr>
                                    <th style="width:46px;"><input type="checkbox" id="servaSelectAll"${filtered.length > 0 && visibleSelectedCount === filtered.length ? ' checked' : ''}></th>
                                    <th>رقم المزود</th>
                                    <th>اسم الخدمة</th>
                                    <th>فئة المزود</th>
                                    <th>السعر</th>
                                    <th>الحدود</th>
                                    <th>الحالة</th>
                                    <th>إجراء</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${filtered.length === 0 ? '<tr><td colspan="8"><div class="empty-state"><i class="fas fa-inbox"></i><p>لا توجد خدمات مطابقة لبحثك الحالي.</p></div></td></tr>' : filtered.map((service) => {
                                    const serviceId = getProviderServiceId(service);
                                    const isImported = state.existingIds.has(serviceId);
                                    return `<tr data-service-id="${esc(serviceId)}">
                                        <td><input type="checkbox" class="serva-check" data-service-id="${esc(serviceId)}"${state.selectedIds.has(serviceId) ? ' checked' : ''}></td>
                                        <td><code>${esc(serviceId)}</code></td>
                                        <td><strong>${esc(getProviderServiceName(service))}</strong></td>
                                        <td>${esc(getProviderCategory(service) || '-')}</td>
                                        <td><strong>$${(parseFloat(service.rate || 0) || 0).toFixed(2)}</strong></td>
                                        <td>${esc(`${safePositiveInt(service.min, 1, MAX_SAFE_QUANTITY)} - ${safePositiveInt(service.max, 1000, MAX_SAFE_QUANTITY)}`)}</td>
                                        <td id="${esc(getServiceStatusCellId(serviceId))}">${isImported ? '<span class="status-badge completed">مضاف</span>' : '<span class="status-badge pending">جاهز للاستيراد</span>'}</td>
                                        <td class="actions-cell"><button class="btn btn-outline btn-sm serva-import-one-btn" data-service-id="${esc(serviceId)}"${isImported ? ' disabled' : ''}><i class="fas fa-plus"></i> ${isImported ? 'موجود' : 'استيراد'}</button></td>
                                    </tr>`;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        bindCatalogEvents(filtered);
    }

    /**
     * Imports one or many selected provider services into the local catalog.
     *
     * @param {string[]} serviceIds
     * @returns {Promise<void>}
     */
    async function importByIds(serviceIds) {
        const targetCategoryId = String(document.getElementById('servaTargetCategory')?.value || '').trim();
        if (!targetCategoryId) {
            A.showErrorToast?.('SRV-101', 'اختر الفئة المحلية التي ستستقبل الخدمات أولًا.');
            return;
        }

        let added = 0;
        let skipped = 0;
        let failed = 0;

        for (const serviceId of serviceIds) {
            const service = state.catalog.find((candidate) => getProviderServiceId(candidate) === serviceId);
            if (!service) continue;
            if (state.existingIds.has(serviceId)) {
                skipped++;
                continue;
            }

            try {
                await importService(service, targetCategoryId);
                state.existingIds.add(serviceId);
                state.selectedIds.delete(serviceId);
                added++;
            } catch (error) {
                console.error('[SVC-401] Failed to import provider service.', serviceId, error);
                failed++;
            }
        }

        A.showToast(`تمت إضافة ${added} خدمة، وتخطي ${skipped}، وفشل ${failed}.`);
        await TZ.refreshData();
        renderCatalog();
    }

    /**
     * Binds DOM events after rendering the catalog section.
     *
     * @param {Array<Record<string, unknown>>} filtered
     * @returns {void}
     */
    function bindCatalogEvents(filtered) {
        document.getElementById('servaCatalogSearch')?.addEventListener('input', function () {
            state.searchQuery = this.value;
            renderCatalog();
        });
        document.getElementById('servaCatalogFilter')?.addEventListener('change', function () {
            state.filterCategory = this.value;
            renderCatalog();
        });
        document.getElementById('servaRefreshBtn')?.addEventListener('click', async function () {
            this.disabled = true;
            this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جار تحديث الكتالوج...';
            try {
                const [catalog, categories, existingIds] = await Promise.all([
                    fetchProviderCatalog(),
                    fetchLocalCategories(),
                    fetchExistingProviderIds()
                ]);
                state.catalog = catalog;
                state.categories = categories;
                state.existingIds = existingIds;
                A.showToast('تم تحديث كتالوج Serva-S بنجاح.');
            } catch (error) {
                A.showErrorToast?.('SRV-301', error?.message || 'تعذر تحديث كتالوج المزود.');
            }
            renderCatalog();
        });
        document.getElementById('servaGoToServicesBtn')?.addEventListener('click', function () {
            A.renderSection?.('catalog');
        });
        document.getElementById('servaSelectAll')?.addEventListener('change', function () {
            filtered.forEach((service) => {
                const serviceId = getProviderServiceId(service);
                if (!serviceId || state.existingIds.has(serviceId)) return;
                if (this.checked) state.selectedIds.add(serviceId);
                else state.selectedIds.delete(serviceId);
            });
            renderCatalog();
        });
        document.querySelectorAll('.serva-check').forEach((checkbox) => {
            checkbox.addEventListener('change', function () {
                const serviceId = String(this.dataset.serviceId || '').trim();
                if (!serviceId || state.existingIds.has(serviceId)) return;
                if (this.checked) state.selectedIds.add(serviceId);
                else state.selectedIds.delete(serviceId);
                renderCatalog();
            });
        });
        document.getElementById('servaImportSelectedBtn')?.addEventListener('click', async function () {
            if (state.selectedIds.size === 0) return;
            this.disabled = true;
            this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جار الاستيراد...';
            await importByIds([...state.selectedIds]);
        });
        document.querySelectorAll('.serva-import-one-btn').forEach((button) => {
            button.addEventListener('click', async function () {
                const serviceId = String(this.dataset.serviceId || '').trim();
                if (!serviceId || this.disabled) return;
                this.disabled = true;
                this.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                await importByIds([serviceId]);
            });
        });
    }

    /**
     * Entry point used by the legacy admin shell.
     *
     * @returns {Promise<void>}
     */
    A.sections['serva-catalog'] = async function renderServaCatalogSection() {
        A.adminContent.innerHTML = '<div class="empty-state"><i class="fas fa-spinner fa-spin" style="font-size:2rem;"></i><p>جار تحميل كتالوج Serva-S...</p></div>';

        try {
            const [catalog, categories, existingIds] = await Promise.all([
                fetchProviderCatalog(),
                fetchLocalCategories(),
                fetchExistingProviderIds()
            ]);
            state.catalog = catalog;
            state.categories = categories;
            state.existingIds = existingIds;
            renderCatalog();
        } catch (error) {
            A.adminContent.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle" style="font-size:2rem;color:var(--admin-danger);"></i><p>تعذر تحميل خدمات المزود.</p><p style="font-size:0.9rem;opacity:0.8;">${esc(error?.message || 'حدث خطأ غير متوقع.')}</p><button class="btn btn-primary btn-sm" id="servaRetryBtn"><i class="fas fa-rotate-right"></i> إعادة المحاولة</button></div>`;
            document.getElementById('servaRetryBtn')?.addEventListener('click', function () {
                A.sections['serva-catalog']();
            });
        }
    };

    if (window.__ENABLE_SERVA_CATALOG_TEST_HOOKS__) {
        window.__servaCatalogTestHooks = {
            buildLocalServiceRow,
            collectExistingProviderIds,
            esc,
            getProviderCategory,
            getProviderServiceId,
            getProviderServiceName,
            getServiceStatusCellId,
            safePositiveInt,
            setCategoriesForTests(categories) {
                state.categories = Array.isArray(categories) ? categories : [];
            },
            sanitizeText,
            slugify
        };
    }
})();
