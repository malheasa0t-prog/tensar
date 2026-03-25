// ===== TechZone Admin - Core =====
// Auth (Supabase), navigation, shared state, confirm modal, undo toast
(function () {
    'use strict';

    // Shared admin state
    window.AdminApp = {
        currentSection: 'dashboard',
        currentOrderStatusTab: 'all',
        editingProductId: null,
        editingCategoryId: null,
        editingServiceId: null,
        serviceImage: '',
        editingCouponId: null,
        productImages: [],
        _undoTimer: null,
        sections: {},  // Each sub-module registers its render function here
        accessoryCatalog: (window.TZ && window.TZ.accessoryCatalog) || null
    };

    const A = window.AdminApp;
    let _undoTimer = null;
    let initialized = false;

    // ===== Custom Confirm Modal (replaces browser confirm) =====
    function showConfirmModal(title, message, onConfirm) {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-card">
                <h3><i class="fas fa-exclamation-triangle" style="color:#fdcb6e"></i> ${title}</h3>
                <p>${message}</p>
                <div style="display:flex;gap:10px;justify-content:center;margin-top:20px;">
                    <button class="btn btn-primary confirm-yes-btn"><i class="fas fa-check"></i> ØªØ£ÙƒÙŠØ¯</button>
                    <button class="btn btn-outline confirm-no-btn"><i class="fas fa-times"></i> Ø¥Ù„ØºØ§Ø¡</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        overlay.querySelector('.confirm-no-btn').addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
        overlay.querySelector('.confirm-yes-btn').addEventListener('click', () => {
            overlay.remove();
            onConfirm();
        });
    }

    // ===== Undo Toast =====
    function showUndoToast(msg, onUndo, onExpire) {
        if (onExpire) { onExpire(); }
        showToast(msg);
    }

    // ===== DOM =====
    const loginOverlay = document.getElementById('adminLoginOverlay');
    const adminLayout = document.getElementById('adminLayout');
    const adminContent = document.getElementById('adminContent');
    const pageTitle = document.getElementById('pageTitle');
    const loginForm = document.getElementById('adminLoginForm');
    const loginError = document.getElementById('loginError');
    const logoutBtn = document.getElementById('logoutBtn');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebarClose = document.getElementById('sidebarClose');
    const sidebar = document.getElementById('adminSidebar');

    // ===== Auth (Supabase) =====
    async function checkAuth() {
        try {
            const authUser = await TZ.getSupabaseUser();
            if (authUser) {
                await TZ.refreshData();
                const appUser = TZ.findUserByAuthUser(authUser);
                if (appUser && TZ.canAccessAdmin(appUser)) {
                    showAdmin(appUser);
                    return;
                }
            }
        } catch (e) {
            void e;
        }
        showLogin();
    }

    function showLogin() {
        TZ.clearSession();
        loginOverlay.style.display = 'flex';
        adminLayout.style.display = 'none';
    }

    function showAdmin(user) {
        TZ.setSession(user.id, user.role, user.fullName);
        loginOverlay.style.display = 'none';
        adminLayout.style.display = 'flex';
        document.getElementById('adminName').textContent = user.fullName;
        document.getElementById('adminRole').textContent = TZ.ROLES[user.role]?.label || user.role;
        updateOrdersBadge();
        renderSection(A.currentSection);
        showLegacyModeNotice();
    }

    function showLegacyModeNotice() {
        if (TZ.legacyWriteEnabled) return;

        const old = document.getElementById('legacyReadOnlyNotice');
        if (old) old.remove();

        const notice = document.createElement('div');
        notice.id = 'legacyReadOnlyNotice';
        notice.style.cssText = 'margin:12px 16px 0;padding:12px 14px;border:1px solid rgba(241,196,15,.45);background:rgba(241,196,15,.12);border-radius:10px;color:#f5c542;font-size:.92rem;line-height:1.7';
        notice.innerHTML = 'ÙˆØ¶Ø¹ Ø¢Ù…Ù†: Ù„ÙˆØ­Ø© Ø§Ù„Ø¥Ø¯Ø§Ø±Ø© Ø§Ù„Ù‚Ø¯ÙŠÙ…Ø© ØªØ¹Ù…Ù„ Ø­Ø§Ù„ÙŠØ§Ù‹ Ø¨ØµÙ„Ø§Ø­ÙŠØ© Ù‚Ø±Ø§Ø¡Ø© ÙÙ‚Ø· Ù„Ù…Ù†Ø¹ Ø§Ù„ÙƒØªØ§Ø¨Ø© Ø§Ù„Ù…Ø¨Ø§Ø´Ø±Ø© Ù…Ù† Ø§Ù„Ù…ØªØµÙØ­. Ù„Ø¥Ø¬Ø±Ø§Ø¡ ØªØ¹Ø¯ÙŠÙ„Ø§Øª ÙØ¹Ù„ÙŠØ© Ø§Ø³ØªØ®Ø¯Ù… Ù„ÙˆØ­Ø© Next.js Ø§Ù„Ø­Ø¯ÙŠØ«Ø©.';

        const content = document.getElementById('adminContent');
        if (content && content.parentNode) {
            content.parentNode.insertBefore(notice, content);
        }
    }

    // We must wait for Supabase to load our data into TZ.db before doing anything
    window.addEventListener('tz-ready', async () => {
        if (initialized) return;
        initialized = true;

        // ===== Auth Events =====
        loginForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            const email = document.getElementById('adminEmail').value.trim();
            const pass = document.getElementById('adminPassword').value;
            const btn = loginForm.querySelector('button[type="submit"]');
            const origBtn = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ø¬Ø§Ø±ÙŠ Ø§Ù„Ø¯Ø®ÙˆÙ„...';
            btn.disabled = true;

            const result = await TZ.supabaseSignIn(email, pass);

            if (result.error) {
                loginError.textContent = result.error === 'Invalid login credentials'
                    ? 'Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ø¯Ø®ÙˆÙ„ ØºÙŠØ± ØµØ­ÙŠØ­Ø©'
                    : result.error;
                loginError.style.display = 'block';
                btn.innerHTML = origBtn;
                btn.disabled = false;
                return;
            }

            // Check app_users for role/permissions
            await TZ.refreshData();
            const authUser = await TZ.getSupabaseUser();
            const appUser = TZ.findUserByAuthUser(authUser);
            if (!appUser || !TZ.canAccessAdmin(appUser)) {
                loginError.textContent = 'Ù„ÙŠØ³ Ù„Ø¯ÙŠÙƒ ØµÙ„Ø§Ø­ÙŠØ© Ø§Ù„ÙˆØµÙˆÙ„ Ù„Ù„ÙˆØ­Ø© Ø§Ù„Ø¥Ø¯Ø§Ø±Ø©';
                loginError.style.display = 'block';
                await TZ.supabaseSignOut();
                btn.innerHTML = origBtn;
                btn.disabled = false;
                return;
            }

            TZ.commitDb('admin_login', appUser.id, 'ØªØ³Ø¬ÙŠÙ„ Ø¯Ø®ÙˆÙ„: ' + appUser.fullName);
            loginError.style.display = 'none';
            btn.innerHTML = origBtn;
            btn.disabled = false;
            showAdmin(appUser);
        });

        logoutBtn.addEventListener('click', async function () {
            await TZ.supabaseSignOut();
            showLogin();
        });

        // Initialize admin panel
        await checkAuth();
    });

    // Realtime: auto-refresh current section when data changes
    window.addEventListener('tz-data-updated', (e) => {
        const table = e.detail ? e.detail.table : 'all';
        const sec = A.currentSection;
        if (sec === 'dashboard' && A.sections.dashboard) A.sections.dashboard();
        if (sec === 'analytics' && A.sections.analytics) A.sections.analytics();
        if (sec === 'orders' && (table === 'orders' || table === 'service_orders' || table === 'repair_bookings' || table === 'all') && A.sections.orders) A.sections.orders();
        if (sec === 'accessories' && (table === 'products' || table === 'categories' || table === 'all') && A.sections.accessories) A.sections.accessories();
        if (sec === 'products' && (table === 'products' || table === 'all') && A.sections.products) A.sections.products();
        if (sec === 'categories' && (table === 'categories' || table === 'all') && A.sections.categories) A.sections.categories();
        if (sec === 'main-categories' && (table === 'categories' || table === 'all') && A.sections['main-categories']) A.sections['main-categories']();
        if (sec === 'subcategories' && (table === 'categories' || table === 'all') && A.sections.subcategories) A.sections.subcategories();
        if (sec === 'services' && (table === 'services' || table === 'categories' || table === 'all') && A.sections.services) A.sections.services();
        if (sec === 'messages' && (table === 'contact_messages' || table === 'all') && A.sections.messages) A.sections.messages();
        if (sec === 'deposits' && (table === 'deposits' || table === 'all') && A.sections.deposits) A.sections.deposits();
        if (sec === 'refunds' && A.sections.refunds) A.sections.refunds();
        if (sec === 'coupons' && (table === 'coupons' || table === 'all') && A.sections.coupons) A.sections.coupons();
        if (sec === 'notifications' && A.sections.notifications) A.sections.notifications();
        updateOrdersBadge();
    });

    // ===== Sidebar =====
    document.querySelectorAll('.sidebar-link').forEach(function (link) {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            const section = this.dataset.section;
            if (!section) return;
            A.currentSection = section;
            document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
            this.classList.add('active');
            renderSection(section);
            sidebar.classList.remove('open');
        });
    });

    sidebarToggle.addEventListener('click', () => sidebar.classList.add('open'));
    sidebarClose.addEventListener('click', () => sidebar.classList.remove('open'));

    function updateOrdersBadge() {
        const productOrders = TZ.db.orders.filter(o => o.status === 'awaiting_delivery' || o.status === 'awaiting_device').length;
        const repairOrders = TZ.db.repairBookings.filter((booking) => ['pending', 'awaiting_delivery', 'awaiting_device'].includes(booking.status)).length;
        const digitalOrders = (TZ.db.serviceOrders || []).filter((order) => ['pending', 'processing', 'in_progress'].includes(order.status)).length;
        const newOrders = productOrders + repairOrders + digitalOrders;
        const badge = document.getElementById('ordersBadge');
        badge.textContent = newOrders;
        badge.style.display = newOrders > 0 ? 'inline' : 'none';
    }

    // ===== Section Router =====
    const SECTION_TITLES = {
        dashboard: 'لوحة المعلومات',
        analytics: 'التحليلات',
        orders: 'إدارة الطلبات',
        accessories: 'إدارة منتجات الإكسسوارات',
        products: 'إدارة المنتجات',
        'main-categories': 'إدارة الفئات الرئيسية',
        subcategories: 'إدارة الفئات الفرعية',
        categories: 'مركز الفئات',
        services: 'إدارة الخدمات',
        customers: 'العملاء',
        deposits: 'إدارة الإيداعات',
        refunds: 'طلبات الاسترجاع',
        coupons: 'الكوبونات والخصومات',
        notifications: 'إشعارات المستخدمين',
        messages: 'رسائل التواصل',
        settings: 'الإعدادات',
        logs: 'سجل العمليات'
    };

    function renderSection(section) {
        pageTitle.textContent = SECTION_TITLES[section] || section;
        A.editingProductId = null;
        A.editingCategoryId = null;
        A.editingServiceId = null;
        A.editingCouponId = null;
        A.productImages = [];
        if (A.sections[section]) {
            A.sections[section]();
        } else {
            adminContent.innerHTML = '<div class="empty-state"><i class="fas fa-tools"></i><p>Ù‚Ø³Ù… Ù‚ÙŠØ¯ Ø§Ù„ØªØ·ÙˆÙŠØ±</p></div>';
        }
    }

    // ===== HELPERS =====
    function statusLabel(status) {
        const labels = {
            awaiting_delivery: 'بانتظار التوصيل',
            awaiting_device: 'بانتظار وصول الجهاز',
            under_maintenance: 'تحت الصيانة',
            awaiting_pickup: 'بانتظار الاستلام',
            pending: 'قيد الانتظار',
            processing: 'قيد المعالجة',
            in_progress: 'قيد التنفيذ',
            completed: 'مكتمل',
            partial: 'جزئي',
            failed: 'فشل',
            cancelled: 'ملغي',
            refunded: 'مسترجع',
            active: 'نشط',
            hidden: 'مخفي'
        };
        return labels[status] || status;
    }

    function paymentLabel(method) {
        const labels = { card_mada: 'Ø¨Ø·Ø§Ù‚Ø© Ù…Ø¯Ù‰', wallet: 'Ù…Ø­ÙØ¸Ø©', bank_transfer: 'ØªØ­ÙˆÙŠÙ„ Ø¨Ù†ÙƒÙŠ', cod: 'Ø¯ÙØ¹ Ø¹Ù†Ø¯ Ø§Ù„Ø§Ø³ØªÙ„Ø§Ù…' };
        return labels[method] || method || '-';
    }

    function formatDate(iso) {
        if (!iso) return '-';
        const d = new Date(iso);
        return d.toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' });
    }

    function formatDateTime(iso) {
        if (!iso) return '-';
        const d = new Date(iso);
        return d.toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
    }

    function showToast(msg) {
        const toast = document.createElement('div');
        toast.style.cssText = 'position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:var(--success);color:#fff;padding:12px 24px;border-radius:10px;font-family:inherit;font-size:0.9rem;z-index:9999;box-shadow:0 5px 20px rgba(0,0,0,0.3);animation:fadeInUp 0.3s ease;';
        toast.textContent = msg;
        document.body.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; setTimeout(() => toast.remove(), 300); }, 2500);
    }

    // Export core functions to shared namespace
    A.showConfirmModal = showConfirmModal;
    A.showUndoToast = showUndoToast;
    A.renderSection = renderSection;
    A.updateOrdersBadge = updateOrdersBadge;
    A.statusLabel = statusLabel;
    A.paymentLabel = paymentLabel;
    A.formatDate = formatDate;
    A.formatDateTime = formatDateTime;
    A.showToast = showToast;
    A.checkAuth = checkAuth;
    A.showLogin = showLogin;
    A.showAdmin = showAdmin;
    A.adminContent = adminContent;

})();

