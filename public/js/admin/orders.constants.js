// ===== TechZone Admin - Orders Constants =====
//
// Extracted from orders.js to keep the controller focused on behaviour and
// to let other admin modules (bulk actions, dashboard cards, exports) read
// the same status labels without duplicating them.
//
// All values are frozen so consumers cannot mutate shared state at runtime.
// The bundle is plain (non-module) JS because the admin shell is loaded as
// classic scripts. Constants are published on `window.AdminOrdersConstants`.

(function () {
    'use strict';

    var TYPE_ALL = 'all';
    var TYPE_PHYSICAL = 'physical';
    var TYPE_ACCESSORY = 'accessory';
    var TYPE_SERVICE = 'service';
    var TYPE_REPAIR = 'repair';

    var ORDER_TYPES = Object.freeze({
        ALL: TYPE_ALL,
        PHYSICAL: TYPE_PHYSICAL,
        ACCESSORY: TYPE_ACCESSORY,
        SERVICE: TYPE_SERVICE,
        REPAIR: TYPE_REPAIR
    });

    var TAB_CONFIG = Object.freeze([
        Object.freeze({ key: TYPE_ALL, label: 'كل الطلبات', icon: 'fa-layer-group' }),
        Object.freeze({ key: TYPE_PHYSICAL, label: 'طلبات المنتجات', icon: 'fa-box' }),
        Object.freeze({ key: TYPE_SERVICE, label: 'طلبات الخدمات', icon: 'fa-bolt' }),
        Object.freeze({ key: TYPE_ACCESSORY, label: 'طلبات الإكسسوارات', icon: 'fa-headphones' }),
        Object.freeze({ key: TYPE_REPAIR, label: 'حجوزات الصيانة', icon: 'fa-screwdriver-wrench' })
    ]);

    var ORDER_STATUSES = Object.freeze({
        pending: 'قيد الانتظار',
        processing: 'قيد المعالجة',
        confirmed: 'تم التأكيد',
        awaiting_delivery: 'بانتظار التنفيذ',
        shipped: 'تم الشحن',
        delivered: 'تم التسليم',
        completed: 'مكتمل',
        cancelled: 'ملغي',
        failed: 'فشل',
        refunded: 'مسترجع',
        in_progress: 'قيد التنفيذ',
        partial: 'جزئي',
        received: 'تم الاستلام',
        diagnosing: 'تشخيص',
        waiting_approval: 'بانتظار الموافقة',
        ready: 'جاهز',
        rejected: 'مرفوض'
    });

    var TYPE_LABELS = Object.freeze({
        physical: 'منتج',
        accessory: 'إكسسوار',
        service: 'خدمة',
        repair: 'صيانة'
    });

    var PHYSICAL_STATUS_OPTIONS = Object.freeze([
        'pending', 'processing', 'delivered', 'cancelled'
    ]);

    var SERVICE_STATUS_OPTIONS = Object.freeze([
        'pending', 'processing', 'in_progress', 'completed', 'partial', 'failed', 'cancelled', 'refunded'
    ]);

    var REPAIR_STATUS_OPTIONS = Object.freeze([
        'pending', 'in_progress', 'ready', 'completed', 'cancelled'
    ]);

    var PHYSICAL_STATUS_ACTION_LABELS = Object.freeze({
        pending: 'في الانتظار',
        processing: 'قيد التنفيذ',
        delivered: 'تم التسليم',
        cancelled: 'ملغي'
    });

    // Legacy status values still found in older rows that need to be mapped
    // back into the canonical state-machine entries when rendered.
    var LEGACY_PHYSICAL_STATUS_MAP = Object.freeze({
        awaiting_delivery: 'processing',
        confirmed: 'processing',
        shipped: 'processing',
        completed: 'delivered',
        failed: 'cancelled',
        refunded: 'cancelled'
    });

    // Status pill color tokens — kept here so badge styling in any admin
    // module stays in sync with the modern theme palette.
    var STATUS_TONES = Object.freeze({
        pending: 'warning',
        processing: 'info',
        confirmed: 'info',
        awaiting_delivery: 'info',
        shipped: 'info',
        in_progress: 'info',
        diagnosing: 'info',
        waiting_approval: 'warning',
        ready: 'success',
        delivered: 'success',
        completed: 'success',
        received: 'success',
        partial: 'warning',
        cancelled: 'danger',
        failed: 'danger',
        rejected: 'danger',
        refunded: 'danger'
    });

    window.AdminOrdersConstants = Object.freeze({
        ORDER_TYPES: ORDER_TYPES,
        TAB_CONFIG: TAB_CONFIG,
        ORDER_STATUSES: ORDER_STATUSES,
        TYPE_LABELS: TYPE_LABELS,
        PHYSICAL_STATUS_OPTIONS: PHYSICAL_STATUS_OPTIONS,
        SERVICE_STATUS_OPTIONS: SERVICE_STATUS_OPTIONS,
        REPAIR_STATUS_OPTIONS: REPAIR_STATUS_OPTIONS,
        PHYSICAL_STATUS_ACTION_LABELS: PHYSICAL_STATUS_ACTION_LABELS,
        LEGACY_PHYSICAL_STATUS_MAP: LEGACY_PHYSICAL_STATUS_MAP,
        STATUS_TONES: STATUS_TONES
    });
})();
