// ===== TechZone Admin - Bulk Actions Helpers =====
(function () {
    'use strict';

    function normalizeSelectedIds(ids) {
        return Array.from(new Set((Array.isArray(ids) ? ids : []).map(function (id) {
            return String(id || '').trim();
        }).filter(Boolean)));
    }

    function toggleBulkSelection(selectedIds, id, checked) {
        const normalizedId = String(id || '').trim();
        const nextSelection = new Set(normalizeSelectedIds(selectedIds));
        if (!normalizedId) return Array.from(nextSelection);

        if (checked) {
            nextSelection.add(normalizedId);
        } else {
            nextSelection.delete(normalizedId);
        }

        return Array.from(nextSelection);
    }

    function toggleAllSelection(selectedIds, availableIds, checked) {
        const nextSelection = new Set(normalizeSelectedIds(selectedIds));
        const normalizedAvailable = normalizeSelectedIds(availableIds);

        normalizedAvailable.forEach(function (id) {
            if (checked) {
                nextSelection.add(id);
            } else {
                nextSelection.delete(id);
            }
        });

        return Array.from(nextSelection);
    }

    function getBulkSelectionState(selectedIds, availableIds) {
        const normalizedSelected = normalizeSelectedIds(selectedIds);
        const normalizedAvailable = normalizeSelectedIds(availableIds);
        const selectedCount = normalizedSelected.filter(function (id) {
            return normalizedAvailable.includes(id);
        }).length;

        return {
            selectedCount: selectedCount,
            availableCount: normalizedAvailable.length,
            allSelected: normalizedAvailable.length > 0 && selectedCount === normalizedAvailable.length,
            partiallySelected: selectedCount > 0 && selectedCount < normalizedAvailable.length
        };
    }

    function escapeCsvValue(value) {
        const normalized = String(value == null ? '' : value).replace(/"/g, '""');
        return /[",\n]/.test(normalized) ? `"${normalized}"` : normalized;
    }

    function buildCsvString(columns, rows) {
        const safeColumns = Array.isArray(columns) ? columns : [];
        const safeRows = Array.isArray(rows) ? rows : [];
        const header = safeColumns.map(function (column) {
            return escapeCsvValue(column.label);
        }).join(',');
        const body = safeRows.map(function (row) {
            return safeColumns.map(function (column) {
                return escapeCsvValue(row?.[column.key]);
            }).join(',');
        }).join('\n');

        return [header, body].filter(Boolean).join('\n');
    }

    window.AdminBulkActionHelpers = {
        normalizeSelectedIds: normalizeSelectedIds,
        toggleBulkSelection: toggleBulkSelection,
        toggleAllSelection: toggleAllSelection,
        getBulkSelectionState: getBulkSelectionState,
        escapeCsvValue: escapeCsvValue,
        buildCsvString: buildCsvString
    };

    if (window.__ENABLE_ADMIN_BULK_ACTION_TEST_HOOKS__) {
        window.__adminBulkActionTestHooks = window.AdminBulkActionHelpers;
    }
})();
