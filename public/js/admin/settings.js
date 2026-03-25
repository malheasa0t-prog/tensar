// ===== TechZone Admin - Settings =====
(function () {
    'use strict';
    const A = window.AdminApp;

    const DEFAULT_MARQUEE_ITEMS = [
        'عروض مميزة على أجهزة الألعاب',
        'توصيل مجاني للطلبات فوق 50 د.أ',
        'ضمان سنتين على المنتجات المشمولة',
        'حجز صيانة سريع مع متابعة واضحة'
    ];

    function ensureSettingsShape() {
        if (!TZ.db.settings.social) TZ.db.settings.social = {};
        if (!TZ.db.settings.homepage) TZ.db.settings.homepage = {};
        if (!TZ.db.settings.homepage.marquee) {
            TZ.db.settings.homepage.marquee = {
                enabled: true,
                items: [...DEFAULT_MARQUEE_ITEMS]
            };
        }
        if (!Array.isArray(TZ.db.settings.homepage.marquee.items)) {
            TZ.db.settings.homepage.marquee.items = [...DEFAULT_MARQUEE_ITEMS];
        }
    }

    function renderSettings() {
        ensureSettingsShape();
        const s = TZ.db.settings;
        const marqueeItems = s.homepage.marquee.items.join('\n');

        A.adminContent.innerHTML = `
            <form class="admin-form" id="settingsForm" style="max-width:100%;">
                <div class="settings-section">
                    <h3><i class="fas fa-building"></i> معلومات الشركة</h3>
                    <div class="settings-row">
                        <div class="admin-form-group">
                            <label>اسم الشركة</label>
                            <div class="admin-input-wrap"><i class="fas fa-store"></i><input type="text" id="setCompanyName" value="${TZ.escapeHtml(s.company.name || '')}"></div>
                        </div>
                        <div class="admin-form-group">
                            <label>الشعار / الوصف</label>
                            <div class="admin-input-wrap"><i class="fas fa-quote-right"></i><input type="text" id="setSlogan" value="${TZ.escapeHtml(s.company.slogan || '')}"></div>
                        </div>
                    </div>
                    <div class="settings-row">
                        <div class="admin-form-group">
                            <label>الهاتف</label>
                            <div class="admin-input-wrap"><i class="fas fa-phone"></i><input type="text" id="setPhone" value="${TZ.escapeHtml(s.company.phone || '')}" dir="ltr"></div>
                        </div>
                        <div class="admin-form-group">
                            <label>البريد</label>
                            <div class="admin-input-wrap"><i class="fas fa-envelope"></i><input type="email" id="setEmail" value="${TZ.escapeHtml(s.company.email || '')}"></div>
                        </div>
                    </div>
                    <div class="admin-form-group">
                        <label>العنوان</label>
                        <div class="admin-input-wrap"><i class="fas fa-map-marker-alt"></i><input type="text" id="setAddress" value="${TZ.escapeHtml(s.company.address || '')}"></div>
                    </div>
                </div>

                <div class="settings-section">
                    <h3><i class="fas fa-truck"></i> الشحن</h3>
                    <div class="settings-row">
                        <div class="admin-form-group">
                            <label>رسوم التوصيل العادي</label>
                            <div class="admin-input-wrap"><i class="fas fa-money-bill"></i><input type="number" id="setShipStd" value="${s.shipping.standardFee || 0}" min="0"></div>
                        </div>
                        <div class="admin-form-group">
                            <label>رسوم التوصيل السريع</label>
                            <div class="admin-input-wrap"><i class="fas fa-money-bill"></i><input type="number" id="setShipExp" value="${s.shipping.expressFee || 0}" min="0"></div>
                        </div>
                        <div class="admin-form-group">
                            <label>حد التوصيل المجاني</label>
                            <div class="admin-input-wrap"><i class="fas fa-money-bill"></i><input type="number" id="setFreeShip" value="${s.shipping.freeShippingThreshold || 0}" min="0"></div>
                        </div>
                    </div>
                </div>

                <div class="settings-section">
                    <h3><i class="fas fa-share-alt"></i> وسائل التواصل</h3>
                    <div class="settings-row">
                        <div class="admin-form-group">
                            <label>Instagram</label>
                            <div class="admin-input-wrap"><i class="fab fa-instagram"></i><input type="url" id="setInsta" value="${TZ.escapeHtml((s.social && s.social.instagram) || '')}" dir="ltr"></div>
                        </div>
                        <div class="admin-form-group">
                            <label>TikTok</label>
                            <div class="admin-input-wrap"><i class="fab fa-tiktok"></i><input type="url" id="setTiktok" value="${TZ.escapeHtml((s.social && s.social.tiktok) || '')}" dir="ltr"></div>
                        </div>
                        <div class="admin-form-group">
                            <label>X (Twitter)</label>
                            <div class="admin-input-wrap"><i class="fab fa-x-twitter"></i><input type="url" id="setX" value="${TZ.escapeHtml((s.social && s.social.x) || '')}" dir="ltr"></div>
                        </div>
                        <div class="admin-form-group">
                            <label>Snapchat</label>
                            <div class="admin-input-wrap"><i class="fab fa-snapchat"></i><input type="url" id="setSnap" value="${TZ.escapeHtml((s.social && s.social.snapchat) || '')}" dir="ltr"></div>
                        </div>
                    </div>
                </div>

                <div class="settings-section">
                    <h3><i class="fas fa-bullhorn"></i> الشريط المتحرك في الرئيسية</h3>
                    <div class="admin-form-group">
                        <label style="display:flex;align-items:center;gap:10px;">
                            <input type="checkbox" id="setMarqueeEnabled" ${s.homepage.marquee.enabled !== false ? 'checked' : ''} style="width:auto;">
                            تفعيل الشريط المتحرك في الصفحة الرئيسية
                        </label>
                    </div>
                    <div class="admin-form-group">
                        <label>رسائل الشريط</label>
                        <textarea id="setMarqueeItems" rows="6" style="width:100%;padding:14px 16px;border-radius:16px;border:1px solid rgba(148,163,184,0.16);background:rgba(255,255,255,0.04);color:inherit;font:inherit;resize:vertical;">${TZ.escapeHtml(marqueeItems)}</textarea>
                        <small style="color:var(--text-muted);display:block;margin-top:8px;">كل سطر يمثل رسالة مستقلة. ستظهر الرسائل بنفس ترتيبها داخل الشريط المتحرك.</small>
                    </div>
                </div>

                <div class="settings-section">
                    <h3><i class="fas fa-percent"></i> الضريبة</h3>
                    <div class="admin-form-group" style="max-width:250px;">
                        <label>نسبة ضريبة القيمة المضافة</label>
                        <div class="admin-input-wrap"><i class="fas fa-percent"></i><input type="number" id="setVat" value="${((s.vatRate || 0.15) * 100)}" min="0" max="100" step="0.1"></div>
                    </div>
                </div>

                <button type="submit" class="btn btn-primary btn-lg"><i class="fas fa-save"></i> حفظ الإعدادات</button>
            </form>

            <div class="settings-section" style="margin-top:30px;">
                <h3><i class="fas fa-database"></i> تصدير واستيراد البيانات</h3>
                <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:15px;">
                    <button class="btn btn-outline btn-sm" id="exportProductsBtn"><i class="fas fa-download"></i> تصدير المنتجات JSON</button>
                    <button class="btn btn-outline btn-sm" id="exportCategoriesBtn"><i class="fas fa-download"></i> تصدير الفئات JSON</button>
                    <button class="btn btn-outline btn-sm" id="exportFullBtn"><i class="fas fa-download"></i> نسخة احتياطية كاملة</button>
                </div>
                <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
                    <label class="btn btn-outline btn-sm" style="cursor:pointer;"><i class="fas fa-upload"></i> استيراد بيانات<input type="file" id="importDataBtn" accept=".json" style="display:none;"></label>
                    <small style="color:var(--text-muted);">يدعم ملفات النسخ الاحتياطي JSON</small>
                </div>
            </div>
        `;

        document.getElementById('settingsForm').addEventListener('submit', function (e) {
            e.preventDefault();
            ensureSettingsShape();

            TZ.db.settings.company.name = document.getElementById('setCompanyName').value.trim();
            TZ.db.settings.company.slogan = document.getElementById('setSlogan').value.trim();
            TZ.db.settings.company.phone = document.getElementById('setPhone').value.trim();
            TZ.db.settings.company.email = document.getElementById('setEmail').value.trim();
            TZ.db.settings.company.address = document.getElementById('setAddress').value.trim();
            TZ.db.settings.shipping.standardFee = parseFloat(document.getElementById('setShipStd').value) || 0;
            TZ.db.settings.shipping.expressFee = parseFloat(document.getElementById('setShipExp').value) || 0;
            TZ.db.settings.shipping.freeShippingThreshold = parseFloat(document.getElementById('setFreeShip').value) || 0;
            TZ.db.settings.social.instagram = document.getElementById('setInsta').value.trim();
            TZ.db.settings.social.tiktok = document.getElementById('setTiktok').value.trim();
            TZ.db.settings.social.x = document.getElementById('setX').value.trim();
            TZ.db.settings.social.snapchat = document.getElementById('setSnap').value.trim();
            TZ.db.settings.homepage.marquee.enabled = document.getElementById('setMarqueeEnabled').checked;
            TZ.db.settings.homepage.marquee.items = document
                .getElementById('setMarqueeItems')
                .value
                .split('\n')
                .map((item) => item.trim())
                .filter(Boolean);
            TZ.db.settings.vatRate = (parseFloat(document.getElementById('setVat').value) || 15) / 100;

            TZ.commitDb('settings_update', TZ.getSession()?.userId, 'تحديث الإعدادات', {
                type: 'settings_update',
                data: TZ.db.settings
            });
            A.showToast('تم حفظ الإعدادات بنجاح');
        });

        function downloadJSON(data, filename) {
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8;' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = filename;
            a.click();
        }

        function syncImportedBackup(data) {
            const actorId = TZ.getSession()?.userId;

            (data.categories || []).forEach((item) => {
                TZ.commitDb('backup_import_category', actorId, item.name || item.id, { type: 'category', data: item });
            });

            (data.products || []).forEach((item) => {
                TZ.commitDb('backup_import_product', actorId, item.name || item.id, { type: 'product', data: item });
            });

            (data.coupons || []).forEach((item) => {
                TZ.commitDb('backup_import_coupon', actorId, item.code || item.id, { type: 'coupon', data: item });
            });

            (data.services || []).forEach((item) => {
                TZ.commitDb('backup_import_service', actorId, item.name || item.id, { type: 'service', data: item });
            });

            (data.repairServices || []).forEach((item) => {
                TZ.commitDb('backup_import_repair_service', actorId, item.name || item.id, { type: 'repair_service', data: item });
            });

            if (data.settings) {
                TZ.commitDb('backup_import_settings', actorId, 'استيراد الإعدادات', {
                    type: 'settings_update',
                    data: TZ.db.settings
                });
            }
        }

        document.getElementById('exportProductsBtn').addEventListener('click', () => {
            downloadJSON(TZ.db.products, 'techzone-products.json');
            A.showToast('تم تصدير المنتجات');
        });

        document.getElementById('exportCategoriesBtn').addEventListener('click', () => {
            downloadJSON(TZ.db.categories, 'techzone-categories.json');
            A.showToast('تم تصدير الفئات');
        });

        document.getElementById('exportFullBtn').addEventListener('click', () => {
            const backup = {
                _backup: true,
                _date: TZ.nowIso(),
                products: TZ.db.products,
                categories: TZ.db.categories,
                coupons: TZ.db.coupons,
                services: TZ.db.services,
                repairServices: TZ.db.repairServices,
                settings: TZ.db.settings
            };
            downloadJSON(backup, 'techzone-backup-' + new Date().toISOString().slice(0, 10) + '.json');
            A.showToast('تم تصدير النسخة الاحتياطية الكاملة');
        });

        document.getElementById('importDataBtn').addEventListener('change', function () {
            const file = this.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function (e) {
                try {
                    const data = JSON.parse(e.target.result);

                    if (data._backup) {
                        A.showConfirmModal('استيراد بيانات', 'سيتم استبدال البيانات الحالية بالنسخة الاحتياطية. هل تريد المتابعة؟', () => {
                            if (data.products) TZ.db.products = data.products;
                            if (data.categories) TZ.db.categories = data.categories;
                            if (data.coupons) TZ.db.coupons = data.coupons;
                            if (data.services) TZ.db.services = data.services;
                            if (data.repairServices) TZ.db.repairServices = data.repairServices;
                            if (data.settings) TZ.db.settings = { ...TZ.db.settings, ...data.settings };
                            ensureSettingsShape();
                            syncImportedBackup(data);
                            A.showToast('تم استيراد النسخة الاحتياطية بنجاح');
                            renderSettings();
                        });
                    } else if (Array.isArray(data)) {
                        A.showToast('هذا ملف بيانات جزئي. استخدم النسخة الاحتياطية الكاملة للاستيراد.');
                    } else {
                        A.showToast('ملف غير صالح');
                    }
                } catch (err) {
                    A.showToast('حدث خطأ أثناء قراءة الملف');
                }
            };

            reader.readAsText(file);
            this.value = '';
        });
    }

    A.sections.settings = renderSettings;
})();
