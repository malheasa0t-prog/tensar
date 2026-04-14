// ===== TechZone Admin - Core Helpers =====
(function () {
    'use strict';

    const VALID_SECTIONS = new Set([
        'dashboard', 'analytics', 'orders', 'product-orders', 'accessory-orders',
        'products', 'accessories', 'main-categories', 'subcategories', 'categories',
        'services', 'customers', 'deposits', 'refunds', 'coupons', 'notifications',
        'chats', 'messages', 'settings', 'logs', 'serva-catalog'
    ]);

    const SECTION_TITLES = {
        dashboard: 'لوحة المعلومات',
        analytics: 'التحليلات',
        orders: 'إدارة الطلبات',
        'product-orders': 'طلبات المنتجات',
        'accessory-orders': 'طلبات الإكسسوارات',
        accessories: 'إدارة منتجات الإكسسوارات',
        products: 'إدارة المنتجات',
        'main-categories': 'إدارة الفئات الرئيسية',
        subcategories: 'إدارة الفئات الفرعية',
        categories: 'مركز الفئات',
        services: 'إدارة الخدمات',
        customers: 'العملاء',
        deposits: 'طلبات الإيداع',
        refunds: 'طلبات الاسترجاع',
        coupons: 'الكوبونات والخصومات',
        notifications: 'إشعارات المستخدمين',
        messages: 'رسائل التواصل',
        settings: 'الإعدادات',
        logs: 'سجل العمليات',
        chats: 'الدردشات المباشرة',
        'serva-catalog': 'كتالوج Serva-S'
    };

    function requestAdminRuntimeAccess(enabled) {
        window.dispatchEvent(new CustomEvent('tz-admin-runtime-access-request', {
            detail: { enabled: enabled === true }
        }));
    }

    function readSidebarGroupState(storageKey) {
        try {
            return JSON.parse(localStorage.getItem(storageKey) || '{}');
        } catch (error) {
            void error;
            return {};
        }
    }

    function persistSidebarGroupState(storageKey) {
        const nextState = {};
        document.querySelectorAll('.sidebar-group').forEach((group) => {
            nextState[group.dataset.sidebarGroup] = group.classList.contains('is-open');
        });
        localStorage.setItem(storageKey, JSON.stringify(nextState));
    }

    function applySidebarGroupState(activeSection, storageKey) {
        const storedState = readSidebarGroupState(storageKey);
        document.querySelectorAll('.sidebar-group').forEach((group) => {
            const containsActive = Boolean(group.querySelector(`.sidebar-link[data-section="${activeSection}"]`));
            const shouldOpen = containsActive || storedState[group.dataset.sidebarGroup] !== false;
            group.classList.toggle('is-open', shouldOpen);
            group.classList.toggle('is-active', containsActive);
        });
    }

    function normalizeSection(section) {
        if (!section) return 'dashboard';
        const clean = String(section).trim().toLowerCase().replace(/^\/+|\/+$/g, '');
        const tail = clean.includes('/') ? clean.split('/').pop() : clean;
        const aliases = { 'admin-users': 'customers', users: 'customers' };
        const normalized = aliases[tail] || tail;
        return VALID_SECTIONS.has(normalized) ? normalized : 'dashboard';
    }

    function getInitialSection() {
        try {
            const url = new URL(window.location.href);
            return normalizeSection(url.searchParams.get('section'));
        } catch (error) {
            void error;
            return 'dashboard';
        }
    }

    function updateSidebarState(section, storageKey) {
        document.querySelectorAll('.sidebar-link').forEach((link) => {
            link.classList.toggle('active', link.dataset.section === section);
        });
        applySidebarGroupState(section, storageKey);
    }

    function buildSectionUrl(section) {
        const url = new URL(window.location.href);
        if (section === 'dashboard') {
            url.searchParams.delete('section');
        } else {
            url.searchParams.set('section', section);
        }
        return url;
    }

    function syncSectionInUrl(section, options = {}) {
        const replaceHistory = options.replace === true;
        try {
            const url = buildSectionUrl(section);
            const currentUrl = new URL(window.location.href);
            const currentSection = normalizeSection(currentUrl.searchParams.get('section'));
            const historySection = normalizeSection(window.history.state?.section);
            const isDuplicateState = currentSection === section && historySection === section;
            if (!replaceHistory && isDuplicateState) return;

            const method = replaceHistory ? 'replaceState' : 'pushState';
            window.history[method]({ section }, '', url.toString());
        } catch (error) {
            void error;
        }
    }

    function canAccessSection(currentUser, TZ, section) {
        if (!currentUser || typeof TZ.canAccessSection !== 'function') return true;
        return TZ.canAccessSection(currentUser, section);
    }

    function applySectionPermissions(TZ, user) {
        document.querySelectorAll('.sidebar-link[data-section]').forEach((link) => {
            const allowed = !user
                || typeof TZ.canAccessSection !== 'function'
                || TZ.canAccessSection(user, link.dataset.section);
            link.hidden = !allowed;
            link.setAttribute('aria-hidden', allowed ? 'false' : 'true');
        });

        document.querySelectorAll('.sidebar-group').forEach((group) => {
            const visibleLinks = Array.from(group.querySelectorAll('.sidebar-link[data-section]')).filter((link) => !link.hidden);
            group.hidden = visibleLinks.length === 0;
        });
    }

    function updateOrdersBadge(TZ) {
        const productOrders = TZ.db.orders.filter((order) => ['pending', 'awaiting_delivery', 'confirmed', 'processing', 'shipped'].includes(order.status)).length;
        const repairOrders = TZ.db.repairBookings.filter((booking) => ['pending', 'awaiting_delivery', 'awaiting_device'].includes(booking.status)).length;
        const digitalOrders = (TZ.db.serviceOrders || []).filter((order) => ['pending', 'processing', 'in_progress'].includes(order.status)).length;
        const badge = document.getElementById('ordersBadge');
        const total = productOrders + repairOrders + digitalOrders;
        if (!badge) return;
        badge.textContent = total;
        badge.style.display = total > 0 ? 'inline' : 'none';
    }

    function statusLabel(status) {
        const labels = {
            awaiting_delivery: 'بانتظار التنفيذ',
            awaiting_device: 'بانتظار وصول الجهاز',
            confirmed: 'تم التأكيد',
            shipped: 'تم الشحن',
            delivered: 'تم التسليم',
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
        const labels = {
            card_mada: 'بطاقة مدى',
            wallet: 'محفظة',
            bank_transfer: 'تحويل بنكي',
            cod: 'دفع عند الاستلام'
        };
        return labels[method] || method || '-';
    }

    function formatDate(iso) {
        if (!iso) return '-';
        return new Date(iso).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' });
    }

    function formatDateTime(iso) {
        if (!iso) return '-';
        const date = new Date(iso);
        return `${date.toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' })} ${date.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}`;
    }

    window.AdminCoreHelpers = {
        SECTION_TITLES,
        applySectionPermissions,
        canAccessSection,
        formatDate,
        formatDateTime,
        getInitialSection,
        normalizeSection,
        paymentLabel,
        persistSidebarGroupState,
        requestAdminRuntimeAccess,
        statusLabel,
        syncSectionInUrl,
        updateOrdersBadge,
        updateSidebarState
    };
})();
