// ===== TechZone Admin - Core UI =====
(function () {
    'use strict';

    const ADMIN_IMAGE_UPLOAD_LIMIT_BYTES = 4 * 1024 * 1024;
    const ADMIN_IMAGE_UPLOAD_LIMIT_LABEL = '4MB';
    const Errors = window.AdminErrorCodes;
    const MODAL_TYPE_META = {
        danger: { icon: 'fa-trash-can', confirmClass: 'btn-danger', toneClass: 'modal-card--danger' },
        warning: { icon: 'fa-triangle-exclamation', confirmClass: 'btn-primary', toneClass: 'modal-card--warning' },
        success: { icon: 'fa-circle-check', confirmClass: 'btn-primary', toneClass: 'modal-card--success' },
        info: { icon: 'fa-circle-info', confirmClass: 'btn-primary', toneClass: 'modal-card--info' }
    };

    function buildModalConfig(input, message) {
        if (typeof input === 'object' && input !== null) {
            return {
                cancelText: '\u0625\u0644\u063A\u0627\u0621',
                confirmText: '\u062A\u0623\u0643\u064A\u062F',
                type: 'warning',
                ...input
            };
        }

        return {
            title: String(input || ''),
            message: String(message || ''),
            confirmText: '\u062A\u0623\u0643\u064A\u062F',
            cancelText: '\u0625\u0644\u063A\u0627\u0621',
            type: 'warning'
        };
    }

    function isDomNode(value) {
        return typeof Node === 'function' && value instanceof Node;
    }

    function appendModalBodyContent(container, config) {
        if (!container) return;
        if (isDomNode(config.contentNode)) {
            container.appendChild(config.contentNode);
            return;
        }
        if (!config.contentHtml) return;

        const wrapper = document.createElement('div');
        wrapper.innerHTML = String(config.contentHtml || '');
        while (wrapper.firstChild) {
            container.appendChild(wrapper.firstChild);
        }
    }

    function showToast(message) {
        const toast = document.createElement('div');
        toast.style.cssText = 'position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:var(--success);color:#fff;padding:12px 24px;border-radius:10px;font-family:inherit;font-size:0.9rem;z-index:9999;box-shadow:0 5px 20px rgba(0,0,0,0.3);animation:fadeInUp 0.3s ease;';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s';
            setTimeout(() => toast.remove(), 300);
        }, 2500);
    }

    function showErrorToast(code, message) {
        const formatted = Errors && typeof Errors.formatError === 'function'
            ? Errors.formatError(code, message)
            : '[' + code + '] ' + String(message || '');
        showToast(formatted);
    }

    function showUndoToast(message, onUndo, onExpire) {
        if (onExpire) onExpire();
        showToast(message);
        void onUndo;
    }

    function showModernModal(input, message) {
        const config = buildModalConfig(input, message);
        const typeMeta = MODAL_TYPE_META[config.type] || MODAL_TYPE_META.info;
        const overlay = document.createElement('div');
        const title = TZ.escapeHtml(config.title || '');
        const body = TZ.escapeHtml(config.message || '');
        const icon = config.icon || typeMeta.icon;
        const cancelText = TZ.escapeHtml(config.cancelText || '\u0625\u063A\u0644\u0627\u0642');
        const confirmText = TZ.escapeHtml(config.confirmText || '\u062A\u0623\u0643\u064A\u062F');
        const shouldShowConfirm = config.hideConfirm !== true;

        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-card admin-confirm-modal ${typeMeta.toneClass}" role="dialog" aria-modal="true" aria-label="${title}">
                <div class="admin-confirm-modal__icon"><i class="fas ${icon}"></i></div>
                <div class="admin-confirm-modal__body">
                    <h3>${title}</h3>
                    ${body ? `<p>${body}</p>` : ''}
                </div>
                <div class="admin-confirm-modal__actions">
                    <button type="button" class="btn btn-outline" data-modal-cancel>${cancelText}</button>
                    ${shouldShowConfirm ? `<button type="button" class="btn ${config.confirmClass || typeMeta.confirmClass}" data-modal-confirm>${confirmText}</button>` : ''}
                </div>
            </div>
        `;

        return new Promise((resolve) => {
            let closed = false;
            const close = function (result) {
                if (closed) return;
                closed = true;
                document.removeEventListener('keydown', handleEscape);
                overlay.remove();
                resolve(result);
            };
            const handleEscape = function (event) {
                if (event.key === 'Escape') close(false);
            };

            document.body.appendChild(overlay);
            appendModalBodyContent(overlay.querySelector('.admin-confirm-modal__body'), config);
            document.addEventListener('keydown', handleEscape);
            overlay.addEventListener('click', (event) => {
                if (event.target === overlay || event.target.closest('[data-modal-cancel]')) close(false);
            });
            overlay.querySelector('[data-modal-confirm]')?.addEventListener('click', () => close(true));
        });
    }

    function showModernConfirmModal(input, message, onConfirm) {
        const promise = showModernModal(input, message);
        if (typeof onConfirm === 'function') {
            promise.then((confirmed) => confirmed ? onConfirm() : null);
        }
        return promise;
    }

    function renderSectionLoadingState(adminContent, sectionTitle) {
        adminContent.innerHTML = `
            <div class="admin-section-loading">
                <div class="admin-section-loading__header">
                    <span class="admin-section-loading__eyebrow">\u062C\u0627\u0631\u064A \u062A\u062D\u0645\u064A\u0644 \u0627\u0644\u0642\u0633\u0645</span>
                    <strong>${TZ.escapeHtml(sectionTitle)}</strong>
                </div>
                <div class="admin-section-loading__grid">
                    <div class="admin-skeleton-card"></div>
                    <div class="admin-skeleton-card"></div>
                    <div class="admin-skeleton-card"></div>
                </div>
                <div class="admin-skeleton-panel">
                    <div class="admin-skeleton-line admin-skeleton-line--wide"></div>
                    <div class="admin-skeleton-line"></div>
                    <div class="admin-skeleton-line admin-skeleton-line--short"></div>
                    <div class="admin-skeleton-table"><span></span><span></span><span></span><span></span></div>
                </div>
            </div>
        `;
    }

    function renderAccessDeniedState(adminContent, sectionTitle) {
        adminContent.innerHTML = `
            <div class="status-box warning admin-access-state">
                <i class="fas fa-shield-halved"></i>
                <div>
                    <strong>\u0644\u0627 \u062A\u0645\u0644\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 \u0627\u0644\u0648\u0635\u0648\u0644</strong>
                    <p>\u0644\u0627 \u064A\u0645\u0643\u0646\u0643 \u0641\u062A\u062D \u0642\u0633\u0645 ${TZ.escapeHtml(sectionTitle)} \u0628\u062D\u0633\u0628 \u0635\u0644\u0627\u062D\u064A\u0627\u062A \u062D\u0633\u0627\u0628\u0643.</p>
                </div>
            </div>
        `;
    }

    function renderSectionErrorState(adminContent, error) {
        adminContent.innerHTML = `
            <div class="status-box danger admin-access-state">
                <i class="fas fa-circle-exclamation"></i>
                <div>
                    <strong>\u062A\u0639\u0630\u0631 \u062A\u062D\u0645\u064A\u0644 \u0627\u0644\u0642\u0633\u0645</strong>
                    <p>${TZ.escapeHtml(error?.message || '\u062D\u062F\u062B \u062E\u0637\u0623 \u063A\u064A\u0631 \u0645\u062A\u0648\u0642\u0639 \u0623\u062B\u0646\u0627\u0621 \u062A\u062D\u0645\u064A\u0644 \u0627\u0644\u0642\u0633\u0645 \u0627\u0644\u0645\u0637\u0644\u0648\u0628.')}</p>
                </div>
            </div>
        `;
    }

    function showLegacyModeNotice(TZ) {
        void TZ;
    }

    function getAdminImageUploadLimitText() {
        return ADMIN_IMAGE_UPLOAD_LIMIT_LABEL;
    }

    function isAdminImageUploadTooLarge(file) {
        return Number(file?.size || 0) > ADMIN_IMAGE_UPLOAD_LIMIT_BYTES;
    }

    function showAdminImageUploadLimitToast() {
        showErrorToast('COR-101', `\u062D\u062C\u0645 \u0627\u0644\u0635\u0648\u0631\u0629 \u064A\u062A\u062C\u0627\u0648\u0632 ${getAdminImageUploadLimitText()}.`);
    }

    window.AdminCoreUi = {
        getAdminImageUploadLimitText,
        isAdminImageUploadTooLarge,
        renderAccessDeniedState,
        renderSectionErrorState,
        renderSectionLoadingState,
        showAdminImageUploadLimitToast,
        showConfirmModal: showModernConfirmModal,
        showErrorToast,
        showLegacyModeNotice,
        showModal: showModernModal,
        showToast,
        showUndoToast
    };
})();
