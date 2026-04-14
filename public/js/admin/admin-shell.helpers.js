// ===== TechZone Admin - Shell Helpers =====
(function () {
    'use strict';

    const SECTION_META = {
        dashboard: { label: 'لوحة المعلومات', group: '' },
        orders: { label: 'كل الطلبات', group: 'إدارة الطلبات' },
        'product-orders': { label: 'طلبات المنتجات', group: 'إدارة الطلبات' },
        'accessory-orders': { label: 'طلبات الإكسسوارات', group: 'إدارة الطلبات' },
        products: { label: 'المنتجات', group: 'المتجر' },
        accessories: { label: 'الإكسسوارات', group: 'المتجر' },
        categories: { label: 'الفئات', group: 'المتجر' },
        services: { label: 'الخدمات', group: 'المتجر' },
        customers: { label: 'العملاء', group: 'العملاء والتواصل' },
        messages: { label: 'رسائل التواصل', group: 'العملاء والتواصل' },
        chats: { label: 'الدردشات', group: 'العملاء والتواصل' },
        notifications: { label: 'الإشعارات', group: 'العملاء والتواصل' },
        deposits: { label: 'طلبات الإيداع', group: 'المالية' },
        coupons: { label: 'الكوبونات', group: 'المالية' },
        settings: { label: 'الإعدادات', group: 'النظام' },
        logs: { label: 'سجل العمليات', group: 'النظام' }
    };

    const COMMANDS = [
        { id: 'dashboard', title: 'فتح لوحة المعلومات', description: 'العودة إلى الصفحة الرئيسية', icon: 'fa-chart-pie', keywords: ['الرئيسية', 'dashboard'], action: 'navigate:dashboard' },
        { id: 'orders', title: 'عرض الطلبات', description: 'فتح كل الطلبات الحالية', icon: 'fa-box-open', keywords: ['orders', 'طلبات'], action: 'navigate:orders' },
        { id: 'products', title: 'فتح المنتجات', description: 'إدارة منتجات المتجر', icon: 'fa-box', keywords: ['products', 'منتجات'], action: 'navigate:products' },
        { id: 'customers', title: 'فتح العملاء', description: 'عرض العملاء وبياناتهم', icon: 'fa-users', keywords: ['customers', 'عملاء'], action: 'navigate:customers' },
        { id: 'services', title: 'فتح الخدمات', description: 'إدارة خدمات الصيانة', icon: 'fa-tools', keywords: ['services', 'صيانة'], action: 'navigate:services' },
        { id: 'notifications', title: 'إرسال إشعار للمستخدمين', description: 'الانتقال مباشرة إلى قسم الإشعارات', icon: 'fa-bell', keywords: ['notifications', 'إشعار'], action: 'navigate:notifications' },
        { id: 'settings', title: 'فتح الإعدادات', description: 'عرض إعدادات النظام العامة', icon: 'fa-cog', keywords: ['settings', 'إعدادات'], action: 'navigate:settings' },
        { id: 'deposits', title: 'عرض طلبات الإيداع', description: 'مراجعة الطلبات المعلقة', icon: 'fa-money-check-alt', keywords: ['deposits', 'إيداع'], action: 'navigate:deposits' },
        { id: 'add-product', title: 'إضافة منتج جديد', description: 'فتح نموذج إضافة منتج بسرعة', icon: 'fa-plus', keywords: ['create product', 'إضافة منتج'], action: 'trigger:products:#addProductBtn' },
        { id: 'add-service', title: 'إضافة خدمة صيانة', description: 'فتح نموذج إضافة خدمة صيانة', icon: 'fa-screwdriver-wrench', keywords: ['create service', 'إضافة خدمة'], action: 'trigger:services:#addServiceBtn' },
        { id: 'view-site', title: 'عرض الموقع', description: 'فتح الواجهة العامة في تبويب جديد', icon: 'fa-globe', keywords: ['site', 'الموقع'], action: 'site' },
        { id: 'export-backup', title: 'تصدير نسخة احتياطية', description: 'تنزيل نسخة JSON من بيانات اللوحة الحالية', icon: 'fa-file-export', keywords: ['backup', 'تصدير'], action: 'backup' },
        { id: 'toggle-theme', title: 'تبديل الثيم', description: 'التبديل بين الوضع الداكن والفاتح', icon: 'fa-circle-half-stroke', keywords: ['theme', 'ثيم'], action: 'theme' }
    ];

    function normalizeText(value) {
        return String(value || '').trim().toLowerCase();
    }

    function buildAdminBreadcrumbs(section) {
        const meta = SECTION_META[section] || { label: section || 'لوحة المعلومات', group: '' };
        const trail = [{ label: 'الرئيسية', section: 'dashboard', icon: 'fa-house' }];

        if (meta.group) {
            trail.push({ label: meta.group, section: section });
        }

        trail.push({ label: meta.label, section: section, current: true });
        return trail;
    }

    function buildAdminHeaderAlerts(snapshot) {
        const alerts = [];
        if (snapshot.pendingOrders > 0) alerts.push({ id: 'orders', icon: 'fa-box-open', title: `${snapshot.pendingOrders} طلبات بانتظار المتابعة`, section: 'orders', tone: 'warning' });
        if (snapshot.pendingDeposits > 0) alerts.push({ id: 'deposits', icon: 'fa-money-check-alt', title: `${snapshot.pendingDeposits} طلبات إيداع معلقة`, section: 'deposits', tone: 'danger' });
        if (snapshot.unreadMessages > 0) alerts.push({ id: 'messages', icon: 'fa-envelope', title: `${snapshot.unreadMessages} رسائل تواصل جديدة`, section: 'messages', tone: 'info' });
        if (snapshot.lowStock > 0) alerts.push({ id: 'products', icon: 'fa-layer-group', title: `${snapshot.lowStock} منتجات بمخزون منخفض`, section: 'products', tone: 'warning' });
        if (snapshot.offlineQueueCount > 0) alerts.push({ id: 'queue', icon: 'fa-cloud-upload-alt', title: `${snapshot.offlineQueueCount} عمليات تنتظر المزامنة`, section: 'dashboard', tone: 'info' });
        return alerts.length ? alerts : [{ id: 'healthy', icon: 'fa-shield-halved', title: 'لا توجد تنبيهات جديدة حالياً', section: 'dashboard', tone: 'success' }];
    }

    function buildAdminCommandItems() {
        return COMMANDS.slice();
    }

    function scoreCommand(command, query) {
        const normalizedQuery = normalizeText(query);
        if (!normalizedQuery) return 1;

        const haystack = [command.title, command.description, ...(command.keywords || [])].map(normalizeText);
        let score = 0;

        haystack.forEach(function (value) {
            if (!value) return;
            if (value.startsWith(normalizedQuery)) score += 6;
            else if (value.includes(normalizedQuery)) score += 3;
        });

        return score;
    }

    function searchAdminCommands(commands, query, limit) {
        return (Array.isArray(commands) ? commands : [])
            .map(function (command) {
                return { command: command, score: scoreCommand(command, query) };
            })
            .filter(function (entry) {
                return !query || entry.score > 0;
            })
            .sort(function (left, right) {
                return right.score - left.score || left.command.title.localeCompare(right.command.title, 'ar');
            })
            .slice(0, limit || 8)
            .map(function (entry) {
                return entry.command;
            });
    }

    window.AdminShellHelpers = {
        buildAdminBreadcrumbs: buildAdminBreadcrumbs,
        buildAdminHeaderAlerts: buildAdminHeaderAlerts,
        buildAdminCommandItems: buildAdminCommandItems,
        searchAdminCommands: searchAdminCommands
    };

    if (window.__ENABLE_ADMIN_SHELL_TEST_HOOKS__) {
        window.__adminShellTestHooks = window.AdminShellHelpers;
    }
})();
