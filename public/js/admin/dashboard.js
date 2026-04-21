/**
 * TechZone Admin — Dashboard Section (Rebuilt)
 *
 * Provides KPI overview, revenue/order charts, smart alerts,
 * activity timeline, quick actions, and system health monitoring.
 * All data is fetched live from Supabase.
 */
(function () {
    'use strict';

    var A = window.AdminApp;
    var DAYS_RANGE = 30;
    var EXCLUDED_STATUSES = { cancelled: 1, failed: 1, refunded: 1 };
    var PENDING_STATUSES = { pending: 1, processing: 1, in_progress: 1, awaiting_delivery: 1, awaiting_device: 1 };
    var chartRegistry = [];
    var chartLibPromise = null;

    /* ── helpers ── */

    function esc(v) { return TZ.escapeHtml(v == null ? '' : String(v)); }

    function toDayKey(v) { return new Date(v || Date.now()).toISOString().slice(0, 10); }

    function relativeTime(v) {
        var ms = Date.now() - new Date(v || Date.now()).getTime();
        var m = Math.max(1, Math.floor(ms / 60000));
        if (m < 60) return 'قبل ' + m + ' دقيقة';
        var h = Math.floor(m / 60);
        if (h < 24) return 'قبل ' + h + ' ساعة';
        return 'قبل ' + Math.floor(h / 24) + ' يوم';
    }

    function getTimeline(days) {
        var result = [];
        for (var i = 0; i < days; i++) {
            var d = new Date();
            d.setDate(d.getDate() - (days - i - 1));
            result.push({ key: toDayKey(d), label: d.toLocaleDateString('ar-JO', { month: 'short', day: 'numeric' }) });
        }
        return result;
    }

    /* ── load chart.js ── */

    function ensureChartLib() {
        if (window.Chart) return Promise.resolve();
        if (chartLibPromise) return chartLibPromise;
        var loader = window.__TZ_ADMIN_LOAD_EXTERNAL_SCRIPT;
        var url = window.__TZ_ADMIN_CHART_SCRIPT_URL;
        if (typeof loader !== 'function' || !url) return Promise.reject(new Error('Chart loader unavailable'));
        chartLibPromise = loader(url).catch(function (err) { chartLibPromise = null; throw err; });
        return chartLibPromise;
    }

    function destroyCharts() { chartRegistry.forEach(function (c) { c.destroy(); }); chartRegistry = []; }

    function makeChart(id, type, data) {
        var el = document.getElementById(id);
        if (!el || !window.Chart) return;
        chartRegistry.push(new window.Chart(el, {
            type: type, data: data,
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { labels: { color: '#dfe6f5', font: { family: 'Cairo' } } } },
                scales: type === 'doughnut' ? {} : {
                    x: { ticks: { color: '#95a1c4' }, grid: { color: 'rgba(255,255,255,0.04)' } },
                    y: { beginAtZero: true, ticks: { color: '#95a1c4' }, grid: { color: 'rgba(255,255,255,0.04)' } }
                }
            }
        }));
    }

    /* ── build insights ── */

    function buildInsights(db) {
        var timeline = getTimeline(DAYS_RANGE);
        var revenueByDay = {}, ordersByDay = {};
        var allOrders = (db.orders || []).concat(db.serviceOrders || []);

        allOrders.forEach(function (o) {
            var k = toDayKey(o.createdAt || o.created_at);
            ordersByDay[k] = (ordersByDay[k] || 0) + 1;
            if (!EXCLUDED_STATUSES[o.status]) revenueByDay[k] = (revenueByDay[k] || 0) + Number(o.total || 0);
        });
        (db.repairBookings || []).forEach(function (b) {
            var k = toDayKey(b.createdAt || b.created_at);
            ordersByDay[k] = (ordersByDay[k] || 0) + 1;
        });

        var totalRevenue = 0;
        for (var rk in revenueByDay) totalRevenue += revenueByDay[rk];

        return {
            totalProducts: (db.products || []).length,
            totalOrders: allOrders.length + (db.repairBookings || []).length,
            totalRevenue: totalRevenue,
            totalCustomers: (db.users || []).filter(function (u) { return TZ.isCustomerUser(u); }).length,
            pendingOrders:
                (db.orders || []).filter(function (o) { return PENDING_STATUSES[o.status]; }).length
                + (db.serviceOrders || []).filter(function (o) { return PENDING_STATUSES[o.status]; }).length
                + (db.repairBookings || []).filter(function (b) { return PENDING_STATUSES[b.status]; }).length,
            lowStock: (db.products || []).filter(function (p) { return p.quantity > 0 && p.quantity <= (p.lowStockAlert || 5); }).length,
            outOfStock: (db.products || []).filter(function (p) { return p.quantity <= 0; }).length,
            totalCategories: (db.categories || []).length,
            recentOrders: TZ.clone(db.orders || []).sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); }).slice(0, 5),
            topProducts: TZ.clone(db.products || []).sort(function (a, b) { return (b.sold || 0) - (a.sold || 0); }).slice(0, 8),
            timeline: timeline,
            revenueSeries: timeline.map(function (t) { return revenueByDay[t.key] || 0; }),
            orderSeries: timeline.map(function (t) { return ordersByDay[t.key] || 0; })
        };
    }

    /* ── smart alerts ── */

    function buildAlerts(db) {
        var alerts = [];
        var stale = Date.now() - 86400000;
        var low = (db.products || []).filter(function (p) { return p.quantity > 0 && p.quantity <= (p.lowStockAlert || 5); }).length;
        var stalePending = (db.orders || []).filter(function (o) { return PENDING_STATUSES[o.status] && new Date(o.createdAt).getTime() <= stale; }).length;
        var pendingDeposits = (db.deposits || []).filter(function (d) { return d.status === 'pending'; }).length;
        var unread = (db.contactMessages || []).filter(function (m) { return m.status === 'new'; }).length;
        var noImage = (db.products || []).filter(function (p) { return !Array.isArray(p.images) || p.images.length === 0; }).length;

        if (low) alerts.push({ tone: 'warning', icon: 'fa-layer-group', text: low + ' منتجات أقل من حد المخزون' });
        if (stalePending) alerts.push({ tone: 'orange', icon: 'fa-hourglass-half', text: stalePending + ' طلبات بانتظار التنفيذ منذ أكثر من 24 ساعة' });
        if (pendingDeposits) alerts.push({ tone: 'danger', icon: 'fa-money-check-alt', text: pendingDeposits + ' طلبات إيداع بانتظار الموافقة' });
        if (unread) alerts.push({ tone: 'info', icon: 'fa-envelope', text: unread + ' رسائل تواصل جديدة غير مقروءة' });
        if (noImage) alerts.push({ tone: 'warning', icon: 'fa-image', text: noImage + ' منتجات بدون صورة رئيسية' });

        return alerts.length ? alerts : [{ tone: 'success', icon: 'fa-shield-halved', text: 'لا توجد تنبيهات حرجة حالياً.' }];
    }

    /* ── activity timeline ── */

    function buildTimeline(db) {
        var items = [];

        (db.deposits || []).filter(function (d) { return d.status === 'pending'; }).slice(0, 3).forEach(function (d) {
            items.push({ icon: 'fa-money-check-alt', tone: 'danger', title: 'طلب إيداع جديد بانتظار الموافقة', sub: TZ.formatPrice(d.amount || 0), ts: d.createdAt || d.created_at });
        });
        (db.contactMessages || []).filter(function (m) { return m.status === 'new'; }).slice(0, 3).forEach(function (m) {
            items.push({ icon: 'fa-envelope', tone: 'info', title: 'رسالة تواصل جديدة', sub: m.name || m.email || 'رسالة', ts: m.createdAt || m.created_at });
        });
        (db.logs || []).slice(0, 5).forEach(function (l) {
            items.push({ icon: 'fa-circle', tone: 'info', title: l.action || 'نشاط', sub: l.details || '', ts: l.timestamp || l.createdAt });
        });

        return items.filter(function (i) { return i.ts; }).sort(function (a, b) { return new Date(b.ts) - new Date(a.ts); }).slice(0, 8);
    }

    /* ── health ── */

    function getHealth() {
        var h = TZ.health || {};
        return [
            { label: 'Supabase', value: h.supabase === 'connected' ? 'متصل' : 'خلل', tone: h.supabase === 'connected' ? 'active' : 'hidden' },
            { label: 'Realtime', value: h.realtime === 'connected' ? 'نشط' : h.realtime === 'connecting' ? 'جارٍ الربط' : 'متوقف', tone: h.realtime === 'connected' ? 'active' : 'pending' },
            { label: 'آخر تحديث', value: h.lastRefreshAt ? relativeTime(h.lastRefreshAt) : '—', tone: 'info' }
        ];
    }

    /* ══════════════════════════════════════
       RENDER
       ══════════════════════════════════════ */

    function renderDashboard() {
        Promise.all([
            Promise.resolve(typeof TZ.getQueuedCommits === 'function' ? TZ.getQueuedCommits() : []),
            ensureChartLib().catch(function () { return null; })
        ]).then(function (results) {
            var queued = results[0] || [];
            var ins = buildInsights(TZ.db);
            var alerts = buildAlerts(TZ.db);
            var timeline = buildTimeline(TZ.db);
            var health = getHealth();

            var html = '';

            /* ── KPI Cards ── */
            html += '<div class="stats-grid">'
                + kpi('fa-shopping-bag', 'blue', ins.totalOrders, 'إجمالي الطلبات')
                + kpi('fa-money-bill-wave', 'green', TZ.formatPrice(ins.totalRevenue), 'إجمالي الإيرادات')
                + kpi('fa-box', 'orange', ins.totalProducts, 'المنتجات')
                + kpi('fa-users', 'purple', ins.totalCustomers, 'العملاء')
                + '</div>';

            /* ── Quick Stats ── */
            html += '<div class="quick-stats-row">'
                + qstat(ins.pendingOrders, 'طلبات جديدة')
                + qstat(ins.lowStock, 'مخزون منخفض')
                + qstat(ins.outOfStock, 'نفد من المخزون')
                + qstat(ins.totalCategories, 'الفئات')
                + '</div>';

            /* ── Health ── */
            html += '<div class="admin-dashboard-health">';
            health.forEach(function (h) {
                html += '<div class="admin-dashboard-health-card"><span class="status-badge ' + h.tone + '">' + esc(h.value) + '</span><small>' + esc(h.label) + '</small></div>';
            });
            html += '<div class="admin-dashboard-health-card"><span class="status-badge ' + (navigator.onLine ? 'active' : 'pending') + '">' + (navigator.onLine ? 'متصل' : 'أوفلاين') + '</span><small>الاتصال</small></div>';
            html += '</div>';

            /* ── Quick Actions ── */
            html += '<div class="admin-dashboard-actions">'
                + '<button class="btn btn-primary btn-sm" data-dashboard-action="product"><i class="fas fa-plus"></i> إضافة منتج</button>'
                + '<button class="btn btn-outline btn-sm" data-dashboard-action="orders"><i class="fas fa-box-open"></i> الطلبات الجديدة</button>'
                + '<button class="btn btn-outline btn-sm" data-dashboard-action="notification"><i class="fas fa-bell"></i> أرسل إشعار</button>'
                + '</div>';

            /* ── Alerts ── */
            html += '<div class="admin-dashboard-alerts">';
            alerts.forEach(function (a) {
                html += '<div class="admin-dashboard-alert admin-dashboard-alert--' + a.tone + '"><i class="fas ' + a.icon + '"></i><span>' + esc(a.text) + '</span></div>';
            });
            html += '</div>';

            /* ── Charts ── */
            html += '<div class="admin-dashboard-chart-grid">'
                + chartPanel('fa-chart-line', 'الإيرادات خلال آخر 30 يوم', 'dashRevenueChart')
                + chartPanel('fa-chart-column', 'الأكثر مبيعاً', 'dashTopChart')
                + '</div>';

            /* ── Panels ── */
            html += '<div class="admin-dashboard-panels">';

            /* timeline */
            html += '<section class="admin-panel"><div class="panel-header"><h2><i class="fas fa-stream"></i> آخر الأنشطة</h2></div><div class="panel-body padded"><div class="admin-dashboard-timeline">';
            if (timeline.length === 0) {
                html += '<div class="empty-state"><i class="fas fa-inbox"></i><p>لا توجد أنشطة حديثة</p></div>';
            } else {
                timeline.forEach(function (t) {
                    html += '<div class="admin-dashboard-timeline-item"><span class="admin-dashboard-timeline-icon admin-dashboard-alert--' + t.tone + '"><i class="fas ' + t.icon + '"></i></span><div><strong>' + esc(t.title) + '</strong><p>' + esc(t.sub) + '</p><small>' + relativeTime(t.ts) + '</small></div></div>';
                });
            }
            html += '</div></div></section>';

            /* recent orders */
            html += '<section class="admin-panel"><div class="panel-header"><h2><i class="fas fa-clock"></i> آخر الطلبات</h2></div><div class="panel-body"><div class="table-wrap"><table class="data-table"><thead><tr>'
                + '<th>#</th><th>العميل</th><th>المبلغ</th><th>الحالة</th><th>التاريخ</th></tr></thead><tbody>';
            if (ins.recentOrders.length === 0) {
                html += '<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--text-muted);">لا توجد طلبات</td></tr>';
            } else {
                ins.recentOrders.forEach(function (o) {
                    html += '<tr>'
                        + '<td><small>' + esc(o.id) + '</small></td>'
                        + '<td>' + esc(o.customerName || o.customer_name || '-') + '</td>'
                        + '<td style="font-weight:600;color:#00b894;">' + TZ.formatPrice(o.total) + '</td>'
                        + '<td><span class="status-badge ' + o.status + '">' + A.statusLabel(o.status) + '</span></td>'
                        + '<td><small>' + A.formatDate(o.createdAt || o.created_at) + '</small></td>'
                        + '</tr>';
                });
            }
            html += '</tbody></table></div></div></section>';
            html += '</div>';

            A.adminContent.innerHTML = html;

            bindActions();
            destroyCharts();
            renderCharts(ins);
        });
    }

    /* ── markup helpers ── */

    function kpi(icon, color, val, label) {
        return '<div class="stat-card-admin"><div class="stat-icon ' + color + '"><i class="fas ' + icon + '"></i></div><div class="stat-info"><h3>' + val + '</h3><p>' + label + '</p></div></div>';
    }

    function qstat(val, label) {
        return '<div class="quick-stat"><div class="value">' + val + '</div><div class="label">' + label + '</div></div>';
    }

    function chartPanel(icon, title, canvasId) {
        return '<section class="admin-panel"><div class="panel-header"><h2><i class="fas ' + icon + '"></i> ' + title + '</h2></div><div class="panel-body padded"><div class="admin-chart-wrap"><canvas id="' + canvasId + '"></canvas></div></div></section>';
    }

    /* ── charts ── */

    function renderCharts(ins) {
        makeChart('dashRevenueChart', 'line', {
            labels: ins.timeline.map(function (t) { return t.label; }),
            datasets: [{ label: 'الإيرادات', data: ins.revenueSeries, borderColor: '#6c5ce7', backgroundColor: 'rgba(108,92,231,0.15)', fill: true, tension: 0.35 }]
        });
        makeChart('dashTopChart', 'bar', {
            labels: ins.topProducts.map(function (p) { return p.name; }),
            datasets: [{ label: 'المبيعات', data: ins.topProducts.map(function (p) { return p.sold || 0; }), backgroundColor: 'rgba(0,206,201,0.7)', borderRadius: 10, maxBarThickness: 28 }]
        });
    }

    /* ── quick actions ── */

    function bindActions() {
        document.querySelectorAll('[data-dashboard-action]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var action = btn.dataset.dashboardAction;
                if (action === 'orders') A.renderSection('orders', { history: 'push' });
                else if (action === 'product') A.renderSection('products', { history: 'push' });
                else if (action === 'notification') A.renderSection('notifications', { history: 'push' });
            });
        });
    }

    A.sections.dashboard = renderDashboard;
})();
