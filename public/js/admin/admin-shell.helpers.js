// ===== TechZone Admin - Shell Helpers =====
(function () {
    'use strict';

    const SECTION_META = {
        dashboard: { label: 'لوحة المعلومات', group: '' },
        orders: { label: 'كل الطلبات', group: 'إدارة الطلبات' },
        'product-orders': { label: 'طلبات المنتجات', group: 'إدارة الطلبات' },
        'service-orders': { label: 'طلبات الخدمات', group: 'إدارة الطلبات' },
        'accessory-orders': { label: 'طلبات الإكسسوارات', group: 'إدارة الطلبات' },
        'repair-orders': { label: 'حجوزات الصيانة', group: 'إدارة الطلبات' },
        'serva-catalog': { label: 'استيراد خدمات Serva-S', group: 'النظام' },
        'provider-alerts': { label: 'تنبيهات المزود', group: 'النظام' }
    };

    const COMMANDS = [
        {
            id: 'dashboard',
            title: 'فتح لوحة المعلومات',
            description: 'العودة إلى الصفحة الرئيسية',
            icon: 'fa-chart-pie',
            keywords: ['الرئيسية', 'dashboard'],
            action: 'navigate:dashboard'
        },
        {
            id: 'orders',
            title: 'عرض الطلبات',
            description: 'فتح كل الطلبات الحالية',
            icon: 'fa-box-open',
            keywords: ['orders', 'طلبات'],
            action: 'navigate:orders'
        },
        {
            id: 'product-orders',
            title: 'طلبات المنتجات',
            description: 'الانتقال إلى طلبات المنتجات',
            icon: 'fa-box',
            keywords: ['product orders', 'طلبات المنتجات'],
            action: 'navigate:product-orders'
        },
        {
            id: 'accessory-orders',
            title: 'طلبات الإكسسوارات',
            description: 'الانتقال إلى طلبات الإكسسوارات',
            icon: 'fa-headphones',
            keywords: ['accessory orders', 'طلبات الإكسسوارات'],
            action: 'navigate:accessory-orders'
        },
        {
            id: 'service-orders',
            title: 'طلبات الخدمات',
            description: 'الانتقال إلى طلبات الخدمات الرقمية',
            icon: 'fa-bolt',
            keywords: ['service orders', 'طلبات الخدمات', 'serva'],
            action: 'navigate:service-orders'
        },
        {
            id: 'repair-orders',
            title: 'حجوزات الصيانة',
            description: 'متابعة طلبات وحجوزات الصيانة',
            icon: 'fa-screwdriver-wrench',
            keywords: ['repair orders', 'صيانة', 'حجوزات'],
            action: 'navigate:repair-orders'
        },
        {
            id: 'serva-catalog',
            title: 'استيراد خدمات Serva-S',
            description: 'إضافة خدمات من كتالوج serva-s.com عبر API',
            icon: 'fa-cloud-download-alt',
            keywords: ['serva', 'serva-s', 'استيراد الخدمات', 'api'],
            action: 'navigate:serva-catalog'
        },
        {
            id: 'view-site',
            title: 'عرض الموقع',
            description: 'فتح الواجهة العامة في تبويب جديد',
            icon: 'fa-globe',
            keywords: ['site', 'الموقع'],
            action: 'site'
        },
        {
            id: 'export-backup',
            title: 'تصدير نسخة احتياطية',
            description: 'تنزيل نسخة JSON من بيانات اللوحة الحالية',
            icon: 'fa-file-export',
            keywords: ['backup', 'تصدير'],
            action: 'backup'
        },
        {
            id: 'toggle-theme',
            title: 'تبديل الثيم',
            description: 'التبديل بين الوضع الداكن والفاتح',
            icon: 'fa-circle-half-stroke',
            keywords: ['theme', 'ثيم'],
            action: 'theme'
        }
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

        if (snapshot.pendingOrders > 0) {
            alerts.push({
                id: 'orders',
                icon: 'fa-box-open',
                title: `${snapshot.pendingOrders} طلبات بانتظار المتابعة`,
                section: 'orders',
                tone: 'warning'
            });
        }

        if (snapshot.offlineQueueCount > 0) {
            alerts.push({
                id: 'queue',
                icon: 'fa-cloud-upload-alt',
                title: `${snapshot.offlineQueueCount} عمليات تنتظر المزامنة`,
                section: 'dashboard',
                tone: 'info'
            });
        }

        return alerts.length
            ? alerts
            : [{ id: 'healthy', icon: 'fa-shield-halved', title: 'لا توجد تنبيهات جديدة حالياً', section: 'dashboard', tone: 'success' }];
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
