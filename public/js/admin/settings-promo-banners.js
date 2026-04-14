/**
 * Promo banner editor helpers for the legacy admin settings page.
 */
(function () {
    'use strict';

    const MAX_PROMO_BANNERS = 8;
    const MAX_PROMO_IMAGE_BYTES = 4 * 1024 * 1024;
    const DEFAULT_BANNER_LINK = '/';

    /**
     * Escapes text for safe HTML output.
     *
     * @param {unknown} value
     * @returns {string}
     */
    function escapeText(value) {
        return TZ.escapeHtml(value == null ? '' : String(value));
    }

    /**
     * Creates an empty banner model.
     *
     * @returns {{ title: string, subtitle: string, href: string, image: string }}
     */
    function createDefaultBanner() {
        return { title: '', subtitle: '', href: DEFAULT_BANNER_LINK, image: '' };
    }

    /**
     * Sanitizes a banner image URL.
     *
     * @param {unknown} value
     * @returns {string}
     */
    function sanitizeImageUrl(value) {
        const raw = String(value || '').trim();
        if (!raw) return '';
        if (raw.startsWith('data:image/') || raw.startsWith('blob:')) return raw;

        try {
            const url = new URL(raw, window.location.origin);
            return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
        } catch (error) {
            void error;
            return '';
        }
    }

    /**
     * Converts an uploaded image file into a data URL.
     *
     * @param {File} file
     * @returns {Promise<string>}
     */
    function readImageFile(file) {
        return new Promise((resolve, reject) => {
            if (!file || !file.type.startsWith('image/')) {
                reject(new Error('الملف المختار ليس صورة صالحة.'));
                return;
            }

            if (file.size > MAX_PROMO_IMAGE_BYTES) {
                reject(new Error('حجم الصورة كبير جداً. الحد الأقصى 4MB.'));
                return;
            }

            const reader = new FileReader();
            reader.onload = (event) => resolve(typeof event.target?.result === 'string' ? event.target.result : '');
            reader.onerror = () => reject(new Error('تعذر قراءة الصورة.'));
            reader.readAsDataURL(file);
        });
    }

    /**
     * Normalizes raw banner values into a safe list.
     *
     * @param {unknown} banners
     * @returns {Array<{ title: string, subtitle: string, href: string, image: string }>}
     */
    function normalizePromoBanners(banners) {
        if (!Array.isArray(banners)) return [];

        return banners
            .map((banner) => ({
                title: String(banner?.title || '').trim(),
                subtitle: String(banner?.subtitle || '').trim(),
                href: String(banner?.href || DEFAULT_BANNER_LINK).trim() || DEFAULT_BANNER_LINK,
                image: sanitizeImageUrl(banner?.image || '')
            }))
            .filter((banner) => !!banner.image);
    }

    /**
     * Renders the image preview block.
     *
     * @param {string} imageUrl
     * @returns {string}
     */
    function renderBannerPreview(imageUrl) {
        if (imageUrl) {
            return `<img src="${escapeText(imageUrl)}" alt="معاينة البنر">`;
        }

        return '<div class="promo-banner-empty">أضف صورة للبنر</div>';
    }

    /**
     * Renders one banner card inside the editor.
     *
     * @param {{ title: string, subtitle: string, href: string, image: string }} banner
     * @param {number} index
     * @returns {string}
     */
    function renderPromoBannerCard(banner, index) {
        return `
            <div class="promo-banner-card" data-banner-card>
                <div class="promo-banner-toolbar">
                    <span class="promo-banner-index">البنر ${index + 1}</span>
                    <div class="promo-banner-toolbar-actions">
                        <button type="button" class="btn btn-ghost btn-sm" data-move-banner-up>
                            <i class="fas fa-arrow-up"></i> أعلى
                        </button>
                        <button type="button" class="btn btn-ghost btn-sm" data-move-banner-down>
                            <i class="fas fa-arrow-down"></i> أسفل
                        </button>
                        <button type="button" class="btn btn-ghost btn-sm" data-remove-banner>
                            <i class="fas fa-trash"></i> إزالة
                        </button>
                    </div>
                </div>
                <div class="promo-banner-grid">
                    <div class="promo-banner-preview" data-banner-preview>${renderBannerPreview(banner.image)}</div>
                    <div class="promo-banner-body">
                        <div class="admin-polish-grid">
                            <input data-banner-field="title" value="${escapeText(banner.title)}" placeholder="عنوان البنر">
                            <input data-banner-field="subtitle" value="${escapeText(banner.subtitle)}" placeholder="وصف قصير">
                        </div>
                        <div class="admin-polish-grid">
                            <input data-banner-field="href" value="${escapeText(banner.href)}" placeholder="/products أو رابط كامل">
                            <input data-banner-field="image" value="${escapeText(banner.image)}" placeholder="رابط الصورة">
                        </div>
                        <div class="promo-banner-actions">
                            <label class="btn btn-outline btn-sm">
                                <i class="fas fa-image"></i> رفع صورة
                                <input type="file" accept="image/*" data-banner-upload hidden>
                            </label>
                            <button type="button" class="btn btn-outline btn-sm" data-clear-banner-image>
                                <i class="fas fa-eraser"></i> مسح الصورة
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Renders the promo banner settings section.
     *
     * @param {Array<{ title: string, subtitle: string, href: string, image: string }>} banners
     * @returns {string}
     */
    function renderPromoBannerSection(banners) {
        const cardsMarkup = banners.length > 0
            ? banners.map((banner, index) => renderPromoBannerCard(banner, index)).join('')
            : '<div class="promo-banner-empty-state" data-banner-empty-state>لا توجد بنرات مضافة الآن. أضف أول صورة ليبدأ الشريط بالتحرك.</div>';

        return `
            <div class="settings-section">
                <div class="admin-actions-row" style="justify-content:space-between;">
                    <div class="admin-form-stack" style="gap:4px;">
                        <h3 style="margin:0;"><i class="fas fa-images"></i> البنرات المتحركة في الرئيسية</h3>
                        <small style="color:var(--text-muted);">أضف الصور وارفعها مباشرة ورتّبها كما ستظهر للعميل في الصفحة الرئيسية.</small>
                    </div>
                    <button type="button" class="btn btn-primary btn-sm" id="addPromoBannerBtn"><i class="fas fa-plus"></i> إضافة بنر</button>
                </div>
                <div class="promo-banner-list" id="promoBannerList">${cardsMarkup}</div>
            </div>
        `;
    }

    /**
     * Updates banner card labels after any DOM reorder.
     *
     * @param {HTMLElement} container
     * @returns {void}
     */
    function updatePromoBannerIndices(container) {
        container.querySelectorAll('[data-banner-card]').forEach((card, index) => {
            const label = card.querySelector('.promo-banner-index');
            if (label) label.textContent = `البنر ${index + 1}`;
        });
    }

    /**
     * Collects banner values from the editor DOM.
     *
     * @param {HTMLElement} container
     * @returns {Array<{ title: string, subtitle: string, href: string, image: string }>}
     */
    function collectPromoBanners(container) {
        return Array.from(container.querySelectorAll('[data-banner-card]'))
            .map((card) => ({
                title: card.querySelector('[data-banner-field="title"]')?.value.trim() || '',
                subtitle: card.querySelector('[data-banner-field="subtitle"]')?.value.trim() || '',
                href: card.querySelector('[data-banner-field="href"]')?.value.trim() || DEFAULT_BANNER_LINK,
                image: sanitizeImageUrl(card.querySelector('[data-banner-field="image"]')?.value || '')
            }))
            .filter((banner) => !!banner.image)
            .slice(0, MAX_PROMO_BANNERS);
    }

    /**
     * Shows or removes the empty-state card based on current items.
     *
     * @param {HTMLElement} container
     * @returns {void}
     */
    function refreshPromoBannerEmptyState(container) {
        const hasCards = container.querySelector('[data-banner-card]');
        const emptyState = container.querySelector('[data-banner-empty-state]');

        if (!hasCards && !emptyState) {
            container.innerHTML = '<div class="promo-banner-empty-state" data-banner-empty-state>لا توجد بنرات مضافة الآن. أضف أول صورة ليبدأ الشريط بالتحرك.</div>';
        }

        if (hasCards && emptyState) {
            emptyState.remove();
        }
    }

    /**
     * Moves a banner card one step inside the list.
     *
     * @param {HTMLElement} container
     * @param {HTMLElement | null} card
     * @param {"up" | "down"} direction
     * @returns {void}
     */
    function moveBannerCard(container, card, direction) {
        if (!container || !card) return;

        const sibling = direction === 'up' ? card.previousElementSibling : card.nextElementSibling;
        if (!sibling) return;

        if (direction === 'up') {
            container.insertBefore(card, sibling);
            return;
        }

        container.insertBefore(sibling, card);
    }

    /**
     * Syncs the image preview with the current field value.
     *
     * @param {HTMLElement | null} card
     * @returns {void}
     */
    function refreshCardPreview(card) {
        const imageField = card?.querySelector('[data-banner-field="image"]');
        const preview = card?.querySelector('[data-banner-preview]');
        if (!imageField || !preview) return;
        preview.innerHTML = renderBannerPreview(sanitizeImageUrl(imageField.value));
    }

    /**
     * Binds promo banner editor interactions.
     *
     * @param {{ containerId: string, addButtonId: string, onToast: (message: string) => void }} options
     * @returns {HTMLElement | null}
     */
    function bindPromoBannerEditor(options) {
        const container = document.getElementById(options.containerId);
        const addButton = document.getElementById(options.addButtonId);
        if (!container || !addButton) return null;

        addButton.addEventListener('click', () => {
            const count = container.querySelectorAll('[data-banner-card]').length;
            if (count >= MAX_PROMO_BANNERS) {
                options.onToast('يمكنك إضافة 8 بنرات كحد أقصى.');
                return;
            }

            container.querySelector('[data-banner-empty-state]')?.remove();
            container.insertAdjacentHTML('beforeend', renderPromoBannerCard(createDefaultBanner(), count));
            updatePromoBannerIndices(container);
        });

        container.addEventListener('click', (event) => {
            const moveUpButton = event.target.closest('[data-move-banner-up]');
            const moveDownButton = event.target.closest('[data-move-banner-down]');
            const removeButton = event.target.closest('[data-remove-banner]');
            const clearButton = event.target.closest('[data-clear-banner-image]');

            if (moveUpButton) moveBannerCard(container, moveUpButton.closest('[data-banner-card]'), 'up');
            if (moveDownButton) moveBannerCard(container, moveDownButton.closest('[data-banner-card]'), 'down');
            if (removeButton) removeButton.closest('[data-banner-card]')?.remove();
            if (clearButton) {
                const card = clearButton.closest('[data-banner-card]');
                const imageField = card?.querySelector('[data-banner-field="image"]');
                if (imageField) imageField.value = '';
                refreshCardPreview(card);
            }

            updatePromoBannerIndices(container);
            refreshPromoBannerEmptyState(container);
        });

        container.addEventListener('input', (event) => {
            const field = event.target.closest('[data-banner-field="image"]');
            if (!field) return;
            refreshCardPreview(field.closest('[data-banner-card]'));
        });

        container.addEventListener('change', async (event) => {
            const input = event.target.closest('[data-banner-upload]');
            if (!input || !input.files?.[0]) return;

            try {
                const dataUrl = await readImageFile(input.files[0]);
                const card = input.closest('[data-banner-card]');
                const imageField = card?.querySelector('[data-banner-field="image"]');
                if (imageField) imageField.value = dataUrl;
                refreshCardPreview(card);
            } catch (error) {
                options.onToast(error?.message || 'تعذر رفع الصورة.');
            } finally {
                input.value = '';
            }
        });

        return container;
    }

    window.TechZoneSettingsPromoBanners = {
        renderPromoBannerSection,
        bindPromoBannerEditor,
        normalizePromoBanners,
        collectPromoBanners
    };
})();
