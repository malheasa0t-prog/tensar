// ===== TechZone Admin - Dashboard =====
(function () {
    'use strict';

    const A = window.AdminApp;
    const EXCLUDED_REVENUE_STATUSES = new Set(['cancelled', 'failed', 'refunded']);
    const PENDING_ORDER_STATUSES = new Set(['awaiting_delivery', 'awaiting_device', 'pending', 'processing', 'in_progress']);
    const DAYS_RANGE = 30;
    let chartRegistry = [];
    let chartLibraryPromise = null;

    function ensureChartLibrary() {
        if (window.Chart) {
            return Promise.resolve();
        }

        if (chartLibraryPromise) {
            return chartLibraryPromise;
        }

        const loader = window.__TZ_ADMIN_LOAD_EXTERNAL_SCRIPT;
        const scriptUrl = window.__TZ_ADMIN_CHART_SCRIPT_URL;
        if (typeof loader !== 'function' || !scriptUrl) {
            return Promise.reject(new Error('Chart loader is unavailable.'));
        }

        chartLibraryPromise = loader(scriptUrl).catch(function (error) {
            chartLibraryPromise = null;
            throw error;
        });
        return chartLibraryPromise;
    }

    function toDayKey(value) {
        return new Date(value || Date.now()).toISOString().slice(0, 10);
    }

    function getTimeline(days) {
        return Array.from({ length: days }, (_, index) => {
            const date = new Date();
            date.setDate(date.getDate() - (days - index - 1));
            return { key: toDayKey(date), label: date.toLocaleDateString('ar-JO', { month: 'short', day: 'numeric' }) };
        });
    }

    function getRelativeTimeLabel(value) {
        const diffMs = Date.now() - new Date(value || Date.now()).getTime();
        const minutes = Math.max(1, Math.floor(diffMs / 60000));
        if (minutes < 60) return `قبل ${minutes} دقيقة`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `قبل ${hours} ساعة`;
        return `قبل ${Math.floor(hours / 24)} يوم`;
    }

    function isAccessoryOrder(order) {
        return (order.items || []).some((item) => {
            const categoryId = item.snapshot?.category_id || item.snapshot?.categoryId || '';
            if (categoryId && TZ.isAccessoryProductCategoryId) return TZ.isAccessoryProductCategoryId(categoryId);
            const product = TZ.getProductById(item.productId);
            return product ? TZ.isAccessoryProduct(product) : false;
        });
    }

    function buildInsights(db, queuedCount) {
        const timeline = getTimeline(DAYS_RANGE);
        const revenueByDay = Object.create(null);
        const ordersByDay = Object.create(null);
        const productOrders = (db.orders || []).filter((order) => !isAccessoryOrder(order));
        const accessoryOrders = (db.orders || []).filter((order) => isAccessoryOrder(order));

        (db.orders || []).concat(db.serviceOrders || []).forEach((order) => {
            const key = toDayKey(order.createdAt);
            ordersByDay[key] = (ordersByDay[key] || 0) + 1;
            if (!EXCLUDED_REVENUE_STATUSES.has(order.status)) {
                revenueByDay[key] = (revenueByDay[key] || 0) + Number(order.total || 0);
            }
        });
        (db.repairBookings || []).forEach((booking) => {
            const key = toDayKey(booking.createdAt);
            ordersByDay[key] = (ordersByDay[key] || 0) + 1;
        });

        return {
            totalProducts: db.products.length,
            totalOrders: (db.orders || []).length + (db.serviceOrders || []).length + (db.repairBookings || []).length,
            totalRevenue: Object.values(revenueByDay).reduce((sum, value) => sum + value, 0),
            totalCustomers: db.users.filter((user) => TZ.isCustomerUser(user)).length,
            pendingOrders: (db.orders || []).filter((order) => PENDING_ORDER_STATUSES.has(order.status)).length + (db.serviceOrders || []).filter((order) => PENDING_ORDER_STATUSES.has(order.status)).length + (db.repairBookings || []).filter((booking) => PENDING_ORDER_STATUSES.has(booking.status)).length,
            lowStock: db.products.filter((product) => product.quantity > 0 && product.quantity <= (product.lowStockAlert || 5)).length,
            outOfStock: db.products.filter((product) => product.quantity <= 0).length,
            totalCategories: db.categories.length,
            recentOrders: TZ.clone(db.orders || []).sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt)).slice(0, 5),
            topProducts: TZ.clone(db.products || []).sort((first, second) => (second.sold || 0) - (first.sold || 0)).slice(0, 10),
            timeline,
            revenueSeries: timeline.map((item) => revenueByDay[item.key] || 0),
            orderSeries: timeline.map((item) => ordersByDay[item.key] || 0),
            orderMix: [productOrders.length, accessoryOrders.length, (db.repairBookings || []).length, (db.serviceOrders || []).length],
            queuedCount
        };
    }

    function buildSmartAlerts(db) {
        const alerts = [];
        const staleCutoff = Date.now() - (24 * 60 * 60 * 1000);
        const lowStockCount = db.products.filter((product) => product.quantity > 0 && product.quantity <= (product.lowStockAlert || 5)).length;
        const stalePendingOrders = (db.orders || []).filter((order) => PENDING_ORDER_STATUSES.has(order.status) && new Date(order.createdAt).getTime() <= staleCutoff).length;
        const pendingDeposits = (db.deposits || []).filter((deposit) => deposit.status === 'pending').length;
        const unreadMessages = (db.contactMessages || []).filter((message) => message.status === 'new').length;
        const productsWithoutImage = (db.products || []).filter((product) => !Array.isArray(product.images) || product.images.length === 0).length;
        if (lowStockCount) alerts.push({ tone: 'warning', icon: 'fa-layer-group', text: `${lowStockCount} منتجات أقل من حد المخزون` });
        if (stalePendingOrders) alerts.push({ tone: 'orange', icon: 'fa-hourglass-half', text: `${stalePendingOrders} طلبات بانتظار التنفيذ منذ أكثر من 24 ساعة` });
        if (pendingDeposits) alerts.push({ tone: 'danger', icon: 'fa-money-check-alt', text: `${pendingDeposits} طلبات إيداع بانتظار الموافقة` });
        if (unreadMessages) alerts.push({ tone: 'info', icon: 'fa-envelope', text: `${unreadMessages} رسائل تواصل جديدة غير مقروءة` });
        if (productsWithoutImage) alerts.push({ tone: 'warning', icon: 'fa-image', text: `${productsWithoutImage} منتجات بدون صورة رئيسية` });
        return alerts.length ? alerts : [{ tone: 'success', icon: 'fa-shield-halved', text: 'لا توجد تنبيهات حرجة حالياً.' }];
    }

    function formatActivityFromLog(log) {
        const action = String(log?.action || '').toLowerCase();
        if (action.includes('product_create')) return { icon: 'fa-box', tone: 'success', title: 'تم إضافة منتج جديد' };
        if (action.includes('notification')) return { icon: 'fa-bell', tone: 'info', title: 'تم إرسال إشعار للمستخدمين' };
        if (action.includes('deposit')) return { icon: 'fa-money-check-alt', tone: 'danger', title: 'تم تحديث حالة طلب إيداع' };
        if (action.includes('order') && action.includes('status')) return { icon: 'fa-check-circle', tone: 'success', title: 'تم تحديث حالة طلب' };
        if (action.includes('repair')) return { icon: 'fa-screwdriver-wrench', tone: 'warning', title: 'تم تحديث طلب صيانة' };
        return { icon: 'fa-circle', tone: 'info', title: log?.action || 'نشاط من الإدارة' };
    }

    function buildActivityTimeline(db) {
        const logEvents = (db.logs || []).slice(0, 6).map((log) => {
            const activity = formatActivityFromLog(log);
            return {
                icon: activity.icon,
                tone: activity.tone,
                title: activity.title,
                subtitle: log.details || 'نشاط من الإدارة',
                timestamp: log.timestamp || log.createdAt
            };
        });
        const depositEvents = (db.deposits || []).filter((deposit) => deposit.status === 'pending').slice(0, 3).map((deposit) => ({ icon: 'fa-money-check-alt', tone: 'danger', title: 'طلب إيداع جديد بانتظار الموافقة', subtitle: `${deposit.user_name || deposit.user_id || 'مستخدم'} • ${TZ.formatPrice(deposit.amount || 0)}`, timestamp: deposit.createdAt || deposit.created_at }));
        const messageEvents = (db.contactMessages || []).filter((message) => message.status === 'new').slice(0, 3).map((message) => ({ icon: 'fa-envelope', tone: 'info', title: 'رسالة تواصل جديدة', subtitle: message.name || message.email || 'رسالة جديدة', timestamp: message.createdAt }));
        const productEvents = (db.products || []).slice().sort((first, second) => new Date(second.createdAt || 0) - new Date(first.createdAt || 0)).slice(0, 2).map((product) => ({ icon: 'fa-box', tone: 'success', title: 'تمت إضافة منتج جديد', subtitle: product.name, timestamp: product.createdAt }));
        return logEvents.concat(depositEvents, messageEvents, productEvents).filter((item) => item.timestamp).sort((first, second) => new Date(second.timestamp) - new Date(first.timestamp)).slice(0, 8);
    }

    function getHealthCards() {
        const health = TZ.health || {};
        const statusTone = (value) => value === 'connected' ? 'active' : value === 'error' ? 'hidden' : 'pending';
        return [
            { label: 'Supabase', value: health.supabase === 'connected' ? 'متصل' : 'يوجد خلل', tone: statusTone(health.supabase) },
            { label: 'Realtime', value: health.realtime === 'connected' ? 'نشط' : health.realtime === 'connecting' ? 'جارٍ الربط' : 'متوقف', tone: statusTone(health.realtime) },
            { label: 'آخر تحديث', value: health.lastRefreshAt ? getRelativeTimeLabel(health.lastRefreshAt) : '—', tone: 'info' },
            { label: 'الجلسات النشطة', value: `${health.activeSessions || 0}`, tone: 'success' }
        ];
    }

    function destroyCharts() {
        chartRegistry.forEach((chart) => chart.destroy());
        chartRegistry = [];
    }

    function createChart(canvasId, type, data) {
        const canvas = document.getElementById(canvasId);
        if (!canvas || !window.Chart) return;
        chartRegistry.push(new window.Chart(canvas, { type, data, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#dfe6f5' } } }, scales: type === 'doughnut' ? {} : { x: { ticks: { color: '#95a1c4' }, grid: { color: 'rgba(255,255,255,0.05)' } }, y: { beginAtZero: true, ticks: { color: '#95a1c4' }, grid: { color: 'rgba(255,255,255,0.05)' } } } } }));
    }

    function renderCharts(insights) {
        destroyCharts();
        createChart('dashboardRevenueChart', 'line', { labels: insights.timeline.map((item) => item.label), datasets: [{ label: 'الإيرادات', data: insights.revenueSeries, borderColor: '#6c5ce7', backgroundColor: 'rgba(108, 92, 231, 0.18)', fill: true, tension: 0.35 }] });
        createChart('dashboardMixChart', 'doughnut', { labels: ['منتجات', 'إكسسوارات', 'صيانة', 'رقمي'], datasets: [{ data: insights.orderMix, backgroundColor: ['#6c5ce7', '#00cec9', '#fdcb6e', '#e17055'], borderWidth: 0 }] });
        createChart('dashboardTopProductsChart', 'bar', { labels: insights.topProducts.map((product) => product.name), datasets: [{ label: 'المبيعات', data: insights.topProducts.map((product) => product.sold || 0), backgroundColor: 'rgba(0, 206, 201, 0.78)', borderRadius: 12, maxBarThickness: 26 }] });
        createChart('dashboardOrdersChart', 'line', { labels: insights.timeline.map((item) => item.label), datasets: [{ label: 'الطلبات الجديدة', data: insights.orderSeries, borderColor: '#00b894', backgroundColor: 'rgba(0, 184, 148, 0.16)', fill: true, tension: 0.28 }] });
    }

    function showDashboardModal(title, bodyMarkup, footerMarkup) {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay admin-dashboard-modal';
        overlay.innerHTML = `<div class="modal-card admin-dashboard-modal-card"><div class="admin-dashboard-modal-head"><h3>${title}</h3><button type="button" class="btn btn-ghost btn-sm" data-close-dashboard-modal><i class="fas fa-times"></i></button></div><div class="admin-dashboard-modal-body">${bodyMarkup}</div>${footerMarkup ? `<div class="admin-dashboard-modal-footer">${footerMarkup}</div>` : ''}</div>`;
        document.body.appendChild(overlay);
        overlay.addEventListener('click', (event) => { if (event.target === overlay || event.target.closest('[data-close-dashboard-modal]')) overlay.remove(); });
        return overlay;
    }

    function openQuickProductModal() {
        const categories = TZ.db.categories.filter((category) => category.parentId && !TZ.isAccessoryCatalogCategoryId(category.id));
        if (categories.length === 0) return A.showToast('أضف فئة فرعية واحدة على الأقل قبل إضافة المنتج.');
        const options = categories.map((category) => `<option value="${category.id}">${TZ.escapeHtml(TZ.getCategoryName(category.id))}</option>`).join('');
        const overlay = showDashboardModal('إضافة منتج سريع', `<div class="admin-form-stack"><div class="admin-form-group"><label>اسم المنتج</label><input type="text" id="quickProductName"></div><div class="form-grid"><div class="admin-form-group"><label>الفئة</label><select id="quickProductCategory">${options}</select></div><div class="admin-form-group"><label>السعر</label><input type="number" id="quickProductPrice" min="0.01" step="0.01"></div></div><div class="admin-form-group"><label>الكمية</label><input type="number" id="quickProductQty" min="0" step="1" value="1"></div></div>`, `<button type="button" class="btn btn-primary" id="quickProductSubmitBtn"><i class="fas fa-plus"></i> حفظ المنتج</button>`);
        overlay.querySelector('#quickProductSubmitBtn').addEventListener('click', () => {
            const product = { id: TZ.generateId('prd-'), name: overlay.querySelector('#quickProductName').value.trim(), categoryId: overlay.querySelector('#quickProductCategory').value, price: Number(overlay.querySelector('#quickProductPrice').value || 0), quantity: Number(overlay.querySelector('#quickProductQty').value || 0), brand: '', productType: 'physical', discountPrice: 0, rating: 0, sold: 0, status: 'active', description: '', specs: [], images: [], variants: [], lowStockAlert: 5, createdAt: TZ.nowIso(), updatedAt: TZ.nowIso() };
            if (!product.name || product.price <= 0 || product.quantity < 0) return A.showToast('أكمل بيانات المنتج بشكل صحيح.');
            TZ.db.products.push(product);
            TZ.commitDb('product_create', TZ.getSession()?.userId, product.name, { type: 'product', data: product });
            overlay.remove();
            A.showToast('تمت إضافة المنتج.');
            renderDashboard();
        });
    }

    function openQuickNotificationModal() {
        const helpers = window.AdminNotificationHelpers;
        if (!helpers) return A.showToast('قسم الإشعارات غير جاهز حالياً.');
        const recipients = helpers.getCustomerRecipients(TZ.db.users);
        const options = `<option value="">الجميع</option>${helpers.buildUserOptions(recipients)}`;
        const overlay = showDashboardModal('إرسال إشعار سريع', `<div class="admin-form-stack"><div class="form-grid"><div class="admin-form-group"><label>نوع الرسالة</label><select id="quickNotificationType"><option value="info">رسالة عادية</option><option value="success">رسالة نجاح</option><option value="warning">تنبيه</option><option value="error">تنبيه مهم</option></select></div><div class="admin-form-group"><label>المستهدف</label><select id="quickNotificationRecipient">${options}</select></div></div><div class="admin-form-group"><label>العنوان</label><input type="text" id="quickNotificationTitle"></div><div class="admin-form-group"><label>المحتوى</label><textarea id="quickNotificationBody"></textarea></div></div>`, `<button type="button" class="btn btn-primary" id="quickNotificationSubmitBtn"><i class="fas fa-paper-plane"></i> إرسال</button>`);
        overlay.querySelector('#quickNotificationSubmitBtn').addEventListener('click', async () => {
            try {
                const recipientId = overlay.querySelector('#quickNotificationRecipient').value;
                const audience = recipientId ? helpers.AUDIENCE_SINGLE : helpers.AUDIENCE_ALL;
                const rows = helpers.buildNotificationRows({ audience, title: overlay.querySelector('#quickNotificationTitle').value, body: overlay.querySelector('#quickNotificationBody').value, type: overlay.querySelector('#quickNotificationType').value, recipients: helpers.collectSelectedRecipients(recipients, audience, recipientId) });
                for (const batch of helpers.buildInsertBatches(rows)) {
                    const result = await TZ.supabase.from('notifications').insert(batch);
                    if (result.error) throw new Error(result.error.message || 'تعذر إرسال الإشعار.');
                }
                TZ.commitDb('admin_notification_send', TZ.getSession()?.userId, 'إرسال إشعار سريع من الداشبورد');
                overlay.remove();
                A.showToast('تم إرسال الإشعار بنجاح.');
            } catch (error) {
                A.showToast(error.message || 'تعذر إرسال الإشعار حالياً.');
            }
        });
    }

    function openSummaryModal(title, items, emptyLabel, targetSection) {
        const bodyMarkup = items.length ? `<div class="admin-dashboard-list">${items.join('')}</div>` : `<div class="admin-dashboard-empty"><i class="fas fa-inbox"></i><p>${emptyLabel}</p></div>`;
        const overlay = showDashboardModal(title, bodyMarkup, `<button type="button" class="btn btn-outline" id="dashboardSummaryOpenBtn"><i class="fas fa-arrow-left"></i> فتح القسم</button>`);
        overlay.querySelector('#dashboardSummaryOpenBtn').addEventListener('click', () => {
            overlay.remove();
            A.renderSection(targetSection, { history: 'push' });
        });
    }

    function bindQuickActions() {
        document.querySelectorAll('[data-dashboard-action]').forEach((button) => {
            button.addEventListener('click', () => {
                if (button.dataset.dashboardAction === 'product') return openQuickProductModal();
                if (button.dataset.dashboardAction === 'notification') return openQuickNotificationModal();
                if (button.dataset.dashboardAction === 'orders') return openSummaryModal('الطلبات الجديدة', (TZ.db.orders || []).filter((order) => PENDING_ORDER_STATUSES.has(order.status)).slice(0, 6).map((order) => `<div class="admin-dashboard-list-item"><strong>${TZ.escapeHtml(order.customerName || order.id)}</strong><span>${TZ.formatPrice(order.total || 0)}</span><small>${A.statusLabel(order.status)} • ${A.formatDateTime(order.createdAt)}</small></div>`), 'لا توجد طلبات جديدة حالياً.', 'orders');
                if (button.dataset.dashboardAction === 'repair') return openSummaryModal('حجوزات الصيانة الحديثة', (TZ.db.repairBookings || []).filter((booking) => PENDING_ORDER_STATUSES.has(booking.status)).slice(0, 6).map((booking) => `<div class="admin-dashboard-list-item"><strong>${TZ.escapeHtml(booking.name || booking.id)}</strong><span>${TZ.escapeHtml(booking.serviceName || 'صيانة')}</span><small>${A.statusLabel(booking.status)} • ${A.formatDateTime(booking.createdAt)}</small></div>`), 'لا توجد حجوزات صيانة جديدة حالياً.', 'orders');
            });
        });
    }

    function renderDashboard() {
        Promise.all([
            Promise.resolve(TZ.getQueuedCommits ? TZ.getQueuedCommits() : []),
            ensureChartLibrary().catch(function (error) {
                console.error('Failed to load Chart.js for the legacy dashboard.', error);
                return null;
            })
        ]).then(([queuedCommits]) => {
            const insights = buildInsights(TZ.db, queuedCommits.length);
            const alerts = buildSmartAlerts(TZ.db);
            const timeline = buildActivityTimeline(TZ.db);
            const healthCards = getHealthCards();

            A.adminContent.innerHTML = `<div class="stats-grid"><div class="stat-card-admin"><div class="stat-icon blue"><i class="fas fa-shopping-bag"></i></div><div class="stat-info"><h3>${insights.totalOrders}</h3><p>إجمالي الطلبات</p></div></div><div class="stat-card-admin"><div class="stat-icon green"><i class="fas fa-money-bill-wave"></i></div><div class="stat-info"><h3>${TZ.formatPrice(insights.totalRevenue)}</h3><p>إجمالي الإيرادات</p></div></div><div class="stat-card-admin"><div class="stat-icon orange"><i class="fas fa-box"></i></div><div class="stat-info"><h3>${insights.totalProducts}</h3><p>المنتجات</p></div></div><div class="stat-card-admin"><div class="stat-icon purple"><i class="fas fa-users"></i></div><div class="stat-info"><h3>${insights.totalCustomers}</h3><p>العملاء</p></div></div></div><div class="quick-stats-row"><div class="quick-stat"><div class="value">${insights.pendingOrders}</div><div class="label">طلبات جديدة</div></div><div class="quick-stat"><div class="value">${insights.lowStock}</div><div class="label">مخزون منخفض</div></div><div class="quick-stat"><div class="value">${insights.outOfStock}</div><div class="label">نفد من المخزون</div></div><div class="quick-stat"><div class="value">${insights.totalCategories}</div><div class="label">الفئات</div></div></div><div class="admin-dashboard-health">${healthCards.map((item) => `<div class="admin-dashboard-health-card"><span class="status-badge ${item.tone}">${item.value}</span><small>${item.label}</small></div>`).join('')}</div><div class="admin-dashboard-status-bar"><span class="status-badge ${navigator.onLine ? 'active' : 'pending'}">${navigator.onLine ? 'متصل بالإنترنت' : 'أوفلاين'}</span><span class="admin-dashboard-queue-chip"><i class="fas fa-cloud-upload-alt"></i> ${insights.queuedCount} عملية بانتظار المزامنة</span></div><div class="admin-dashboard-actions"><button type="button" class="btn btn-primary" data-dashboard-action="product"><i class="fas fa-plus"></i> إضافة منتج</button><button type="button" class="btn btn-outline" data-dashboard-action="orders"><i class="fas fa-box-open"></i> طلب جديد</button><button type="button" class="btn btn-outline" data-dashboard-action="notification"><i class="fas fa-bell"></i> أرسل إشعار</button><button type="button" class="btn btn-outline" data-dashboard-action="repair"><i class="fas fa-screwdriver-wrench"></i> حجز صيانة</button></div><div class="admin-dashboard-alerts">${alerts.map((alert) => `<div class="admin-dashboard-alert admin-dashboard-alert--${alert.tone}"><i class="fas ${alert.icon}"></i><span>${alert.text}</span></div>`).join('')}</div><div class="admin-dashboard-chart-grid"><section class="admin-panel"><div class="panel-header"><h2><i class="fas fa-chart-line"></i> الإيرادات خلال آخر 30 يوم</h2></div><div class="panel-body padded"><div class="admin-chart-wrap"><canvas id="dashboardRevenueChart"></canvas></div></div></section><section class="admin-panel"><div class="panel-header"><h2><i class="fas fa-chart-pie"></i> توزيع الطلبات</h2></div><div class="panel-body padded"><div class="admin-chart-wrap"><canvas id="dashboardMixChart"></canvas></div></div></section><section class="admin-panel"><div class="panel-header"><h2><i class="fas fa-chart-column"></i> الأكثر مبيعاً</h2></div><div class="panel-body padded"><div class="admin-chart-wrap"><canvas id="dashboardTopProductsChart"></canvas></div></div></section><section class="admin-panel"><div class="panel-header"><h2><i class="fas fa-wave-square"></i> الطلبات اليومية</h2></div><div class="panel-body padded"><div class="admin-chart-wrap"><canvas id="dashboardOrdersChart"></canvas></div></div></section></div><div class="admin-dashboard-panels"><section class="admin-panel"><div class="panel-header"><h2><i class="fas fa-stream"></i> آخر الأنشطة</h2></div><div class="panel-body padded"><div class="admin-dashboard-timeline">${timeline.map((item) => `<div class="admin-dashboard-timeline-item"><span class="admin-dashboard-timeline-icon admin-dashboard-alert--${item.tone}"><i class="fas ${item.icon}"></i></span><div><strong>${TZ.escapeHtml(item.title)}</strong><p>${TZ.escapeHtml(item.subtitle)}</p><small>${getRelativeTimeLabel(item.timestamp)}</small></div></div>`).join('')}</div></div></section><section class="admin-panel"><div class="panel-header"><h2><i class="fas fa-clock"></i> آخر الطلبات</h2></div><div class="panel-body"><div class="table-wrap"><table class="data-table"><thead><tr><th>#</th><th>العميل</th><th>المبلغ</th><th>الحالة</th><th>التاريخ</th></tr></thead><tbody>${insights.recentOrders.map((order) => { const user = order.customerName ? { fullName: order.customerName } : TZ.getUserById(order.userId); return `<tr><td>${order.id}</td><td>${user ? TZ.escapeHtml(user.fullName) : '-'}</td><td>${TZ.formatPrice(order.total)}</td><td><span class="status-badge ${order.status}">${A.statusLabel(order.status)}</span></td><td>${A.formatDate(order.createdAt)}</td></tr>`; }).join('')}</tbody></table></div></div></section></div>`;

            bindQuickActions();
            renderCharts(insights);
        });
    }

    A.sections.dashboard = renderDashboard;
})();
