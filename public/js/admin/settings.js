/**
 * TechZone admin settings section.
 */
(function () {
    'use strict';

    const A = window.AdminApp;
    const BannerEditor = window.TechZoneSettingsPromoBanners;
    const CONTENT_FIELD_CONFIG = [
        { key: 'valuePoints', inputId: 'setValuePoints', label: 'نقاط القوة', hint: 'كل سطر: icon | title | description', fields: ['icon', 'title', 'description'], requiredFields: ['title', 'description'], rows: 6, icon: 'fa-star' },
        { key: 'testimonials', inputId: 'setTestimonials', label: 'آراء العملاء', hint: 'كل سطر: name | role | quote', fields: ['name', 'role', 'quote'], requiredFields: ['name', 'quote'], rows: 5, icon: 'fa-comments' },
        { key: 'faqs', inputId: 'setFaqs', label: 'الأسئلة الشائعة', hint: 'كل سطر: question | answer', fields: ['question', 'answer'], requiredFields: ['question', 'answer'], rows: 5, icon: 'fa-circle-question' },
        { key: 'workingHours', inputId: 'setWorkingHours', label: 'ساعات العمل', hint: 'كل سطر: day | hours', fields: ['day', 'hours'], requiredFields: ['day', 'hours'], rows: 4, icon: 'fa-clock' }
    ];

    /**
     * Escapes text for safe HTML rendering.
     *
     * @param {unknown} value
     * @returns {string}
     */
    function escapeText(value) {
        return TZ.escapeHtml(value == null ? '' : String(value));
    }

    /**
     * Serializes structured list items for textarea editing.
     *
     * @param {Array<Record<string, string>>} items
     * @param {string[]} fields
     * @returns {string}
     */
    function serializeContentLines(items, fields) {
        if (!Array.isArray(items)) {
            return '';
        }

        return items
            .map((item) => fields.map((field) => String(item?.[field] || '').trim()).join(' | '))
            .filter(Boolean)
            .join('\n');
    }

    /**
     * Parses structured textarea content into a record list.
     *
     * @param {string} value
     * @param {string[]} fields
     * @param {string[]} requiredFields
     * @returns {Array<Record<string, string>>}
     */
    function parseContentLines(value, fields, requiredFields) {
        return String(value || '')
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => line.split('|').map((part) => part.trim()))
            .map((parts) => Object.fromEntries(fields.map((field, index) => [field, parts[index] || ''])))
            .filter((item) => requiredFields.every((field) => item[field]));
    }

    /**
     * Ensures the settings object contains all required nested properties.
     *
     * @returns {void}
     */
    function ensureSettingsShape() {
        TZ.db.settings = TZ.db.settings || {};
        TZ.db.settings.company = TZ.db.settings.company || {};
        TZ.db.settings.payments = TZ.db.settings.payments || {};
        TZ.db.settings.shipping = TZ.db.settings.shipping || {};
        TZ.db.settings.social = TZ.db.settings.social || {};
        TZ.db.settings.homepage = TZ.db.settings.homepage || {};
        TZ.db.settings.content = TZ.db.settings.content || {};
        TZ.db.settings.homepage.promoBanners = Array.isArray(TZ.db.settings.homepage.promoBanners)
            ? TZ.db.settings.homepage.promoBanners
            : [];
        CONTENT_FIELD_CONFIG.forEach((section) => {
            TZ.db.settings.content[section.key] = Array.isArray(TZ.db.settings.content[section.key])
                ? TZ.db.settings.content[section.key]
                : [];
        });
        TZ.db.settings.payments.walletTransferNumber =
            typeof TZ.db.settings.payments.walletTransferNumber === 'string'
                ? TZ.db.settings.payments.walletTransferNumber
                : '';
    }

    /**
     * Downloads JSON data as a file.
     *
     * @param {unknown} data
     * @param {string} filename
     * @returns {void}
     */
    function downloadJSON(data, filename) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
    }

    /**
     * Builds the editable content section HTML.
     *
     * @param {{ content?: Record<string, Array<Record<string, string>>> }} settings
     * @returns {string}
     */
    function renderEditableContentSection(settings) {
        const fieldsMarkup = CONTENT_FIELD_CONFIG.map((section) => `
            <div class="admin-form-group">
                <label>${section.label}</label>
                <textarea id="${section.inputId}" rows="${section.rows}" class="admin-textarea">${escapeText(serializeContentLines(settings.content?.[section.key], section.fields))}</textarea>
                <small style="color:var(--text-muted);display:block;margin-top:8px;">
                    <i class="fas ${section.icon}"></i> ${section.hint}
                </small>
            </div>
        `).join('');

        return `<div class="settings-section"><h3><i class="fas fa-pen-to-square"></i> محتوى الصفحات</h3><div class="settings-row">${fieldsMarkup}</div></div>`;
    }

    /**
     * Collects editable content values from the current form.
     *
     * @returns {Record<string, Array<Record<string, string>>>}
     */
    function collectEditableContent() {
        return Object.fromEntries(
            CONTENT_FIELD_CONFIG.map((section) => [
                section.key,
                parseContentLines(document.getElementById(section.inputId)?.value || '', section.fields, section.requiredFields)
            ])
        );
    }

    /**
     * Syncs imported backup records into the data layer.
     *
     * @param {Record<string, unknown>} data
     * @returns {void}
     */
    function syncImportedBackup(data) {
        const actorId = TZ.getSession()?.userId;
        (data.categories || []).forEach((item) => TZ.commitDb('backup_import_category', actorId, item.name || item.id, { type: 'category', data: item }));
        (data.products || []).forEach((item) => TZ.commitDb('backup_import_product', actorId, item.name || item.id, { type: 'product', data: item }));
        (data.coupons || []).forEach((item) => TZ.commitDb('backup_import_coupon', actorId, item.code || item.id, { type: 'coupon', data: item }));
        (data.services || []).forEach((item) => TZ.commitDb('backup_import_service', actorId, item.name || item.id, { type: 'service', data: item }));
        (data.repairServices || []).forEach((item) => TZ.commitDb('backup_import_repair_service', actorId, item.name || item.id, { type: 'repair_service', data: item }));
        if (data.settings) {
            TZ.commitDb('backup_import_settings', actorId, 'استيراد الإعدادات', { type: 'settings_update', data: TZ.db.settings });
        }
    }

    /**
     * Saves the settings form into local state and Supabase.
     *
     * @returns {Promise<void>}
     */
    async function saveSettings() {
        ensureSettingsShape();
        TZ.db.settings.company.name = document.getElementById('setCompanyName').value.trim();
        TZ.db.settings.company.slogan = document.getElementById('setSlogan').value.trim();
        TZ.db.settings.company.phone = document.getElementById('setPhone').value.trim();
        TZ.db.settings.company.email = document.getElementById('setEmail').value.trim();
        TZ.db.settings.company.address = document.getElementById('setAddress').value.trim();
        TZ.db.settings.payments.walletTransferNumber = document.getElementById('setWalletTransferNumber').value.trim();
        TZ.db.settings.shipping.standardFee = parseFloat(document.getElementById('setShipStd').value) || 0;
        TZ.db.settings.shipping.expressFee = parseFloat(document.getElementById('setShipExp').value) || 0;
        TZ.db.settings.shipping.freeShippingThreshold = parseFloat(document.getElementById('setFreeShip').value) || 0;
        TZ.db.settings.social.instagram = document.getElementById('setInsta').value.trim();
        TZ.db.settings.social.tiktok = document.getElementById('setTiktok').value.trim();
        TZ.db.settings.social.x = document.getElementById('setX').value.trim();
        TZ.db.settings.social.snapchat = document.getElementById('setSnap').value.trim();
        TZ.db.settings.content = collectEditableContent();
        TZ.db.settings.homepage.promoBanners = BannerEditor.collectPromoBanners(document.getElementById('promoBannerList'));
        TZ.db.settings.vatRate = (parseFloat(document.getElementById('setVat').value) || 15) / 100;
        await Promise.resolve(TZ.commitDb('settings_update', TZ.getSession()?.userId, 'تحديث الإعدادات', { type: 'settings_update', data: TZ.db.settings }));
    }

    /**
     * Inserts the wallet transfer number field into the settings form.
     *
     * @param {{ payments?: { walletTransferNumber?: string } }} settings
     * @returns {void}
     */
    function injectWalletTransferSection(settings) {
        const settingsForm = document.getElementById('settingsForm');
        const actions = settingsForm?.querySelector('.admin-form-actions');

        if (!settingsForm || !actions) {
            return;
        }

        const walletSection = document.createElement('div');
        walletSection.className = 'settings-section';
        walletSection.innerHTML = `
            <h3><i class="fas fa-wallet"></i> إعدادات الدفع عبر المحفظة</h3>
            <div class="admin-form-group" style="max-width:420px;">
                <label>رقم محفظة التحويل</label>
                <div class="admin-input-wrap">
                    <i class="fas fa-hashtag"></i>
                    <input type="text" id="setWalletTransferNumber" value="${escapeText(settings.payments?.walletTransferNumber || '')}" dir="ltr" placeholder="0791234567">
                </div>
                <small style="color:var(--text-muted);display:block;margin-top:8px;">
                    يظهر هذا الرقم تلقائيًا داخل نافذة الشراء عند اختيار الدفع بالمحفظة.
                </small>
            </div>
        `;

        actions.insertAdjacentElement('beforebegin', walletSection);
    }

    /**
     * Binds backup export and import interactions.
     *
     * @returns {void}
     */
    function bindBackupActions() {
        document.getElementById('exportProductsBtn').addEventListener('click', () => downloadJSON(TZ.db.products, 'techzone-products.json'));
        document.getElementById('exportCategoriesBtn').addEventListener('click', () => downloadJSON(TZ.db.categories, 'techzone-categories.json'));
        document.getElementById('exportFullBtn').addEventListener('click', () => downloadJSON({ _backup: true, _date: TZ.nowIso(), products: TZ.db.products, categories: TZ.db.categories, coupons: TZ.db.coupons, services: TZ.db.services, repairServices: TZ.db.repairServices, settings: TZ.db.settings }, `techzone-backup-${new Date().toISOString().slice(0, 10)}.json`));
        document.getElementById('importDataBtn').addEventListener('change', function () {
            const file = this.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (loadEvent) => {
                try {
                    const data = JSON.parse(loadEvent.target?.result || '{}');
                    if (!data._backup) throw new Error('الملف غير صالح.');
                    A.showConfirmModal('استيراد نسخة احتياطية', 'سيتم استبدال البيانات الحالية بمحتوى الملف. هل تريد المتابعة؟', () => {
                        if (data.products) TZ.db.products = data.products;
                        if (data.categories) TZ.db.categories = data.categories;
                        if (data.coupons) TZ.db.coupons = data.coupons;
                        if (data.services) TZ.db.services = data.services;
                        if (data.repairServices) TZ.db.repairServices = data.repairServices;
                        if (data.settings) TZ.db.settings = { ...TZ.db.settings, ...data.settings };
                        ensureSettingsShape();
                        syncImportedBackup(data);
                        renderSettings();
                        A.showToast('تم استيراد النسخة الاحتياطية بنجاح.');
                    });
                } catch (error) {
                    A.showToast(error?.message || 'تعذر قراءة ملف النسخة الاحتياطية.');
                }
            };
            reader.readAsText(file);
            this.value = '';
        });
    }

    /**
     * Renders the settings screen and wires all interactions.
     *
     * @returns {void}
     */
    function renderSettings() {
        ensureSettingsShape();
        const settings = TZ.db.settings;
        const banners = BannerEditor.normalizePromoBanners(settings.homepage.promoBanners);

        A.adminContent.innerHTML = `
            <form class="admin-form admin-form-stack" id="settingsForm">
                <div class="settings-section"><h3><i class="fas fa-building"></i> معلومات المتجر</h3><div class="settings-row"><div class="admin-form-group"><label>اسم المتجر</label><div class="admin-input-wrap"><i class="fas fa-store"></i><input type="text" id="setCompanyName" value="${escapeText(settings.company.name || '')}"></div></div><div class="admin-form-group"><label>العبارة التعريفية</label><div class="admin-input-wrap"><i class="fas fa-quote-right"></i><input type="text" id="setSlogan" value="${escapeText(settings.company.slogan || '')}"></div></div></div><div class="settings-row"><div class="admin-form-group"><label>الهاتف</label><div class="admin-input-wrap"><i class="fas fa-phone"></i><input type="text" id="setPhone" value="${escapeText(settings.company.phone || '')}" dir="ltr"></div></div><div class="admin-form-group"><label>البريد الإلكتروني</label><div class="admin-input-wrap"><i class="fas fa-envelope"></i><input type="email" id="setEmail" value="${escapeText(settings.company.email || '')}"></div></div></div><div class="admin-form-group"><label>العنوان</label><div class="admin-input-wrap"><i class="fas fa-map-marker-alt"></i><input type="text" id="setAddress" value="${escapeText(settings.company.address || '')}"></div></div></div>
                <div class="settings-section"><h3><i class="fas fa-truck"></i> إعدادات الشحن</h3><div class="settings-row"><div class="admin-form-group"><label>رسوم التوصيل العادي</label><div class="admin-input-wrap"><i class="fas fa-money-bill"></i><input type="number" id="setShipStd" value="${settings.shipping.standardFee || 0}" min="0"></div></div><div class="admin-form-group"><label>رسوم التوصيل السريع</label><div class="admin-input-wrap"><i class="fas fa-money-bill"></i><input type="number" id="setShipExp" value="${settings.shipping.expressFee || 0}" min="0"></div></div><div class="admin-form-group"><label>حد التوصيل المجاني</label><div class="admin-input-wrap"><i class="fas fa-money-bill"></i><input type="number" id="setFreeShip" value="${settings.shipping.freeShippingThreshold || 0}" min="0"></div></div></div></div>
                <div class="settings-section"><h3><i class="fas fa-share-alt"></i> الروابط الاجتماعية</h3><div class="settings-row"><div class="admin-form-group"><label>Instagram</label><div class="admin-input-wrap"><i class="fab fa-instagram"></i><input type="url" id="setInsta" value="${escapeText(settings.social.instagram || '')}" dir="ltr"></div></div><div class="admin-form-group"><label>TikTok</label><div class="admin-input-wrap"><i class="fab fa-tiktok"></i><input type="url" id="setTiktok" value="${escapeText(settings.social.tiktok || '')}" dir="ltr"></div></div><div class="admin-form-group"><label>X</label><div class="admin-input-wrap"><i class="fab fa-x-twitter"></i><input type="url" id="setX" value="${escapeText(settings.social.x || '')}" dir="ltr"></div></div><div class="admin-form-group"><label>Snapchat</label><div class="admin-input-wrap"><i class="fab fa-snapchat"></i><input type="url" id="setSnap" value="${escapeText(settings.social.snapchat || '')}" dir="ltr"></div></div></div></div>
                ${renderEditableContentSection(settings)}
                ${BannerEditor.renderPromoBannerSection(banners)}
                <div class="settings-section"><h3><i class="fas fa-percent"></i> الضريبة</h3><div class="admin-form-group" style="max-width:240px;"><label>نسبة الضريبة</label><div class="admin-input-wrap"><i class="fas fa-percent"></i><input type="number" id="setVat" value="${((settings.vatRate || 0.15) * 100)}" min="0" max="100" step="0.1"></div></div></div>
                <div class="admin-form-actions"><button type="submit" class="btn btn-primary btn-lg" id="saveSettingsBtn"><i class="fas fa-save"></i> حفظ الإعدادات</button><a href="/" target="_blank" class="btn btn-outline btn-lg"><i class="fas fa-external-link-alt"></i> معاينة الصفحة الرئيسية</a></div>
            </form>
            <div class="settings-section" style="margin-top:24px;"><h3><i class="fas fa-database"></i> النسخ الاحتياطي</h3><div class="admin-form-actions"><button class="btn btn-outline btn-sm" id="exportProductsBtn"><i class="fas fa-download"></i> تصدير المنتجات</button><button class="btn btn-outline btn-sm" id="exportCategoriesBtn"><i class="fas fa-download"></i> تصدير الفئات</button><button class="btn btn-outline btn-sm" id="exportFullBtn"><i class="fas fa-download"></i> تصدير نسخة كاملة</button><label class="btn btn-outline btn-sm"><i class="fas fa-upload"></i> استيراد نسخة<input type="file" id="importDataBtn" accept=".json" hidden></label></div></div>
        `;

        injectWalletTransferSection(settings);
        BannerEditor.bindPromoBannerEditor({ containerId: 'promoBannerList', addButtonId: 'addPromoBannerBtn', onToast: A.showToast });

        document.getElementById('settingsForm').addEventListener('submit', async (event) => {
            event.preventDefault();
            const button = document.getElementById('saveSettingsBtn');
            const originalLabel = button.innerHTML;
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جارٍ الحفظ...';
            try {
                await saveSettings();
                A.showToast('تم حفظ الإعدادات بنجاح.');
            } catch (error) {
                A.showToast(error?.message || 'تعذر حفظ الإعدادات.');
            } finally {
                button.disabled = false;
                button.innerHTML = originalLabel;
            }
        });

        bindBackupActions();
    }

    A.sections.settings = renderSettings;
})();
