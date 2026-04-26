/**
 * TechZone Admin - Notifications helpers.
 * Exposes pure utilities for broadcast notification flows and tests.
 */
(function () {
    'use strict';

    var INSERT_BATCH_SIZE = 200;
    var DEFAULT_TYPE = 'info';
    var SINGLE_AUDIENCE = 'single';
    var BROADCAST_REFERENCE_TYPE = 'admin_broadcast';
    var BROADCAST_SOURCE = 'legacy_admin';

    /**
     * Normalizes a text value for validation and display.
     *
     * @param {unknown} value
     * @returns {string}
     */
    function normalizeText(value) {
        return String(value || '').trim();
    }

    /**
     * Returns true when the user is an active customer recipient.
     *
     * @param {Record<string, unknown>} user
     * @returns {boolean}
     */
    function isCustomerRecipient(user) {
        var role = normalizeText(user?.role).toLowerCase();
        var status = normalizeText(user?.status).toLowerCase();
        return status === 'active' && (role === 'user' || role === 'customer');
    }

    /**
     * Filters a user list down to active customer recipients.
     *
     * @param {Array<Record<string, unknown>>} users
     * @returns {Array<Record<string, unknown>>}
     */
    function getCustomerRecipients(users) {
        return (Array.isArray(users) ? users : []).filter(isCustomerRecipient);
    }

    /**
     * Validates the notification builder input.
     *
     * @param {Record<string, unknown>} input
     * @returns {{ audience: string, body: string, recipients: Array<Record<string, unknown>>, title: string, type: string }}
     * @throws {Error}
     */
    function validateNotificationInput(input) {
        var title = normalizeText(input?.title);
        var body = normalizeText(input?.body);
        var type = normalizeText(input?.type) || DEFAULT_TYPE;
        var audience = normalizeText(input?.audience) || 'all';
        var recipients = Array.isArray(input?.recipients) ? input.recipients : [];

        if (!title) {
            throw new Error('أدخل عنوان الرسالة');
        }

        if (audience === SINGLE_AUDIENCE && recipients.length !== 1) {
            throw new Error('اختر مستلمًا واحدًا صالحًا');
        }

        if (audience !== SINGLE_AUDIENCE && recipients.length === 0) {
            throw new Error('لا يوجد مستلمون صالحون للإرسال');
        }

        return {
            audience: audience,
            body: body,
            recipients: recipients,
            title: title,
            type: type
        };
    }

    /**
     * Builds one row for the notifications table.
     *
     * @param {{ audience: string, body: string, recipient: Record<string, unknown>, title: string, type: string }} input
     * @returns {Record<string, unknown>}
     */
    function buildNotificationRow(input) {
        return {
            user_id: input.recipient.id,
            title: input.title,
            body: input.body,
            type: input.type,
            reference_type: BROADCAST_REFERENCE_TYPE,
            reference_id: null,
            metadata: {
                audience: input.audience,
                source: BROADCAST_SOURCE,
                recipient_name: normalizeText(input.recipient.fullName),
                recipient_email: normalizeText(input.recipient.email)
            }
        };
    }

    /**
     * Builds notification rows for one audience selection.
     *
     * @param {Record<string, unknown>} input
     * @returns {Array<Record<string, unknown>>}
     * @throws {Error}
     */
    function buildNotificationRows(input) {
        var normalized = validateNotificationInput(input);
        return normalized.recipients.map(function (recipient) {
            return buildNotificationRow({
                audience: normalized.audience,
                body: normalized.body,
                recipient: recipient,
                title: normalized.title,
                type: normalized.type
            });
        });
    }

    /**
     * Splits large inserts into fixed-size chunks.
     *
     * @param {Array<Record<string, unknown>>} rows
     * @returns {Array<Array<Record<string, unknown>>>}
     */
    function buildInsertBatches(rows) {
        var batches = [];
        var list = Array.isArray(rows) ? rows : [];

        for (var index = 0; index < list.length; index += INSERT_BATCH_SIZE) {
            batches.push(list.slice(index, index + INSERT_BATCH_SIZE));
        }

        return batches;
    }

    /**
     * Builds the audience hint shown in the admin UI.
     *
     * @param {{ audience?: string, selectedUser?: Record<string, unknown>, totalRecipients?: number }} input
     * @returns {string}
     */
    function getAudienceHint(input) {
        var audience = normalizeText(input?.audience) || 'all';
        if (audience === SINGLE_AUDIENCE) {
            var name = normalizeText(input?.selectedUser?.fullName) || 'هذا المستخدم';
            return 'سيتم الإرسال إلى ' + name + ' فقط.';
        }

        return 'سيتم الإرسال إلى ' + Number(input?.totalRecipients || 0) + ' من العملاء النشطين.';
    }

    window.AdminNotificationsHelpers = {
        buildInsertBatches: buildInsertBatches,
        buildNotificationRows: buildNotificationRows,
        getAudienceHint: getAudienceHint,
        getCustomerRecipients: getCustomerRecipients
    };

    if (window.__ENABLE_NOTIFICATION_ADMIN_TEST_HOOKS__) {
        window.__notificationAdminTestHooks = window.AdminNotificationsHelpers;
    }
})();
