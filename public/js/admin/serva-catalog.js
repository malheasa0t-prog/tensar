// ===== TechZone Admin - Serva-S Catalog =====
// Allows importing digital services from Serva-S provider API into the local database.
(function () {
    'use strict';

    const A = window.AdminApp;
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
     * Adds a single digital service to the local database.
     *
     * @param {object} service - Serva-S service object
     * @param {string} categoryId - Target local category ID
     * @returns {Promise<void>}
     */
    async function addServiceToLocal(service, categoryId) {
        const price = parseFloat(service.rate) || 0;
        const providerFields = Array.isArray(service.fields) ? service.fields : [];
        const linkRequired = Boolean(service.link_required);

        const row = {
            id: generateId('srv-'),
            name: service.name_ar || service.name,
            slug: slugify(service.name_ar || service.name || '') + '-' + service.service,
            category_id: categoryId,
            provider_service_id: String(service.service),
            price: price,
            cost_price: price,
            min_qty: service.min || 1,
            max_qty: service.max || 1000,
            description: service.name_en || (service.name_ar || service.name),
            status: 'active',
            sort_order: 0,
            image: service.image || service.icon || null, // <-- السطر الجديد لجلب الصورة
            metadata: {
                link_required: linkRequired,
                provider_fields: providerFields,
                pricing_type: service.pricing_type || 'default',
                has_quantity: Boolean(service.has_quantity),
            },
        };

        const { error } = await TZ.supabase.from(LOCAL_SERVICES_TABLE).insert(row);
        if (error) throw error;
    }

    /**
     * Returns unique categories from the catalog.
     *
     * @returns {string[]}
     */
    function getCatalogCategories() {
        return [...new Set(catalogData.map(s => (s.category || '').trim()).filter(Boolean))].sort();
    }

    /**
     * Filters catalog based on current search & category filter.
     *
     * @returns {Array}
     */
    function getFilteredCatalog() {
        return catalogData.filter(service => {
            const name = (service.name_ar || service.name || '').toLowerCase();
            const cat = (service.category || '').trim();
            const matchesCategory = !filterCategory || cat === filterCategory;
            const matchesSearch = !searchQuery || name.includes(searchQuery.toLowerCase()) || String(service.service).includes(searchQuery);
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
            options += `<optgroup label="${parent.name}">`;
            const subs = children.filter(c => c.parent_id === parent.id);
            for (const sub of subs) {
                options += `<option value="${sub.id}">${sub.name}</option>`;
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
                    <input type="search" id="servaCatalogSearch" placeholder="ابحث بالاسم أو رقم الخدمة..." value="${searchQuery}">
                </div>
                <div class="admin-input-wrap" style="min-width:200px;">
                    <i class="fas fa-filter"></i>
                    <select id="servaCatalogFilter">
                        <option value="">كل الفئات (${catalogData.length})</option>
                        ${categories.map(c => `<option value="${c}" ${filterCategory === c ? 'selected' : ''}>${c} (${catalogData.filter(s => s.category === c).length})</option>`).join('')}
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
                            const isSelected = selectedServices.has(service.service);
                            return `<tr class="${isSelected ? 'is-selected' : ''}" data-service-id="${service.service}">
                                <td><input type="checkbox" class="serva-service-check" data-service-id="${service.service}" ${isSelected ? 'checked' : ''}></td>
                                <td><code>${service.service}</code></td>
                                <td>${service.name_ar || service.name}</td>
                                <td><span class="admin-badge">${service.category || '-'}</span></td>
                                <td><strong>$${parseFloat(service.rate || 0).toFixed(2)}</strong></td>
                                <td>${service.min || 1}</td>
                                <td>${service.max || '-'}</td>
                                <td><span class="admin-badge admin-badge--info">${service.type || '-'}</span></td>
                                <td id="servaStatus_${service.service}">-</td>
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
        const ids = services.map(s => String(s.service));
        const { data } = await TZ.supabase
            .from(LOCAL_SERVICES_TABLE)
            .select('provider_service_id')
            .in('provider_service_id', ids);

        const existing = new Set((data || []).map(d => d.provider_service_id));
        for (const id of ids) {
            const cell = document.getElementById(`servaStatus_${id}`);
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
                filtered.forEach(s => selectedServices.add(s.service));
            } else {
                filtered.forEach(s => selectedServices.delete(s.service));
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
                const service = catalogData.find(s => s.service === serviceId);
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
                    <p style="font-size:0.85rem; opacity:0.7;">${error.message}</p>
                    <button class="btn btn-primary btn-sm" onclick="AdminApp.sections['serva-catalog']()">
                        <i class="fas fa-redo"></i> إعادة المحاولة
                    </button>
                </div>
            `;
        }
    };
})();
