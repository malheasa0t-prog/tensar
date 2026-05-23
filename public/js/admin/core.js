// ===== TechZone Admin - Core =====
(function () {
    'use strict';

    window.AdminApp = {
        currentSection: 'dashboard',
        currentUser: null,
        currentOrderStatusTab: 'all',
        editingProductId: null,
        editingCategoryId: null,
        editingServiceId: null,
        serviceImage: '',
        editingCouponId: null,
        productImages: [],
        _undoTimer: null,
        sections: {}
    };

    const A = window.AdminApp;
    const helpers = window.AdminCoreHelpers;
    const ui = window.AdminCoreUi;
    const SIDEBAR_GROUP_STORAGE_KEY = 'tz_admin_sidebar_groups';
    const adminLayout = document.getElementById('adminLayout');
    const adminContent = document.getElementById('adminContent');
    const pageTitle = document.getElementById('pageTitle');
    const logoutBtn = document.getElementById('logoutBtn');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebarClose = document.getElementById('sidebarClose');
    const sidebar = document.getElementById('adminSidebar');

    let initialized = false;
    let lastOfflineQueueCount = 0;
    let sectionRenderToken = 0;

    async function checkAuth() {
        try {
            const adminSession = await TZ.getAdminSessionUser({ baseClient: TZ.supabase });
            if (adminSession.user && TZ.canAccessAdmin(adminSession.user)) {
                helpers.requestAdminRuntimeAccess(true);
                await TZ.refreshData();
                TZ.startRealtime?.();
                showAdmin(adminSession.user);
                return;
            }
        } catch (error) {
            console.error('[COR-501] Failed to validate admin session.', error);
        }

        showLogin();
    }

    function showLogin() {
        A.currentUser = null;
        helpers.requestAdminRuntimeAccess(false);
        TZ.clearSession();
        window.location.href = '/';
    }

    function showAdmin(user) {
        helpers.requestAdminRuntimeAccess(true);
        A.currentUser = user;
        TZ.setSession(user.id, user.role, user.fullName);
        if (adminLayout) adminLayout.style.display = 'flex';
        document.getElementById('adminName').textContent = user.fullName;
        document.getElementById('adminRole').textContent = TZ.ROLES[user.role]?.label || user.role;
        helpers.applySectionPermissions(TZ, user);
        helpers.updateOrdersBadge(TZ);
        helpers.updateSidebarState(A.currentSection, SIDEBAR_GROUP_STORAGE_KEY);
        renderAdminSection(A.currentSection, { history: 'replace' });
        ui.showLegacyModeNotice(TZ);
    }

    function setSidebarLoadingState(section, isLoading) {
        document.querySelectorAll('.sidebar-link').forEach((link) => {
            const matchesSection = link.dataset.section === section;
            link.classList.toggle('is-loading', matchesSection && isLoading);
            if (matchesSection) {
                link.setAttribute('aria-busy', isLoading ? 'true' : 'false');
            } else {
                link.removeAttribute('aria-busy');
            }
        });
        adminLayout?.classList.toggle('is-section-loading', isLoading);
    }

    async function ensureSectionModuleLoaded(section) {
        if (typeof window.__TZ_ADMIN_LOAD_SECTION_MODULES === 'function') {
            await window.__TZ_ADMIN_LOAD_SECTION_MODULES(section);
        }
    }

    async function renderAdminSection(section, options = {}) {
        const normalizedSection = helpers.normalizeSection(section);
        const historyMode = options.history || 'push';
        const previousSection = A.currentSection;
        const renderToken = ++sectionRenderToken;

        if (typeof A.teardownCurrentSection === 'function') {
            A.teardownCurrentSection();
            A.teardownCurrentSection = null;
        }

        A.currentSection = normalizedSection;
        helpers.updateSidebarState(normalizedSection, SIDEBAR_GROUP_STORAGE_KEY);
        if (historyMode === 'replace') helpers.syncSectionInUrl(normalizedSection, { replace: true });
        if (historyMode === 'push' && previousSection !== normalizedSection) helpers.syncSectionInUrl(normalizedSection);

        pageTitle.textContent = helpers.SECTION_TITLES[normalizedSection] || normalizedSection;
        A.editingProductId = null;
        A.editingCategoryId = null;
        A.editingServiceId = null;
        A.editingCouponId = null;
        A.productImages = [];

        if (!helpers.canAccessSection(A.currentUser, TZ, normalizedSection)) {
            ui.renderAccessDeniedState(adminContent, helpers.SECTION_TITLES[normalizedSection] || normalizedSection);
            window.dispatchEvent(new CustomEvent('tz-admin-section-rendered', { detail: { section: normalizedSection } }));
            return;
        }

        setSidebarLoadingState(normalizedSection, true);
        ui.renderSectionLoadingState(adminContent, helpers.SECTION_TITLES[normalizedSection] || normalizedSection);

        try {
            await ensureSectionModuleLoaded(normalizedSection);
            if (renderToken !== sectionRenderToken) return;

            if (A.sections[normalizedSection]) {
                adminContent.classList.remove('is-section-ready');
                A.sections[normalizedSection]();
                adminContent.classList.add('is-section-ready');
            } else {
                adminContent.innerHTML = '<div class="empty-state"><i class="fas fa-tools"></i><p>\u0642\u0633\u0645 \u0642\u064A\u062F \u0627\u0644\u062A\u0637\u0648\u064A\u0631</p></div>';
            }
        } catch (error) {
            console.error('[COR-500] Failed to render admin section.', error);
            if (renderToken !== sectionRenderToken) return;
            ui.renderSectionErrorState(adminContent, error);
        } finally {
            if (renderToken === sectionRenderToken) {
                setSidebarLoadingState(normalizedSection, false);
            }
        }

        window.dispatchEvent(new CustomEvent('tz-admin-section-rendered', { detail: { section: normalizedSection } }));
    }

    async function initializeAdminShell() {
        if (initialized) return;
        initialized = true;

        logoutBtn.addEventListener('click', async function () {
            helpers.requestAdminRuntimeAccess(false);
            await TZ.supabaseSignOut();
            window.location.href = '/';
        });

        await checkAuth();
    }

    function scheduleAdminInitialization() {
        if (window.__TZ_ADMIN_BOOTSTRAPPED === true && window.TZ) {
            void initializeAdminShell();
            return;
        }

        window.addEventListener('tz-admin-bootstrap-ready', () => {
            void initializeAdminShell();
        }, { once: true });
    }

    scheduleAdminInitialization();

    window.addEventListener('tz-data-updated', (event) => {
        const table = event.detail ? event.detail.table : 'all';
        const section = A.currentSection;
        if (section === 'dashboard' && A.sections.dashboard) A.sections.dashboard();
        if (section === 'analytics' && A.sections.analytics) A.sections.analytics();
        if (section === 'orders' && ['orders', 'service_orders', 'repair_bookings', 'products', 'all'].includes(table) && A.sections.orders) A.sections.orders();
        if (section === 'product-orders' && ['orders', 'products', 'all'].includes(table) && A.sections['product-orders']) A.sections['product-orders']();
        if (section === 'service-orders' && ['service_orders', 'all'].includes(table) && A.sections['service-orders']) A.sections['service-orders']();
        if (section === 'accessory-orders' && ['orders', 'products', 'all'].includes(table) && A.sections['accessory-orders']) A.sections['accessory-orders']();
        if (section === 'repair-orders' && ['repair_bookings', 'all'].includes(table) && A.sections['repair-orders']) A.sections['repair-orders']();
        if (section === 'products' && ['products', 'all'].includes(table) && A.sections.products) A.sections.products();
        if (section === 'categories' && ['categories', 'all'].includes(table) && A.sections.categories) A.sections.categories();
        if (section === 'main-categories' && ['categories', 'all'].includes(table) && A.sections['main-categories']) A.sections['main-categories']();
        if (section === 'subcategories' && ['categories', 'all'].includes(table) && A.sections.subcategories) A.sections.subcategories();
        if (section === 'services' && ['services', 'categories', 'all'].includes(table) && A.sections.services) A.sections.services();
        if (section === 'messages' && ['contact_messages', 'all'].includes(table) && A.sections.messages) A.sections.messages();
        if (section === 'deposits' && ['deposits', 'all'].includes(table) && A.sections.deposits) A.sections.deposits();
        if (section === 'refunds' && A.sections.refunds) A.sections.refunds();
        if (section === 'coupons' && ['coupons', 'all'].includes(table) && A.sections.coupons) A.sections.coupons();
        if (section === 'notifications' && A.sections.notifications) A.sections.notifications();
        if (section === 'customers' && ['users', 'orders', 'all'].includes(table) && A.sections.customers) A.sections.customers();
        if (section === 'settings' && ['settings', 'all'].includes(table) && A.sections.settings) A.sections.settings();
        if (section === 'logs' && ['audit_logs', 'all'].includes(table) && A.sections.logs) A.sections.logs();
        if (section === 'platform-updates' && ['platform_updates', 'all'].includes(table) && A.sections['platform-updates']) A.sections['platform-updates']();
        helpers.updateOrdersBadge(TZ);
    });

    window.addEventListener('tz-offline-queue-updated', (event) => {
        const queueCount = Number(event.detail?.count || 0);
        const queueIncreased = queueCount > lastOfflineQueueCount;
        lastOfflineQueueCount = queueCount;

        if (queueIncreased && queueCount > 0 && navigator.onLine === false) {
            ui.showToast('\u062A\u0645 \u062D\u0641\u0638 \u0627\u0644\u0639\u0645\u0644\u064A\u0629 \u0645\u062D\u0644\u064A\u064B\u0627 \u0648\u0633\u064A\u062A\u0645 \u0625\u0631\u0633\u0627\u0644\u0647\u0627 \u0639\u0646\u062F \u0639\u0648\u062F\u0629 \u0627\u0644\u0627\u062A\u0635\u0627\u0644.');
        }

        if (A.currentSection === 'dashboard' && A.sections.dashboard) A.sections.dashboard();
    });

    window.addEventListener('tz-offline-sync-complete', (event) => {
        const syncedCount = Number(event.detail?.syncedCount || 0);
        if (syncedCount > 0) {
            ui.showToast(`\u062A\u0645\u062A \u0645\u0632\u0627\u0645\u0646\u0629 ${syncedCount} \u0639\u0645\u0644\u064A\u0629 \u0645\u0624\u062C\u0644\u0629 \u0628\u0646\u062C\u0627\u062D.`);
        }
        if (A.currentSection === 'dashboard' && A.sections.dashboard) A.sections.dashboard();
    });

    window.addEventListener('tz-health-updated', () => {
        if (A.currentSection === 'dashboard' && A.sections.dashboard) A.sections.dashboard();
    });

    ['online', 'offline'].forEach((eventName) => {
        window.addEventListener(eventName, () => {
            if (A.currentSection === 'dashboard' && A.sections.dashboard) A.sections.dashboard();
        });
    });

    document.querySelectorAll('.sidebar-group-toggle').forEach((toggle) => {
        toggle.addEventListener('click', function () {
            const group = document.querySelector(`.sidebar-group[data-sidebar-group="${this.dataset.sidebarGroupToggle}"]`);
            if (!group) return;
            const containsActive = Boolean(group.querySelector(`.sidebar-link[data-section="${A.currentSection}"]`));
            if (containsActive) return;
            group.classList.toggle('is-open');
            helpers.persistSidebarGroupState(SIDEBAR_GROUP_STORAGE_KEY);
        });
    });

    document.querySelectorAll('.sidebar-link').forEach((link) => {
        link.addEventListener('click', function (event) {
            event.preventDefault();
            const section = this.dataset.section;
            if (!section) return;
            helpers.persistSidebarGroupState(SIDEBAR_GROUP_STORAGE_KEY);
            renderAdminSection(section, { history: 'push' });
            sidebar.classList.remove('open');
        });
    });

    window.addEventListener('popstate', (event) => {
        const nextSection = helpers.normalizeSection(event.state?.section || helpers.getInitialSection());
        renderAdminSection(nextSection, { history: 'skip' });
        sidebar.classList.remove('open');
    });

    sidebarToggle.addEventListener('click', () => sidebar.classList.add('open'));
    sidebarClose.addEventListener('click', () => sidebar.classList.remove('open'));

    A.showConfirmModal = ui.showConfirmModal;
    A.showErrorToast = ui.showErrorToast;
    A.showModal = ui.showModal;
    A.showUndoToast = ui.showUndoToast;
    A.showToast = ui.showToast;
    A.renderSection = renderAdminSection;
    A.updateOrdersBadge = () => helpers.updateOrdersBadge(TZ);
    A.canAccessSection = (section) => helpers.canAccessSection(A.currentUser, TZ, section);
    A.statusLabel = helpers.statusLabel;
    A.paymentLabel = helpers.paymentLabel;
    A.deliveryLabel = helpers.deliveryLabel;
    A.formatDate = helpers.formatDate;
    A.formatDateTime = helpers.formatDateTime;
    A.formatOrderNumber = helpers.formatOrderNumber;
    A.getAdminImageUploadLimitText = ui.getAdminImageUploadLimitText;
    A.isAdminImageUploadTooLarge = ui.isAdminImageUploadTooLarge;
    A.showAdminImageUploadLimitToast = ui.showAdminImageUploadLimitToast;
    A.checkAuth = checkAuth;
    A.showLogin = showLogin;
    A.showAdmin = showAdmin;
    A.adminContent = adminContent;
})();

