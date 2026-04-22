// ===== TechZone Admin - Bulk Actions =====
(function () {
    'use strict';

    const A = window.AdminApp;
    const helpers = window.AdminBulkActionHelpers;
    if (!A || !helpers) return;

    function getToolbarMarkup(config) {
        const scopeKey = String(config?.scopeKey || '').trim();
        if (!scopeKey) return '';
        const actions = config?.actions || {};

        return `<div class="admin-bulk-toolbar" data-bulk-toolbar="${scopeKey}" hidden>
            <div class="admin-bulk-summary">
                <strong data-bulk-count="${scopeKey}">0</strong>
                <span>تم تحديد ${config.itemLabel || 'عناصر'}</span>
            </div>
            <div class="admin-bulk-actions-list">
                ${actions.status ? `<button type="button" class="btn btn-outline btn-sm" data-bulk-action="${scopeKey}:status"><i class="fas fa-pen-to-square"></i> تغيير الحالة</button>` : ''}
                ${actions.delete ? `<button type="button" class="btn btn-outline btn-sm" data-bulk-action="${scopeKey}:delete"><i class="fas fa-trash"></i> حذف</button>` : ''}
                ${actions.export ? `<button type="button" class="btn btn-outline btn-sm" data-bulk-action="${scopeKey}:export"><i class="fas fa-file-export"></i> تصدير CSV</button>` : ''}
                <button type="button" class="btn btn-ghost btn-sm" data-bulk-action="${scopeKey}:clear"><i class="fas fa-xmark"></i> إلغاء التحديد</button>
            </div>
        </div>`;
    }

    function getHeaderCheckboxMarkup(scopeKey) {
        return `<th class="bulk-check-cell"><input type="checkbox" class="admin-bulk-checkbox" data-bulk-select-all="${scopeKey}" aria-label="تحديد الكل"></th>`;
    }

    function getRowCheckboxMarkup(scopeKey, id) {
        return `<td class="bulk-check-cell"><input type="checkbox" class="admin-bulk-checkbox" data-bulk-select-item="${scopeKey}" data-bulk-id="${id}" aria-label="تحديد العنصر"></td>`;
    }

    function buildCsvFilename(scopeKey) {
        return `${scopeKey}-${new Date().toISOString().slice(0, 10)}.csv`;
    }

    function downloadCsv(filename, content) {
        const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }

    function showStatusModal(config, onSubmit) {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `<div class="modal-card admin-bulk-status-modal">
            <h3>${config.title || 'تغيير الحالة'}</h3>
            <div class="admin-form-group">
                <label>${config.label || 'الحالة الجديدة'}</label>
                <select id="bulkStatusSelect">${config.options.map(function (option) {
                    return `<option value="${option.value}">${option.label}</option>`;
                }).join('')}</select>
            </div>
            <div class="admin-bulk-modal-actions">
                <button type="button" class="btn btn-primary" data-bulk-submit-status>تطبيق</button>
                <button type="button" class="btn btn-outline" data-bulk-close-modal>إلغاء</button>
            </div>
        </div>`;

        document.body.appendChild(overlay);
        overlay.addEventListener('click', function (event) {
            if (event.target === overlay || event.target.closest('[data-bulk-close-modal]')) overlay.remove();
        });
        overlay.querySelector('[data-bulk-submit-status]').addEventListener('click', function () {
            const selectedStatus = overlay.querySelector('#bulkStatusSelect').value;
            overlay.remove();
            void onSubmit(selectedStatus);
        });
    }

    function mount(config) {
        const scopeKey = String(config?.scopeKey || '').trim();
        const toolbar = document.querySelector(`[data-bulk-toolbar="${scopeKey}"]`);
        const table = document.querySelector(config?.tableSelector || '');
        if (!scopeKey || !toolbar || !table) return;

        let selectedIds = [];

        function getRowCheckboxes() {
            return Array.from(table.querySelectorAll(`[data-bulk-select-item="${scopeKey}"]`));
        }

        function getAvailableIds() {
            return getRowCheckboxes().map(function (checkbox) { return checkbox.dataset.bulkId; });
        }

        function updateToolbar() {
            const selectionState = helpers.getBulkSelectionState(selectedIds, getAvailableIds());
            toolbar.hidden = selectionState.selectedCount === 0;
            toolbar.querySelector(`[data-bulk-count="${scopeKey}"]`).textContent = selectionState.selectedCount;

            getRowCheckboxes().forEach(function (checkbox) {
                const row = checkbox.closest('tr');
                const checked = selectedIds.includes(checkbox.dataset.bulkId);
                checkbox.checked = checked;
                row?.classList.toggle('is-selected', checked);
            });

            const selectAllCheckbox = table.querySelector(`[data-bulk-select-all="${scopeKey}"]`);
            if (selectAllCheckbox) {
                selectAllCheckbox.checked = selectionState.allSelected;
                selectAllCheckbox.indeterminate = selectionState.partiallySelected;
            }
        }

        table.addEventListener('change', function (event) {
            const rowCheckbox = event.target.closest(`[data-bulk-select-item="${scopeKey}"]`);
            const selectAllCheckbox = event.target.closest(`[data-bulk-select-all="${scopeKey}"]`);

            if (rowCheckbox) {
                selectedIds = helpers.toggleBulkSelection(selectedIds, rowCheckbox.dataset.bulkId, rowCheckbox.checked);
                updateToolbar();
            }

            if (selectAllCheckbox) {
                selectedIds = helpers.toggleAllSelection(selectedIds, getAvailableIds(), selectAllCheckbox.checked);
                updateToolbar();
            }
        });

        toolbar.addEventListener('click', function (event) {
            const button = event.target.closest('[data-bulk-action]');
            if (!button) return;
            const actionName = String(button.dataset.bulkAction || '').split(':')[1];
            const ids = helpers.normalizeSelectedIds(selectedIds);
            if (actionName === 'clear') {
                selectedIds = [];
                updateToolbar();
                return;
            }
            if (ids.length === 0) return;

            if (actionName === 'export' && config.export) {
                const content = helpers.buildCsvString(config.export.columns, config.export.buildRows(ids));
                downloadCsv(config.export.filename || buildCsvFilename(scopeKey), content);
                return;
            }

            if (actionName === 'delete' && config.delete) {
                A.showConfirmModal(config.delete.title || 'حذف العناصر المحددة', config.delete.message || 'هل تريد متابعة الحذف؟', function () {
                    Promise.resolve(config.delete.run(ids)).then(function () {
                        selectedIds = [];
                        updateToolbar();
                    }).catch(function (error) {
                        A.showErrorToast('BLK-301', error?.message || 'تعذر تنفيذ العملية الجماعية.');
                    });
                });
                return;
            }

            if (actionName === 'status' && config.status) {
                showStatusModal(config.status, function (status) {
                    return Promise.resolve(config.status.run(ids, status)).then(function () {
                        selectedIds = [];
                        updateToolbar();
                    }).catch(function (error) {
                        A.showErrorToast('BLK-301', error?.message || 'تعذر تنفيذ العملية الجماعية.');
                    });
                });
            }
        });

        updateToolbar();
    }

    window.AdminBulkActions = {
        getToolbarMarkup: getToolbarMarkup,
        getHeaderCheckboxMarkup: getHeaderCheckboxMarkup,
        getRowCheckboxMarkup: getRowCheckboxMarkup,
        mount: mount
    };
})();
