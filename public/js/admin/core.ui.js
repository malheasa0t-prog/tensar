// ===== TechZone Admin - Core UI =====
(function () {
    'use strict';

    const ADMIN_IMAGE_UPLOAD_LIMIT_BYTES = 4 * 1024 * 1024;
    const ADMIN_IMAGE_UPLOAD_LIMIT_LABEL = '4MB';
    const MODAL_TYPE_META = {
        danger: { icon: 'fa-trash-can', confirmClass: 'btn-danger', toneClass: 'modal-card--danger' },
        warning: { icon: 'fa-triangle-exclamation', confirmClass: 'btn-primary', toneClass: 'modal-card--warning' },
        success: { icon: 'fa-circle-check', confirmClass: 'btn-primary', toneClass: 'modal-card--success' },
        info: { icon: 'fa-circle-info', confirmClass: 'btn-primary', toneClass: 'modal-card--info' }
    };

    function buildModalConfig(input, message) {
        if (typeof input === 'object' && input !== null) {
            return {
                cancelText: 'إلغاء',
                confirmText: 'تأكيد',
                type: 'warning',
                ...input
            };
        }

        return {
            title: String(input || ''),
            message: String(message || ''),
            confirmText: 'تأكيد',
            cancelText: 'إلغاء',
            type: 'warning'
        };
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

    function showUndoToast(message, onUndo, onExpire) {
        if (onExpire) {
            onExpire();
        }
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
        const contentHtml = config.contentHtml || '';
        const cancelText = TZ.escapeHtml(config.cancelText || 'إغلاق');
        const confirmText = TZ.escapeHtml(config.confirmText || 'تأكيد');
        const shouldShowConfirm = config.hideConfirm !== true;

        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-card admin-confirm-modal ${typeMeta.toneClass}" role="dialog" aria-modal="true" aria-label="${title}">
                <div class="admin-confirm-modal__icon"><i class="fas ${icon}"></i></div>
                <div class="admin-confirm-modal__body">
                    <h3>${title}</h3>
                    ${body ? `<p>${body}</p>` : ''}
                    ${contentHtml}
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
                    <span class="admin-section-loading__eyebrow">جاري تحميل القسم</span>
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
                    <strong>لا تملك صلاحية الوصول</strong>
                    <p>لا يمكنك فتح قسم ${TZ.escapeHtml(sectionTitle)} بحسب صلاحيات حسابك.</p>
                </div>
            </div>
        `;
    }

    function renderSectionErrorState(adminContent, error) {
        adminContent.innerHTML = `
            <div class="status-box danger admin-access-state">
                <i class="fas fa-circle-exclamation"></i>
                <div>
                    <strong>تعذر تحميل القسم</strong>
                    <p>${TZ.escapeHtml(error?.message || 'حدث خطأ غير متوقع أثناء تحميل القسم المطلوب.')}</p>
                </div>
            </div>
        `;
    }

    function showLegacyModeNotice(TZ) {
        if (TZ.legacyWriteEnabled) return;

        const existing = document.getElementById('legacyReadOnlyNotice');
        if (existing) existing.remove();

        const notice = document.createElement('div');
        notice.id = 'legacyReadOnlyNotice';
        notice.style.cssText = 'margin:12px 16px 0;padding:12px 14px;border:1px solid rgba(241,196,15,.45);background:rgba(241,196,15,.12);border-radius:10px;color:#f5c542;font-size:.92rem;line-height:1.7';
        notice.innerHTML = 'وضع آمن: لوحة الإدارة القديمة تعمل حاليًا بصلاحية قراءة فقط لمنع الكتابة المباشرة من المتصفح. لإجراء تعديلات فعلية استخدم لوحة Next.js الحديثة.';

        const content = document.getElementById('adminContent');
        if (content && content.parentNode) {
            content.parentNode.insertBefore(notice, content);
        }
    }

    function getAdminImageUploadLimitText() {
        return ADMIN_IMAGE_UPLOAD_LIMIT_LABEL;
    }

    function isAdminImageUploadTooLarge(file) {
        return Number(file?.size || 0) > ADMIN_IMAGE_UPLOAD_LIMIT_BYTES;
    }

    function showAdminImageUploadLimitToast() {
        showToast(`حجم الصورة يتجاوز ${getAdminImageUploadLimitText()}.`);
    }

    window.AdminCoreUi = {
        getAdminImageUploadLimitText,
        isAdminImageUploadTooLarge,
        renderAccessDeniedState,
        renderSectionErrorState,
        renderSectionLoadingState,
        showAdminImageUploadLimitToast,
        showConfirmModal: showModernConfirmModal,
        showLegacyModeNotice,
        showModal: showModernModal,
        showToast,
        showUndoToast
    };
})();
