// ===== TechZone Admin - Notifications Helpers =====
(function () {
    'use strict';

    const AUDIENCE_ALL = 'all';
    const AUDIENCE_SINGLE = 'single';
    const DEFAULT_NOTIFICATION_TYPE = 'info';
    const INSERT_BATCH_SIZE = 200;
    const TITLE_MAX_LENGTH = 120;
    const BODY_MAX_LENGTH = 2000;
    const STAFF_ROLES = ['admin', 'super_admin', 'employee', 'technician'];
    const TYPE_OPTIONS = {
        info: 'رسالة عادية',
        success: 'رسالة نجاح',
        warning: 'تنبيه',
        error: 'تنبيه مهم'
    };
    const NOTE_ITEMS = [
        ['الرسالة', 'تظهر الإشعارات للمستخدم داخل حسابه مباشرة بعد الإرسال الناجح.'],
        ['الإرسال الجماعي', 'سيتم الإرسال فقط إلى الحسابات النشطة وغير المحظورة داخل الموقع.'],
        ['مستخدم محدد', 'اختر مستخدماً واحداً من القائمة ثم أرسل الرسالة له مباشرة.'],
        ['تنبيه مهم', 'يعرض للمستخدم كتنبيه بارز داخل واجهة الحساب عند تسجيل الدخول.']
    ];

    /**
     * Escapes HTML safely for option labels and dynamic markup.
     *
     * @param {string} value
     * @returns {string}
     */
    function escapeHtmlValue(value) {
        if (typeof TZ !== 'undefined' && typeof TZ.escapeHtml === 'function') {
            return TZ.escapeHtml(value);
        }

        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * Returns customer users who can receive admin notifications.
     *
     * @param {Array<Record<string, unknown>>} users
     * @returns {Array<Record<string, unknown>>}
     */
    function getCustomerRecipients(users) {
        return (Array.isArray(users) ? users : []).filter(function (user) {
            const role = String(user?.role || '').trim().toLowerCase();
            const status = String(user?.status || 'active').trim().toLowerCase();
            const isCustomer = typeof TZ !== 'undefined' && typeof TZ.isCustomerUser === 'function'
                ? TZ.isCustomerUser(user)
                : !STAFF_ROLES.includes(role);

            return Boolean(user?.id) && isCustomer && status === 'active';
        });
    }

    /**
     * Builds the recipient options for the user select input.
     *
     * @param {Array<Record<string, unknown>>} users
     * @returns {string}
     */
    function buildUserOptions(users) {
        const options = (Array.isArray(users) ? users : []).map(function (user) {
            const labelParts = [user.fullName || 'مستخدم'];

            if (user.phone) {
                labelParts.push(user.phone);
            } else if (user.email) {
                labelParts.push(user.email);
            }

            return '<option value="' + escapeHtmlValue(String(user.id)) + '">'
                + escapeHtmlValue(labelParts.join(' - ')) + '</option>';
        });

        return ['<option value="">اختر المستخدم المطلوب</option>'].concat(options).join('');
    }

    /**
     * Builds validated notification insert rows for Supabase.
     *
     * @param {{audience:string,title:string,body:string,type:string,recipients:Array<Record<string, unknown>>}} input
     * @returns {Array<Record<string, unknown>>}
     * @throws {Error}
     */
    function buildNotificationRows(input) {
        const audience = input?.audience === AUDIENCE_SINGLE ? AUDIENCE_SINGLE : AUDIENCE_ALL;
        const title = String(input?.title || '').trim();
        const body = String(input?.body || '').trim();
        const type = TYPE_OPTIONS[input?.type] ? input.type : DEFAULT_NOTIFICATION_TYPE;
        const recipients = Array.isArray(input?.recipients) ? input.recipients.filter(Boolean) : [];

        if (!title) throw new Error('أدخل عنوان الرسالة.');
        if (title.length > TITLE_MAX_LENGTH) throw new Error('عنوان الرسالة طويل جداً.');
        if (!body) throw new Error('أدخل محتوى الرسالة.');
        if (body.length > BODY_MAX_LENGTH) throw new Error('محتوى الرسالة طويل جداً.');
        if (recipients.length === 0) {
            throw new Error(audience === AUDIENCE_SINGLE ? 'اختر المستخدم المطلوب أولاً.' : 'لا يوجد مستخدمون نشطون لاستقبال الإشعارات.');
        }

        return recipients.map(function (user) {
            return {
                user_id: user.id,
                title: title,
                body: body,
                type: type,
                reference_type: 'admin_broadcast',
                reference_id: audience === AUDIENCE_SINGLE ? String(user.id) : null,
                metadata: {
                    audience: audience,
                    source: 'legacy_admin',
                    recipient_name: user.fullName || '',
                    recipient_email: user.email || ''
                }
            };
        });
    }

    /**
     * Splits rows into small batches to avoid oversized inserts.
     *
     * @param {Array<Record<string, unknown>>} rows
     * @returns {Array<Array<Record<string, unknown>>>}
     */
    function buildInsertBatches(rows) {
        const items = Array.isArray(rows) ? rows : [];
        const batches = [];

        for (let index = 0; index < items.length; index += INSERT_BATCH_SIZE) {
            batches.push(items.slice(index, index + INSERT_BATCH_SIZE));
        }

        return batches;
    }

    /**
     * Resolves the helper text shown under the notifications form.
     *
     * @param {{audience:string,selectedUser?:Record<string, unknown>|null,totalRecipients:number}} input
     * @returns {string}
     */
    function getAudienceHint(input) {
        const totalRecipients = Number(input?.totalRecipients || 0);
        const audience = input?.audience === AUDIENCE_SINGLE ? AUDIENCE_SINGLE : AUDIENCE_ALL;

        if (totalRecipients === 0) {
            return 'لا يوجد مستخدمون نشطون حالياً لاستقبال الإشعارات من لوحة الإدارة.';
        }
        if (audience === AUDIENCE_SINGLE) {
            if (!input?.selectedUser) {
                return 'اختر مستخدماً واحداً من القائمة ليصله الإشعار مباشرة داخل حسابه.';
            }

            return 'سيتم الإرسال إلى ' + (input.selectedUser.fullName || 'المستخدم المحدد') + ' فقط.';
        }

        return 'سيتم الإرسال إلى جميع المستخدمين النشطين داخل الموقع وعددهم ' + totalRecipients + '.';
    }

    /**
     * Collects the recipients for the selected audience mode.
     *
     * @param {Array<Record<string, unknown>>} recipients
     * @param {string} audience
     * @param {string} selectedUserId
     * @returns {Array<Record<string, unknown>>}
     */
    function collectSelectedRecipients(recipients, audience, selectedUserId) {
        if (audience !== AUDIENCE_SINGLE) {
            return (Array.isArray(recipients) ? recipients : []).slice();
        }

        const selectedUser = (Array.isArray(recipients) ? recipients : []).find(function (user) {
            return String(user.id) === String(selectedUserId || '');
        });

        return selectedUser ? [selectedUser] : [];
    }

    window.AdminNotificationHelpers = {
        AUDIENCE_ALL: AUDIENCE_ALL,
        AUDIENCE_SINGLE: AUDIENCE_SINGLE,
        BODY_MAX_LENGTH: BODY_MAX_LENGTH,
        TITLE_MAX_LENGTH: TITLE_MAX_LENGTH,
        TYPE_OPTIONS: TYPE_OPTIONS,
        NOTE_ITEMS: NOTE_ITEMS,
        getCustomerRecipients: getCustomerRecipients,
        buildUserOptions: buildUserOptions,
        buildNotificationRows: buildNotificationRows,
        buildInsertBatches: buildInsertBatches,
        getAudienceHint: getAudienceHint,
        collectSelectedRecipients: collectSelectedRecipients
    };

    if (window.__ENABLE_NOTIFICATION_ADMIN_TEST_HOOKS__) {
        window.__notificationAdminTestHooks = window.AdminNotificationHelpers;
    }
})();
