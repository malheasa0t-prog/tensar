/**
 * TechZone Admin - Catalog helpers.
 *
 * Pure helper utilities shared by the digital catalog admin section.
 */
(function () {
    'use strict';

    /**
     * Escapes one html value through the shared admin utility.
     *
     * @param {unknown} value
     * @returns {string}
     */
    function esc(value) {
        return window.TZ && typeof TZ.escapeHtml === 'function'
            ? TZ.escapeHtml(value == null ? '' : String(value))
            : String(value == null ? '' : value);
    }

    /**
     * Returns one cleaned image url/path or null.
     *
     * @param {unknown} value
     * @returns {string|null}
     */
    function normalizeCatalogImage(value) {
        var normalizedValue = String(value || '').trim();
        return normalizedValue || null;
    }

    /**
     * Builds one route-friendly slug that keeps Arabic letters.
     *
     * @param {unknown} value
     * @returns {string}
     */
    function slugifyCatalogText(value) {
        return String(value || '')
            .trim()
            .toLowerCase()
            .replace(/[\s_]+/g, '-')
            .replace(/[^\u0600-\u06FFa-z0-9-]/g, '')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .slice(0, 90);
    }

    /**
     * Generates one services-table id with the required srv- prefix.
     *
     * @param {unknown} name
     * @returns {string}
     */
    function buildCatalogServiceId(name) {
        var slug = slugifyCatalogText(name);
        var suffix = Math.random().toString(36).slice(2, 8);
        return 'srv-' + (slug || 'service') + '-' + suffix;
    }

    /**
     * Returns root categories only.
     *
     * @param {Array<Record<string, unknown>>} categories
     * @returns {Array<Record<string, unknown>>}
     */
    function getMainCategories(categories) {
        return (Array.isArray(categories) ? categories : []).filter(function (category) {
            return !(category.parentId || category.parent_id);
        });
    }

    /**
     * Returns direct child categories for one root category id.
     *
     * @param {{ categories?: Array<Record<string, unknown>>, parentId?: unknown }} input
     * @returns {Array<Record<string, unknown>>}
     */
    function getCatalogSubcategories(input) {
        var parentId = String(input?.parentId || '').trim();
        return (Array.isArray(input?.categories) ? input.categories : [])
            .filter(function (category) {
                return String(category.parentId || category.parent_id || '').trim() === parentId;
            })
            .sort(function (first, second) {
                return Number(first.sortOrder || first.sort_order || 0) - Number(second.sortOrder || second.sort_order || 0);
            });
    }

    /**
     * Builds select options for root categories.
     *
     * @param {{ categories?: Array<Record<string, unknown>>, selectedId?: unknown }} input
     * @returns {string}
     */
    function buildMainCategoryOptions(input) {
        var selectedId = String(input?.selectedId || '').trim();
        var options = ['<option value="">اختر الفئة الرئيسية</option>'];

        getMainCategories(input?.categories).forEach(function (category) {
            options.push('<option value="' + esc(category.id) + '"' + (selectedId === category.id ? ' selected' : '') + '>' + esc(category.name) + '</option>');
        });

        return options.join('');
    }

    /**
     * Builds select options for subcategories under one root category.
     *
     * @param {{ categories?: Array<Record<string, unknown>>, parentId?: unknown, selectedId?: unknown }} input
     * @returns {string}
     */
    function buildSubcategoryOptions(input) {
        var selectedId = String(input?.selectedId || '').trim();
        var options = ['<option value="">بدون فئة فرعية</option>'];

        getCatalogSubcategories(input).forEach(function (category) {
            options.push('<option value="' + esc(category.id) + '"' + (selectedId === category.id ? ' selected' : '') + '>' + esc(category.name) + '</option>');
        });

        return options.join('');
    }

    /**
     * Builds one database payload for the services table.
     *
     * @param {Record<string, unknown>} data
     * @returns {Record<string, unknown>}
     */
    function buildCatalogServicePayload(data) {
        var currentData = data || {};
        var minQty = Math.max(1, Number(currentData.minQty) || 1);
        var maxQty = Math.max(minQty, Number(currentData.maxQty) || minQty);
        var payload = {
            name: currentData.name,
            slug: slugifyCatalogText(currentData.slug || currentData.name) || null,
            category_id: currentData.categoryId || null,
            subcategory_id: currentData.subcategoryId || null,
            price: Number(currentData.price) || 0,
            cost_price: Number(currentData.costPrice) || 0,
            image: normalizeCatalogImage(currentData.image),
            description: currentData.description || null,
            status: currentData.status || 'active',
            sort_order: Number(currentData.sortOrder) || 0,
            min_qty: minQty,
            max_qty: maxQty,
            provider_service_id: currentData.providerServiceId || null,
            updated_at: new Date().toISOString()
        };

        if (!currentData.id) {
            payload.id = buildCatalogServiceId(currentData.name);
        }

        return payload;
    }

    /**
     * Filters digital catalog rows for table rendering.
     *
     * @param {{ categoryId?: unknown, query?: unknown, services?: Array<Record<string, unknown>>, status?: unknown, subcategoryId?: unknown }} input
     * @returns {Array<Record<string, unknown>>}
     */
    function filterCatalogServices(input) {
        var categoryId = String(input?.categoryId || '').trim();
        var subcategoryId = String(input?.subcategoryId || '').trim();
        var status = String(input?.status || '').trim();
        var query = String(input?.query || '').trim().toLowerCase();

        return (Array.isArray(input?.services) ? input.services : []).filter(function (service) {
            if (categoryId && String(service.categoryId || service.category_id || '') !== categoryId) return false;
            if (subcategoryId && String(service.subcategoryId || service.subcategory_id || '') !== subcategoryId) return false;
            if (status && String(service.status || '') !== status) return false;
            if (!query) return true;

            return [service.name, service.id, service.providerServiceId || service.provider_service_id]
                .some(function (value) {
                    return String(value || '').toLowerCase().includes(query);
                });
        });
    }

    window.CatalogAdminHelpers = {
        buildCatalogServiceId: buildCatalogServiceId,
        buildCatalogServicePayload: buildCatalogServicePayload,
        buildMainCategoryOptions: buildMainCategoryOptions,
        buildSubcategoryOptions: buildSubcategoryOptions,
        filterCatalogServices: filterCatalogServices,
        getCatalogSubcategories: getCatalogSubcategories,
        getMainCategories: getMainCategories,
        normalizeCatalogImage: normalizeCatalogImage,
        slugifyCatalogText: slugifyCatalogText
    };

    if (window.__ENABLE_CATALOG_ADMIN_TEST_HOOKS__) {
        window.__catalogAdminTestHooks = window.CatalogAdminHelpers;
    }
})();
