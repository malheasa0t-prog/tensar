// ===== TechZone Admin - Global Search =====
(function () {
    'use strict';

    const A = window.AdminApp;
    const helpers = window.AdminGlobalSearchHelpers;
    const input = document.getElementById('adminGlobalSearchInput');
    const dropdown = document.getElementById('adminGlobalSearchDropdown');
    const container = document.getElementById('adminHeaderSearch');
    const shortcutButton = document.getElementById('adminSearchShortcut');
    const HIGHLIGHT_CLASS = 'admin-search-highlight';
    const state = {
        activeIndex: -1,
        index: [],
        pendingResult: null,
        results: []
    };

    if (!A || !helpers || !input || !dropdown || !container) return;

    input.placeholder = 'ابحث في الطلبات...';

    function getSearchData() {
        return {
            orders: TZ.db.orders || [],
            helpers: {
                getProductById: TZ.getProductById,
                isAccessoryProduct: TZ.isAccessoryProduct,
                isAccessoryProductCategoryId: TZ.isAccessoryProductCategoryId
            }
        };
    }

    function refreshIndex() {
        state.index = helpers.buildAdminSearchIndex(getSearchData());
    }

    function clearDropdownContent() {
        dropdown.replaceChildren();
    }

    function closeDropdown() {
        dropdown.hidden = true;
        clearDropdownContent();
        state.activeIndex = -1;
        state.results = [];
    }

    function openDropdown() {
        dropdown.hidden = false;
    }

    function renderEmptyState(message) {
        const emptyState = document.createElement('div');

        emptyState.className = 'admin-search-empty';
        emptyState.textContent = message;
        clearDropdownContent();
        dropdown.appendChild(emptyState);
        openDropdown();
    }

    function formatResultType(kind) {
        return {
            order: 'طلب'
        }[kind] || 'نتيجة';
    }

    function createResultIcon(iconClassName) {
        const wrapper = document.createElement('span');
        const icon = document.createElement('i');

        wrapper.className = 'admin-search-result-icon';
        icon.className = 'fas ' + String(iconClassName || '').trim();
        wrapper.appendChild(icon);
        return wrapper;
    }

    function createResultBody(result) {
        const body = document.createElement('span');
        const title = document.createElement('strong');
        const subtitle = document.createElement('small');

        body.className = 'admin-search-result-body';
        title.textContent = result.title || '';
        subtitle.textContent = result.subtitle || '';
        body.appendChild(title);
        body.appendChild(subtitle);
        return body;
    }

    function createResultMeta(kind) {
        const meta = document.createElement('span');
        meta.className = 'admin-search-result-meta';
        meta.textContent = formatResultType(kind);
        return meta;
    }

    function createResultButton(result, index) {
        const button = document.createElement('button');

        button.type = 'button';
        button.className = 'admin-search-result' + (index === state.activeIndex ? ' is-active' : '');
        button.dataset.searchIndex = String(index);
        button.appendChild(createResultIcon(result.icon));
        button.appendChild(createResultBody(result));
        button.appendChild(createResultMeta(result.kind));
        return button;
    }

    function renderResults(query) {
        const normalizedQuery = helpers.normalizeText(query);
        if (!normalizedQuery) {
            closeDropdown();
            return;
        }

        state.results = helpers.searchAdminIndex(state.index, normalizedQuery, helpers.RESULT_LIMIT);
        state.activeIndex = state.results.length ? 0 : -1;

        if (state.results.length === 0) {
            renderEmptyState('لا توجد نتائج مطابقة لهذا البحث.');
            return;
        }

        clearDropdownContent();
        state.results.forEach(function (result, index) {
            dropdown.appendChild(createResultButton(result, index));
        });
        openDropdown();
    }

    function focusSearch() {
        input.focus();
        input.select();
        renderResults(input.value);
    }

    function navigateToResult(result) {
        if (!result) return;
        state.pendingResult = result;
        closeDropdown();
        input.blur();
        A.renderSection(result.section, { history: 'push' });
    }

    function applyPendingResultHighlight() {
        if (!state.pendingResult || state.pendingResult.section !== A.currentSection) return;
        const target = document.querySelector(state.pendingResult.rowSelector);
        state.pendingResult = null;
        if (!target) return;

        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.classList.add(HIGHLIGHT_CLASS);
        window.setTimeout(function () {
            target.classList.remove(HIGHLIGHT_CLASS);
        }, 2200);
    }

    function updateActiveResult(nextIndex) {
        state.activeIndex = nextIndex;
        dropdown.querySelectorAll('.admin-search-result').forEach(function (button, index) {
            button.classList.toggle('is-active', index === nextIndex);
        });
    }

    refreshIndex();
    shortcutButton?.addEventListener('click', focusSearch);
    input.addEventListener('focus', function () { renderResults(input.value); });
    input.addEventListener('input', function () { renderResults(this.value); });
    input.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
            closeDropdown();
            input.blur();
            return;
        }
        if (!state.results.length) return;
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            updateActiveResult((state.activeIndex + 1) % state.results.length);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            updateActiveResult((state.activeIndex - 1 + state.results.length) % state.results.length);
        } else if (event.key === 'Enter') {
            event.preventDefault();
            navigateToResult(state.results[state.activeIndex] || state.results[0]);
        }
    });

    dropdown.addEventListener('click', function (event) {
        const button = event.target.closest('[data-search-index]');
        if (!button) return;
        navigateToResult(state.results[Number(button.dataset.searchIndex)]);
    });

    document.addEventListener('click', function (event) {
        if (!container.contains(event.target)) {
            closeDropdown();
        }
    });

    document.addEventListener('keydown', function (event) {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
            event.preventDefault();
            focusSearch();
        }
    });

    window.addEventListener('tz-data-updated', function () {
        refreshIndex();
        if (document.activeElement === input) renderResults(input.value);
    });

    window.addEventListener('tz-admin-section-rendered', applyPendingResultHighlight);
})();
