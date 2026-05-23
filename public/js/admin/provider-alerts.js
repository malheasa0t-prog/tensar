/**
 * TechZone Admin — Provider Alerts Section
 *
 * Displays the Serva-S provider balance and generates alerts
 * when the balance drops below configurable thresholds.
 */
(function () {
    'use strict';

    var A = window.AdminApp;
    if (!A) return;

    var BALANCE_ENDPOINT = '/api/provider/balance';
    var LOW_BALANCE_THRESHOLD = 50;
    var CRITICAL_BALANCE_THRESHOLD = 10;

    function esc(v) { return TZ.escapeHtml(v == null ? '' : String(v)); }

    /**
     * Fetches the provider balance from the backend API.
     *
     * @returns {Promise<{ success: boolean, balance?: string, currency?: string, error?: string }>}
     */
    /**
     * Retrieves the current Supabase session access token.
     *
     * @returns {Promise<string>} JWT access token or empty string.
     */
    async function getAccessToken() {
        try {
            var session = (await TZ.supabase.auth.getSession())?.data?.session;
            return session?.access_token || '';
        } catch (error) {
            return '';
        }
    }

    async function fetchProviderBalance() {
        try {
            var token = await getAccessToken();
            if (!token) {
                return { success: false, error: 'غير مسجل الدخول — أعد تسجيل الدخول' };
            }
            var response = await fetch(BALANCE_ENDPOINT, {
                cache: 'no-store',
                headers: {
                    'Accept': 'application/json',
                    'Authorization': 'Bearer ' + token
                }
            });
            if (!response.ok) {
                return { success: false, error: 'HTTP ' + response.status };
            }
            return await response.json();
        } catch (error) {
            return { success: false, error: error.message || 'فشل الاتصال بالمزود' };
        }
    }

    /**
     * Determines balance alert level.
     *
     * @param {number} balance
     * @returns {{ level: string, color: string, bg: string, icon: string, message: string }}
     */
    function getBalanceAlert(balance) {
        if (balance <= CRITICAL_BALANCE_THRESHOLD) {
            return {
                level: 'critical',
                color: '#ff4757',
                bg: 'rgba(255,71,87,0.08)',
                icon: 'fas fa-exclamation-triangle',
                message: 'رصيد المزود منخفض جداً! يجب شحن الرصيد فوراً لتجنب توقف الخدمات.'
            };
        }
        if (balance <= LOW_BALANCE_THRESHOLD) {
            return {
                level: 'warning',
                color: '#f59e0b',
                bg: 'rgba(245,158,11,0.08)',
                icon: 'fas fa-exclamation-circle',
                message: 'رصيد المزود يقترب من النفاد. يُنصح بشحن الرصيد قريباً.'
            };
        }
        return {
            level: 'healthy',
            color: '#00b894',
            bg: 'rgba(0,184,148,0.08)',
            icon: 'fas fa-check-circle',
            message: 'رصيد المزود في وضع جيد.'
        };
    }

    /**
     * Builds the balance display card HTML.
     *
     * @param {{ balance: string, currency: string }} data
     * @returns {string}
     */
    function buildBalanceCard(data) {
        var balance = Number(data.balance || 0);
        var currency = data.currency || 'USD';
        var alert = getBalanceAlert(balance);

        var html = '<div style="display:grid;gap:1.5rem;">';

        /* Balance display */
        html += '<div style="text-align:center;padding:2.5rem 2rem;border-radius:20px;'
            + 'background:linear-gradient(165deg,rgba(255,255,255,0.04) 0%,rgba(255,255,255,0.01) 100%);'
            + 'border:1px solid rgba(108,92,231,0.15);position:relative;overflow:hidden;">'
            + '<div style="position:absolute;inset:0;background:radial-gradient(circle at 50% 0%,rgba(108,92,231,0.08),transparent 60%);pointer-events:none;"></div>'
            + '<div style="position:relative;z-index:1;">'
            + '<div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:0.75rem;"><i class="fas fa-server" style="margin-left:6px;"></i> رصيد حساب Serva-S</div>'
            + '<div style="font-size:3rem;font-weight:900;color:' + alert.color + ';line-height:1.2;letter-spacing:-1px;">'
            + balance.toFixed(2)
            + '</div>'
            + '<div style="font-size:0.9rem;color:var(--text-muted);margin-top:0.5rem;">' + esc(currency) + '</div>'
            + '</div></div>';

        /* Alert banner */
        html += '<div style="display:flex;align-items:center;gap:12px;padding:16px 20px;border-radius:14px;'
            + 'background:' + alert.bg + ';border:1px solid ' + alert.color + '22;">'
            + '<i class="' + alert.icon + '" style="font-size:1.3rem;color:' + alert.color + ';flex-shrink:0;"></i>'
            + '<div style="flex:1;">'
            + '<strong style="color:' + alert.color + ';">'
            + (alert.level === 'critical' ? 'تحذير حرج!' : alert.level === 'warning' ? 'تنبيه' : 'حالة جيدة')
            + '</strong>'
            + '<p style="margin:4px 0 0;color:var(--text-secondary);font-size:0.88rem;line-height:1.6;">' + alert.message + '</p>'
            + '</div></div>';

        /* Quick stats */
        html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;">';

        var stats = [
            { label: 'حالة الرصيد', value: alert.level === 'healthy' ? 'جيد' : alert.level === 'warning' ? 'منخفض' : 'حرج', icon: 'fa-battery-' + (alert.level === 'healthy' ? 'full' : alert.level === 'warning' ? 'half' : 'empty'), color: alert.color },
            { label: 'العملة', value: currency, icon: 'fa-coins', color: '#6c5ce7' },
            { label: 'حد التنبيه', value: LOW_BALANCE_THRESHOLD + ' ' + currency, icon: 'fa-bell', color: '#f59e0b' },
            { label: 'حد الحرج', value: CRITICAL_BALANCE_THRESHOLD + ' ' + currency, icon: 'fa-skull-crossbones', color: '#ff4757' }
        ];

        stats.forEach(function (s) {
            html += '<div style="padding:16px;border-radius:14px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);text-align:center;">'
                + '<i class="fas ' + s.icon + '" style="font-size:1.2rem;color:' + s.color + ';margin-bottom:8px;display:block;"></i>'
                + '<small style="color:var(--text-muted);display:block;margin-bottom:4px;">' + s.label + '</small>'
                + '<strong>' + esc(s.value) + '</strong>'
                + '</div>';
        });

        html += '</div>';

        /* Provider info */
        html += '<div style="padding:16px 20px;border-radius:14px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);">'
            + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">'
            + '<i class="fas fa-link" style="color:#6c5ce7;"></i>'
            + '<strong>معلومات المزود</strong></div>'
            + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:0.88rem;">'
            + '<div><small style="color:var(--text-muted);">المزود</small><br><strong>Serva-S</strong></div>'
            + '<div><small style="color:var(--text-muted);">الموقع</small><br><a href="https://serva-s.com" target="_blank" style="color:#6c5ce7;">serva-s.com</a></div>'
            + '<div><small style="color:var(--text-muted);">آخر فحص</small><br><strong>' + new Date().toLocaleString('ar-JO') + '</strong></div>'
            + '<div><small style="color:var(--text-muted);">الحالة</small><br><span style="color:' + alert.color + ';">● متصل</span></div>'
            + '</div></div>';

        html += '</div>';
        return html;
    }

    /**
     * Builds an error display when the API call fails.
     *
     * @param {string} errorMessage
     * @returns {string}
     */
    function buildErrorCard(errorMessage) {
        return '<div style="text-align:center;padding:3rem 2rem;border-radius:20px;'
            + 'background:rgba(255,71,87,0.05);border:1px solid rgba(255,71,87,0.15);">'
            + '<i class="fas fa-plug" style="font-size:2.5rem;color:#ff4757;margin-bottom:1rem;display:block;"></i>'
            + '<h3 style="color:#ff4757;margin:0 0 0.5rem;">تعذر الاتصال بالمزود</h3>'
            + '<p style="color:var(--text-muted);margin:0;font-size:0.9rem;">' + esc(errorMessage) + '</p>'
            + '</div>';
    }

    /**
     * Renders the provider alerts section.
     */
    async function renderProviderAlerts() {
        A.adminContent.innerHTML = '<div class="admin-section-header"><div>'
            + '<h2><i class="fas fa-satellite-dish"></i> تنبيهات المزود</h2>'
            + '<p>حالة رصيد المزود من serva-s.com</p>'
            + '</div></div>'
            + '<div class="admin-panel"><div class="panel-body"><div class="empty-state">'
            + '<i class="fas fa-spinner fa-spin"></i><p>جاري الاتصال بالمزود...</p>'
            + '</div></div></div>';

        var result = await fetchProviderBalance();

        var html = '<div class="admin-section-header"><div>'
            + '<h2><i class="fas fa-satellite-dish"></i> تنبيهات المزود</h2>'
            + '<p>حالة رصيد المزود من serva-s.com</p>'
            + '</div><div>'
            + '<button class="btn btn-primary" id="refreshBalanceBtn"><i class="fas fa-sync-alt"></i> تحديث الآن</button>'
            + '</div></div>';

        html += '<div class="admin-panel"><div class="panel-body padded">';

        if (result.success) {
            html += buildBalanceCard(result);
        } else {
            html += buildErrorCard(result.error || 'خطأ غير معروف');
        }

        html += '</div></div>';

        A.adminContent.innerHTML = html;

        document.getElementById('refreshBalanceBtn')?.addEventListener('click', function () {
            renderProviderAlerts();
        });
    }

    A.sections['provider-alerts'] = renderProviderAlerts;
})();
