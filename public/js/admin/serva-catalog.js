// ===== TechZone Admin - Serva-S Catalog =====
// Allows importing digital services from Serva-S provider API into the local database.
(function () {
    'use strict';

    const A = window.AdminApp;
    if (!A) return;

    const PROVIDER_CATALOG_API = '/api/provider/services';
    const LOCAL_SERVICES_TABLE = 'services';
    const CATEGORIES_TABLE = 'categories';

    let catalogData = [];
    let localCategories = [];
    let selectedServices = new Set();
    let filterCategory = '';
    let searchQuery = '';

    /**
     * Gets the current auth token from TZ.supabase.
     *
     * @returns {Promise<string>}
     */
    async function getAuthToken() {
        const { data } = await TZ.supabase.auth.getSession();
        return data?.session?.access_token || '';
    }

    /**
     * Fetches the Serva-S service catalog from the server API.
     *
     * @returns {Promise<Array>}
     */
    async function fetchProviderCatalog() {
        const token = await getAuthToken();
        const apiPort = window.__TZ_API_PORT || '3000';
        const currentPort = window.location.port;
        const baseUrl = (currentPort !== apiPort && currentPort !== '') ? `http://localhost:${apiPort}` : '';
        const response = await fetch(`${baseUrl}${PROVIDER_CATALOG_API}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            }
        });
        if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            throw new Error(body.error || `Failed to fetch catalog: ${response.status}`);
        }
        const data = await response.json();
        return Array.isArray(data.services) ? data.services : (Array.isArray(data) ? data : []);
    }

    /**
     * Fetches local categories from Supabase.
     *
     * @returns {Promise<Array>}
     */
    async function fetchLocalCategories() {
        const { data, error } = await TZ.supabase
            .from(CATEGORIES_TABLE)
            .select('id, name, slug, parent_id')
            .eq('status', 'active')
            .order('sort_order', { ascending: true });

        if (error) throw error;
        return data || [];
    }

    /**
     * Checks if a service already exists locally by provider_service_id.
     *
     * @param {string} providerServiceId
     * @returns {Promise<boolean>}
     */
    async function serviceExistsLocally(providerServiceId) {
        const { data } = await TZ.supabase
            .from(LOCAL_SERVICES_TABLE)
            .select('id')
            .eq('provider_service_id', String(providerServiceId))
            .limit(1)
            .maybeSingle();

        return Boolean(data);
    }

    /**
     * Generates a unique ID with prefix.
     *
     * @param {string} prefix
     * @returns {string}
     */
    function generateId(prefix) {
        return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    }

    /**
     * Generates a URL-safe slug.
     *
     * @param {string} text
     * @returns {string}
     */
    function slugify(text) {
        return (text || '').trim().toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^\u0600-\u06FFa-z0-9-]/g, '')
            .replace(/-+/g, '-')
            .slice(0, 60);
    }

    /**
     * Strips HTML/script tags from an untrusted string to prevent stored XSS.
     *
     * @param {unknown} value
     * @returns {string}
     */
    function sanitizeText(value) {
        return String(value || '').replace(/<[^>]*>/g, '').trim().slice(0, 500);
    }

    /**
     * Clamps a numeric value into a safe positive integer range.
     *
     * @param {unknown} value
     * @param {number} fallback
     * @param {number} max
     * @returns {number}
     */
    function safePositiveInt(value, fallback, max) {
        const n = Math.floor(Number(value));
        if (!Number.isFinite(n) || n < 1) return fallback;
        return Math.min(n, max);
    }

    /**
     * Escapes dynamic text before placing it in the admin HTML.
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
     * Returns the stable API service identifier as a string.
     *
     * @param {Record<string, unknown>} service
     * @returns {string}
     */
    function getProviderServiceId(service) {
        return String(service?.service ?? '').trim();
    }

    /**
     * Builds a DOM-safe status cell id for one provider service.
     *
     * @param {string} serviceId
     * @returns {string}
     */
    function getServiceStatusCellId(serviceId) {
        return 'servaStatus_' + String(serviceId || '').replace(/[^a-zA-Z0-9_-]/g, '_');
    }

    /**
     * Returns the best display name for one provider service.
     *
     * @param {Record<string, unknown>} service
     * @returns {string}
     */
    function getProviderServiceName(service) {
        return String(service?.name_ar || service?.name || 'خدمة بدون اسم').trim();
    }

    /**
     * Returns the provider category name for filtering and display.
     *
     * @param {Record<string, unknown>} service
     * @returns {string}
     */
    function getProviderCategory(service) {
        return String(service?.category || '').trim();
    }

    /**
     * Adds a single digital service to the local database via Admin DB Proxy.
     *
     * @param {object} service - Serva-S service object
     * @param {string} categoryId - Target local category ID
     * @returns {Promise<void>}
     */
    async function addServiceToLocal(service, categoryId) {
        const price = Math.max(0, parseFloat(service.rate) || 0);
        const providerFields = Array.isArray(service.fields) ? service.fields : [];
        const linkRequired = Boolean(service.link_required);
        const rawName = sanitizeText(service.name_ar || service.name);
        const rawDescription = sanitizeText(service.name_en || service.name_ar || service.name);
        const providerId = String(service.service || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);

        if (!rawName || !providerId) {
            throw new Error('بيانات الخدمة غير صالحة — الاسم أو المعرّف مفقود.');
        }

        const row = {
            id: generateId('srv-'),
            name: rawName,
            slug: slugify(rawName) + '-' + providerId,
            category_id: categoryId,
            provider_service_id: providerId,
            price: price,
            cost_price: price,
            min_qty: safePositiveInt(service.min, 1, 1000000),
            max_qty: safePositiveInt(service.max, 1000, 1000000),
            description: rawDescription,
            status: 'active',
            sort_order: 0,
            image: sanitizeText(service.image || service.icon || '') || null,
            metadata: {
                link_required: linkRequired,
                provider_fields: providerFields,
                pricing_type: String(service.pricing_type || 'default').slice(0, 32),
                has_quantity: Boolean(service.has_quantity),
            },
        };

        const token = await getAuthToken();
        if (!token) throw new Error('انتهت الجلسة. أعد تسجيل الدخول.');

        const response = await fetch('/api/admin/db', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                type: 'mutation',
                action: 'insert',
                table: LOCAL_SERVICES_TABLE,
                values: [row],
            }),
        });

        const result = await response.json().catch(() => ({}));
        if (!response.ok || result.error) {
            throw new Error(result.error?.message || result.error || 'فشل إضافة الخدمة عبر الخادم الآمن.');
        }
    }

    /**
     * Returns unique categories from the catalog.
     *
     * @returns {string[]}
     */
    function getCatalogCategories() {
        return [...new Set(catalogData.map(getProviderCategory).filter(Boolean))].sort();
    }

    /**
     * Filters catalog based on current search & category filter.
     *
     * @returns {Array}
     */
    function getFilteredCatalog() {
        return catalogData.filter(service => {
            const name = getProviderServiceName(service).toLowerCase();
            const cat = getProviderCategory(service);
            const serviceId = getProviderServiceId(service);
            const normalizedQuery = searchQuery.toLowerCase();
            const matchesCategory = !filterCategory || cat === filterCategory;
            const matchesSearch = !searchQuery || name.includes(normalizedQuery) || serviceId.toLowerCase().includes(normalizedQuery);
            return matchesCategory && matchesSearch;
        });
    }

    /**
     * Builds a category select dropdown from local categories.
     *
     * @returns {string}
     */
    function buildCategoryOptions() {
        const parents = localCategories.filter(c => !c.parent_id);
        const children = localCategories.filter(c => c.parent_id);
        let options = '<option value="">-- اختر الفئة --</option>';

        for (const parent of parents) {
            options += `<optgroup label="${esc(parent.name)}">`;
            const subs = children.filter(c => c.parent_id === parent.id);
            for (const sub of subs) {
                options += `<option value="${esc(sub.id)}">${esc(sub.name)}</option>`;
            }
            options += '</optgroup>';
        }

        return options;
    }

    /**
     * Renders the full Serva-S catalog UI.
     *
     * @returns {void}
     */
    function renderCatalog() {
        const content = A.adminContent;
        const filtered = getFilteredCatalog();
        const categories = getCatalogCategories();

        content.innerHTML = `
            <div class="admin-section-header">
                <div>
                    <h2><i class="fas fa-cloud-download-alt"></i> كتالوج Serva-S</h2>
                    <p>استعرض خدمات المزود وأضف ما تريده إلى موقعك يدوياً</p>
                </div>
                <div class="admin-section-actions">
                    <button class="btn btn-outline btn-sm" id="servaCatalogRefresh">
                        <i class="fas fa-sync-alt"></i> تحديث الكتالوج
                    </button>
                    <button class="btn btn-primary btn-sm" id="servaAddSelected" ${selectedServices.size === 0 ? 'disabled' : ''}>
                        <i class="fas fa-plus"></i> إضافة المحدد (${selectedServices.size})
                    </button>
                </div>
            </div>

            <div class="admin-filters" style="display:flex; gap:1rem; margin-bottom:1.5rem; flex-wrap:wrap;">
                <div class="admin-input-wrap" style="flex:1; min-width:200px;">
                    <i class="fas fa-search"></i>
                    <input type="search" id="servaCatalogSearch" placeholder="ابحث بالاسم أو رقم الخدمة..." value="${esc(searchQuery)}">
                </div>
                <div class="admin-input-wrap" style="min-width:200px;">
                    <i class="fas fa-filter"></i>
                    <select id="servaCatalogFilter">
                        <option value="">كل الفئات (${catalogData.length})</option>
                        ${categories.map(c => `<option value="${esc(c)}" ${filterCategory === c ? 'selected' : ''}>${esc(c)} (${catalogData.filter(s => getProviderCategory(s) === c).length})</option>`).join('')}
                    </select>
                </div>
                <div class="admin-input-wrap" style="min-width:200px;">
                    <i class="fas fa-folder-open"></i>
                    <select id="servaCatalogTargetCategory">
                        ${buildCategoryOptions()}
                    </select>
                </div>
            </div>

            <div class="admin-info-bar" style="display:flex; gap:1rem; margin-bottom:1rem; align-items:center; padding:0.75rem 1rem; background:var(--admin-card-bg); border-radius:var(--radius-md); border:1px solid var(--admin-border);">
                <span><i class="fas fa-info-circle" style="color:var(--admin-accent);"></i></span>
                <span>إجمالي: <strong>${catalogData.length}</strong> خدمة | يظهر: <strong>${filtered.length}</strong> | محدد: <strong>${selectedServices.size}</strong></span>
                ${selectedServices.size > 0 ? '<button class="btn btn-outline btn-sm" id="servaClearSelection" style="margin-right:auto;"><i class="fas fa-times"></i> إلغاء التحديد</button>' : ''}
            </div>

            <div class="admin-table-wrap">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th style="width:40px;">
                                <input type="checkbox" id="servaSelectAll" title="تحديد الكل" ${selectedServices.size === filtered.length && filtered.length > 0 ? 'checked' : ''}>
                            </th>
                            <th>رقم</th>
                            <th>اسم الخدمة</th>
                            <th>الفئة</th>
                            <th>السعر ($)</th>
                            <th>الحد الأدنى</th>
                            <th>الحد الأقصى</th>
                            <th>النوع</th>
                            <th>الحالة</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filtered.length === 0 ? '<tr><td colspan="9" style="text-align:center; padding:2rem;">لا توجد خدمات مطابقة</td></tr>' : ''}
                        ${filtered.map(service => {
                            const serviceId = getProviderServiceId(service);
                            const isSelected = selectedServices.has(serviceId);
                            return `<tr class="${isSelected ? 'is-selected' : ''}" data-service-id="${esc(serviceId)}">
                                <td><input type="checkbox" class="serva-service-check" data-service-id="${esc(serviceId)}" ${isSelected ? 'checked' : ''}></td>
                                <td><code>${esc(serviceId)}</code></td>
                                <td>${esc(getProviderServiceName(service))}</td>
                                <td><span class="admin-badge">${esc(getProviderCategory(service) || '-')}</span></td>
                                <td><strong>$${parseFloat(service.rate || 0).toFixed(2)}</strong></td>
                                <td>${esc(service.min || 1)}</td>
                                <td>${esc(service.max || '-')}</td>
                                <td><span class="admin-badge admin-badge--info">${esc(service.type || '-')}</span></td>
                                <td id="${esc(getServiceStatusCellId(serviceId))}">-</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;

        bindCatalogEvents();
        checkExistingServices(filtered);
    }

    /**
     * Checks which services already exist locally and marks them.
     *
     * @param {Array} services
     * @returns {Promise<void>}
     */
    async function checkExistingServices(services) {
        const ids = services.map(getProviderServiceId).filter(Boolean);
        if (ids.length === 0) return;

        const { data } = await TZ.supabase
            .from(LOCAL_SERVICES_TABLE)
            .select('provider_service_id')
            .in('provider_service_id', ids);

        const existing = new Set((data || []).map(d => d.provider_service_id));
        for (const id of ids) {
            const cell = document.getElementById(getServiceStatusCellId(id));
            if (!cell) continue;
            if (existing.has(id)) {
                cell.innerHTML = '<span class="admin-badge admin-badge--success"><i class="fas fa-check"></i> مضافة</span>';
            } else {
                cell.innerHTML = '<span class="admin-badge admin-badge--warning">غير مضافة</span>';
            }
        }
    }

    /**
     * Binds click and change events for the catalog UI.
     *
     * @returns {void}
     */
    function bindCatalogEvents() {
        document.getElementById('servaCatalogSearch')?.addEventListener('input', function () {
            searchQuery = this.value;
            renderCatalog();
        });

        document.getElementById('servaCatalogFilter')?.addEventListener('change', function () {
            filterCategory = this.value;
            renderCatalog();
        });

        document.getElementById('servaCatalogRefresh')?.addEventListener('click', async function () {
            this.disabled = true;
            this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري التحديث...';
            try {
                catalogData = await fetchProviderCatalog();
                A.showToast('تم تحديث الكتالوج بنجاح');
            } catch (error) {
                A.showToast('فشل تحديث الكتالوج: ' + error.message);
            }
            renderCatalog();
        });

        document.getElementById('servaSelectAll')?.addEventListener('change', function () {
            const filtered = getFilteredCatalog();
            if (this.checked) {
                filtered.forEach(s => {
                    const serviceId = getProviderServiceId(s);
                    if (serviceId) selectedServices.add(serviceId);
                });
            } else {
                filtered.forEach(s => selectedServices.delete(getProviderServiceId(s)));
            }
            renderCatalog();
        });

        document.getElementById('servaClearSelection')?.addEventListener('click', function () {
            selectedServices.clear();
            renderCatalog();
        });

        document.querySelectorAll('.serva-service-check').forEach(checkbox => {
            checkbox.addEventListener('change', function () {
                const id = this.dataset.serviceId;
                if (this.checked) {
                    selectedServices.add(id);
                } else {
                    selectedServices.delete(id);
                }
                renderCatalog();
            });
        });

        document.getElementById('servaAddSelected')?.addEventListener('click', async function () {
            const targetCat = document.getElementById('servaCatalogTargetCategory')?.value;
            if (!targetCat) {
                A.showToast('الرجاء اختيار الفئة المستهدفة أولاً');
                return;
            }
            if (selectedServices.size === 0) return;

            const confirmed = await new Promise(resolve => {
                A.showConfirmModal(
                    `هل تريد إضافة ${selectedServices.size} خدمة إلى موقعك؟`,
                    () => resolve(true),
                    () => resolve(false)
                );
            });

            if (!confirmed) return;

            this.disabled = true;
            this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الإضافة...';

            let added = 0;
            let skipped = 0;
            let failed = 0;

            for (const serviceId of selectedServices) {
                const service = catalogData.find(s => getProviderServiceId(s) === serviceId);
                if (!service) continue;

                try {
                    const exists = await serviceExistsLocally(serviceId);
                    if (exists) {
                        skipped++;
                        continue;
                    }
                    await addServiceToLocal(service, targetCat);
                    added++;
                } catch (error) {
                    console.error('Failed to add service:', serviceId, error);
                    failed++;
                }
            }

            selectedServices.clear();
            A.showToast(`تمت الإضافة: ${added} | تم تخطيها (موجودة): ${skipped} | فشل: ${failed}`);
            await TZ.refreshData();
            renderCatalog();
        });
    }

    /**
     * Main section renderer. Called by the admin framework.
     *
     * @returns {void}
     */
    A.sections['serva-catalog'] = async function renderServaCatalogSection() {
        const content = A.adminContent;
        content.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-spinner fa-spin" style="font-size:2rem;"></i>
                <p>جاري تحميل كتالوج Serva-S...</p>
            </div>
        `;

        try {
            [catalogData, localCategories] = await Promise.all([
                fetchProviderCatalog(),
                fetchLocalCategories(),
            ]);
            renderCatalog();
        } catch (error) {
            content.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle" style="color:var(--admin-danger); font-size:2rem;"></i>
                    <p>فشل تحميل كتالوج المزود</p>
                    <p style="font-size:0.85rem; opacity:0.7;">${esc(error.message)}</p>
                    <button class="btn btn-primary btn-sm" id="servaCatalogRetry">
                        <i class="fas fa-redo"></i> إعادة المحاولة
                    </button>
                </div>
            `;
            document.getElementById('servaCatalogRetry')?.addEventListener('click', function () {
                A.sections['serva-catalog']();
            });
        }
    };

    if (window.__ENABLE_SERVA_CATALOG_TEST_HOOKS__) {
        window.__servaCatalogTestHooks = {
            esc,
            getProviderCategory,
            getProviderServiceId,
            getProviderServiceName,
            getServiceStatusCellId,
            safePositiveInt,
            sanitizeText,
            slugify
        };
    }
})();
