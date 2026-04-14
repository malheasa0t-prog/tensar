// ===== TechZone Admin - Table Enhancements =====
(function () {
    'use strict';

    const H = window.AdminTableEnhancementHelpers;
    const STORAGE_PREFIX = 'tz_admin_table_page_size_';
    const PAGE_NUMBER_LIMIT = 5;
    let instances = [];

    if (!H) return;

    function normalizeHeaderLabel(text, fallback) {
        const normalized = String(text || '').replace(/\s+/g, ' ').trim();
        return normalized || fallback;
    }

    function collectHeaders(table) {
        return Array.from(table.querySelectorAll('thead th')).map(function (headerCell) {
            if (headerCell.classList.contains('bulk-check-cell')) return 'تحديد';
            return normalizeHeaderLabel(headerCell.textContent, 'حقل');
        });
    }

    function assignResponsiveLabels(table) {
        const headers = collectHeaders(table);
        table.classList.add('admin-mobile-cards');

        Array.from(table.querySelectorAll('tbody tr')).forEach(function (row) {
            Array.from(row.children).forEach(function (cell, index) {
                if (!(cell instanceof HTMLElement)) return;
                const fallback = cell.classList.contains('actions-cell') ? 'إجراءات' : 'حقل';
                cell.dataset.label = normalizeHeaderLabel(headers[index], fallback);
            });
        });
    }

    function parsePageSizes(table) {
        return String(table.dataset.pageSizeOptions || '10,25,50')
            .split(',')
            .map(function (value) { return Number(value.trim()); })
            .filter(function (value) { return value > 0; });
    }

    function getScopeKey(table, index) {
        return table.id || table.dataset.paginationKey || `${window.AdminApp?.currentSection || 'admin'}-${index}`;
    }

    function getFilteredRows(tbody) {
        return Array.from(tbody.rows).filter(function (row) {
            return row.style.display !== 'none';
        });
    }

    function createFooter(instance) {
        const footer = document.createElement('div');
        footer.className = 'admin-table-pagination';
        footer.dataset.paginationFor = instance.key;
        instance.wrap.insertAdjacentElement('afterend', footer);
        return footer;
    }

    function renderFooter(instance, paginationState) {
        const pageNumbers = H.buildVisiblePageNumbers(paginationState.currentPage, paginationState.totalPages, PAGE_NUMBER_LIMIT);
        const pagerButtons = paginationState.totalItems === 0 ? '' : pageNumbers.map(function (pageNumber) {
            return `<button type="button" class="btn btn-outline btn-sm ${pageNumber === paginationState.currentPage ? 'is-current' : ''}" data-pagination-page="${pageNumber}">${pageNumber}</button>`;
        }).join('');

        instance.footer.innerHTML = `
            <div class="admin-table-pagination-summary">${H.buildRangeLabel(paginationState, instance.itemLabel)}</div>
            <div class="admin-table-pagination-controls">
                <label class="admin-table-page-size">
                    <span>لكل صفحة</span>
                    <select data-pagination-size>
                        ${instance.pageSizeOptions.map(function (size) {
                            return `<option value="${size}" ${size === instance.pageSize ? 'selected' : ''}>${size}</option>`;
                        }).join('')}
                    </select>
                </label>
                <div class="admin-table-pagination-buttons">
                    <button type="button" class="btn btn-outline btn-sm" data-pagination-prev ${paginationState.currentPage === 1 ? 'disabled' : ''}>السابق</button>
                    ${pagerButtons}
                    <button type="button" class="btn btn-outline btn-sm" data-pagination-next ${paginationState.currentPage === paginationState.totalPages || paginationState.totalItems === 0 ? 'disabled' : ''}>التالي</button>
                </div>
            </div>
        `;
    }

    function renderInstance(instance) {
        assignResponsiveLabels(instance.table);
        const filteredRows = getFilteredRows(instance.tbody);
        const paginationState = H.buildPaginationState(filteredRows.length, instance.currentPage, instance.pageSize);
        const visibleRows = filteredRows.slice(paginationState.startIndex, paginationState.endIndex);
        const visibleSet = new Set(visibleRows);

        instance.currentPage = paginationState.currentPage;
        Array.from(instance.tbody.rows).forEach(function (row) {
            row.hidden = row.style.display !== 'none' && !visibleSet.has(row);
        });
        renderFooter(instance, paginationState);
    }

    function mountTable(table, index) {
        const tbody = table.tBodies[0];
        const wrap = table.closest('.table-wrap');
        if (!tbody || !wrap) return null;

        const key = getScopeKey(table, index);
        const pageSizeOptions = parsePageSizes(table);
        const pageSize = H.normalizePageSize(localStorage.getItem(STORAGE_PREFIX + key), pageSizeOptions);
        const instance = {
            currentPage: 1,
            footer: null,
            itemLabel: String(table.dataset.itemLabel || 'عنصر').trim(),
            key: key,
            observer: null,
            pageSize: pageSize,
            pageSizeOptions: pageSizeOptions,
            table: table,
            tbody: tbody,
            wrap: wrap
        };

        instance.footer = createFooter(instance);
        instance.footer.addEventListener('click', function (event) {
            const target = event.target.closest('[data-pagination-page],[data-pagination-prev],[data-pagination-next]');
            if (!target) return;
            if (target.hasAttribute('data-pagination-prev')) instance.currentPage -= 1;
            if (target.hasAttribute('data-pagination-next')) instance.currentPage += 1;
            if (target.dataset.paginationPage) instance.currentPage = Number(target.dataset.paginationPage);
            renderInstance(instance);
        });
        instance.footer.addEventListener('change', function (event) {
            if (!event.target.matches('[data-pagination-size]')) return;
            instance.pageSize = H.normalizePageSize(event.target.value, instance.pageSizeOptions);
            instance.currentPage = 1;
            localStorage.setItem(STORAGE_PREFIX + key, String(instance.pageSize));
            renderInstance(instance);
        });

        instance.observer = new MutationObserver(function () {
            window.requestAnimationFrame(function () {
                renderInstance(instance);
            });
        });
        instance.observer.observe(tbody, { attributes: true, attributeFilter: ['style'], childList: true, subtree: true });
        renderInstance(instance);
        return instance;
    }

    function shouldPaginate(table) {
        const rowCount = table.tBodies[0]?.rows.length || 0;
        return table.dataset.paginated === 'true' || rowCount > 10;
    }

    function destroyInstances() {
        instances.forEach(function (instance) {
            instance.observer?.disconnect();
            instance.footer?.remove();
        });
        instances = [];
    }

    function enhanceCurrentSectionTables() {
        destroyInstances();
        Array.from(document.querySelectorAll('.data-table')).forEach(assignResponsiveLabels);
        instances = Array.from(document.querySelectorAll('.data-table'))
            .filter(shouldPaginate)
            .map(mountTable)
            .filter(Boolean);
    }

    window.addEventListener('tz-admin-section-rendered', enhanceCurrentSectionTables);
    window.AdminTableEnhancer = {
        refreshAll: enhanceCurrentSectionTables
    };
})();
