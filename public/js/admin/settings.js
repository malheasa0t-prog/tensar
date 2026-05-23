/**
 * TechZone Admin — Settings Section (Rebuilt)
 *
 * Manages store settings via the 'settings' table (single-row, JSONB data field).
 */
(function () {
    'use strict';

    var A = window.AdminApp;
    if (!A) return;

    function esc(v) { return TZ.escapeHtml(v == null ? '' : String(v)); }

    function getSettings() {
        return TZ.db.settings || {};
    }

    async function saveSettings(data) {
        var result = await TZ.supabase.from('settings').update({ data: data, updated_at: new Date().toISOString() }).eq('id', 1);
        if (result.error) { A.showErrorToast('STG-301', 'فشل حفظ الإعدادات: ' + (result.error.message || '')); return false; }
        A.showToast('تم حفظ الإعدادات بنجاح');
        return true;
    }

    function renderSettings() {
        var s = getSettings();
        var activeTab = 'general';

        var html = '<div class="admin-section-header"><div><h2><i class="fas fa-cog"></i> الإعدادات</h2></div></div>';

        html += '<div class="admin-tabs" id="settingsTabs">'
            + '<button class="admin-tab active" data-stab="general"><i class="fas fa-store"></i> معلومات المتجر</button>'
            + '<button class="admin-tab" data-stab="contact"><i class="fas fa-phone"></i> التواصل</button>'
            + '<button class="admin-tab" data-stab="payment"><i class="fas fa-credit-card"></i> الدفع والشحن</button>'
            + '<button class="admin-tab" data-stab="social"><i class="fas fa-share-alt"></i> التواصل الاجتماعي</button>'
            + '<button class="admin-tab" data-stab="system"><i class="fas fa-server"></i> النظام</button>'
            + '</div>';

        /* ── General Tab ── */
        html += '<div class="admin-panel settings-tab-content" id="tab-general"><div class="panel-body padded"><form class="admin-form" id="settingsGeneralForm"><div class="form-grid">'
            + field('اسم المتجر', 'fa-store', 'text', 'setStoreName', s.storeName || s.store_name || '')
            + field('وصف المتجر', 'fa-align-left', 'text', 'setStoreDesc', s.storeDescription || s.store_description || '')
            + field('العملة الافتراضية', 'fa-money-bill', 'text', 'setCurrency', s.currency || 'JOD')
            + field('اللغة الافتراضية', 'fa-language', 'text', 'setLanguage', s.language || 'ar')
            + '</div><div class="admin-form-actions"><button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> حفظ الإعدادات</button></div></form></div></div>';

        /* ── Contact Tab ── */
        html += '<div class="admin-panel settings-tab-content" id="tab-contact" style="display:none;"><div class="panel-body padded"><form class="admin-form" id="settingsContactForm"><div class="form-grid">'
            + field('البريد الإلكتروني', 'fa-envelope', 'email', 'setEmail', s.contactEmail || s.contact_email || '')
            + field('رقم الهاتف', 'fa-phone', 'text', 'setPhone', s.contactPhone || s.contact_phone || '')
            + field('واتساب', 'fa-whatsapp', 'text', 'setWhatsapp', s.whatsapp || '')
            + field('العنوان', 'fa-map-marker-alt', 'text', 'setAddress', s.address || '')
            + '</div><div class="admin-form-actions"><button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> حفظ</button></div></form></div></div>';

        /* ── Payment Tab ── */
        html += '<div class="admin-panel settings-tab-content" id="tab-payment" style="display:none;"><div class="panel-body padded"><form class="admin-form" id="settingsPaymentForm"><div class="form-grid">'
            + field('رسوم التوصيل', 'fa-truck', 'number', 'setShipping', s.shippingFee || s.shipping_fee || 0)
            + field('الحد الأدنى للتوصيل المجاني', 'fa-gift', 'number', 'setFreeShipping', s.freeShippingThreshold || s.free_shipping_threshold || 0)
            + field('نسبة الضريبة %', 'fa-receipt', 'number', 'setTax', s.taxRate || s.tax_rate || 0)
            + '</div><div class="admin-form-actions"><button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> حفظ</button></div></form></div></div>';

        /* ── Social Tab ── */
        html += '<div class="admin-panel settings-tab-content" id="tab-social" style="display:none;"><div class="panel-body padded"><form class="admin-form" id="settingsSocialForm"><div class="form-grid">'
            + field('فيسبوك', 'fa-facebook', 'url', 'setSocFb', s.facebook || '')
            + field('انستاغرام', 'fa-instagram', 'url', 'setSocIg', s.instagram || '')
            + field('تويتر / X', 'fa-twitter', 'url', 'setSocTw', s.twitter || '')
            + field('تيك توك', 'fa-tiktok', 'url', 'setSocTt', s.tiktok || '')
            + '</div><div class="admin-form-actions"><button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> حفظ</button></div></form></div></div>';

        /* ── System Tab (Maintenance Mode) ── */
        var isMaintenanceOn = !!s.maintenanceMode;
        html += '<div class="admin-panel settings-tab-content" id="tab-system" style="display:none;"><div class="panel-body padded">'
            + '<div class="admin-maintenance-card">'
            + '<div class="admin-maintenance-header">'
            + '<div class="admin-maintenance-icon"><i class="fas fa-hard-hat"></i></div>'
            + '<div><h3>تفعيل وضع الصيانة</h3>'
            + '<p>عند التفعيل، سيرى الزوار صفحة صيانة بدلاً من الموقع. أنت كأدمن ستتمكن من تصفح الموقع بشكل طبيعي.</p></div>'
            + '</div>'
            + '<div class="admin-maintenance-toggle">'
            + '<label class="admin-switch" for="maintenanceModeToggle">'
            + '<input type="checkbox" id="maintenanceModeToggle"' + (isMaintenanceOn ? ' checked' : '') + '>'
            + '<span class="admin-switch-slider"></span>'
            + '</label>'
            + '<span class="admin-maintenance-status" id="maintenanceStatus">'
            + (isMaintenanceOn ? '<i class="fas fa-circle" style="color:#ef4444;font-size:8px"></i> وضع الصيانة مفعّل' : '<i class="fas fa-circle" style="color:#22c55e;font-size:8px"></i> الموقع يعمل بشكل طبيعي')
            + '</span>'
            + '</div>'
            + '</div>'
            + '</div></div>';

        A.adminContent.innerHTML = html;

        /* Tab switching */
        document.querySelectorAll('#settingsTabs .admin-tab').forEach(function (tab) {
            tab.addEventListener('click', function () {
                document.querySelectorAll('#settingsTabs .admin-tab').forEach(function (t) { t.classList.remove('active'); });
                tab.classList.add('active');
                document.querySelectorAll('.settings-tab-content').forEach(function (c) { c.style.display = 'none'; });
                document.getElementById('tab-' + tab.dataset.stab).style.display = 'block';
            });
        });

        /* Maintenance mode toggle */
        var toggleEl = document.getElementById('maintenanceModeToggle');
        if (toggleEl) {
            toggleEl.addEventListener('change', async function () {
                var on = toggleEl.checked;
                var currentData = getSettings();
                var merged = Object.assign({}, currentData, { maintenanceMode: on });
                toggleEl.disabled = true;
                var ok = await saveSettings(merged);
                toggleEl.disabled = false;
                if (ok) {
                    await TZ.refreshData();
                    var statusEl = document.getElementById('maintenanceStatus');
                    if (statusEl) {
                        statusEl.innerHTML = on
                            ? '<i class="fas fa-circle" style="color:#ef4444;font-size:8px"></i> وضع الصيانة مفعّل'
                            : '<i class="fas fa-circle" style="color:#22c55e;font-size:8px"></i> الموقع يعمل بشكل طبيعي';
                    }
                } else {
                    toggleEl.checked = !on;
                }
            });
        }

        /* Form handlers */
        bindSettingsForm('settingsGeneralForm', { storeName: 'setStoreName', storeDescription: 'setStoreDesc', currency: 'setCurrency', language: 'setLanguage' });
        bindSettingsForm('settingsContactForm', { contactEmail: 'setEmail', contactPhone: 'setPhone', whatsapp: 'setWhatsapp', address: 'setAddress' });
        bindSettingsForm('settingsPaymentForm', { shippingFee: 'setShipping', freeShippingThreshold: 'setFreeShipping', taxRate: 'setTax' });
        bindSettingsForm('settingsSocialForm', { facebook: 'setSocFb', instagram: 'setSocIg', twitter: 'setSocTw', tiktok: 'setSocTt' });
    }

    function field(label, icon, type, id, value) {
        return '<div class="admin-form-group"><label>' + label + '</label><div class="admin-input-wrap"><i class="fas ' + icon + '"></i>'
            + '<input type="' + type + '" id="' + id + '" value="' + esc(value) + '"></div></div>';
    }

    function bindSettingsForm(formId, fieldMap) {
        var form = document.getElementById(formId);
        if (!form) return;
        form.addEventListener('submit', async function (e) {
            e.preventDefault();
            var currentData = getSettings();
            var merged = Object.assign({}, currentData);
            Object.keys(fieldMap).forEach(function (key) {
                var el = document.getElementById(fieldMap[key]);
                if (el) merged[key] = el.type === 'number' ? Number(el.value) : el.value.trim();
            });
            var btn = form.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';
            var ok = await saveSettings(merged);
            if (ok) { await TZ.refreshData(); }
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-save"></i> حفظ';
        });
    }

    A.sections.settings = renderSettings;
})();
