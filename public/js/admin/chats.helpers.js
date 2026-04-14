// ===== TechZone Admin - Chats Helpers =====
(function () {
    'use strict';

    const CHAT_OPEN_STATUS = 'open';
    const CHAT_PREVIEW_LIMIT = 72;

    /**
     * Normalizes chat text before using it in the admin panel.
     *
     * @param {unknown} value
     * @returns {string}
     */
    function normalizeAdminChatBody(value) {
        return String(value || '').replace(/\s+/g, ' ').trim();
    }

    /**
     * Builds the preview shown in the conversations list.
     *
     * @param {unknown} body
     * @returns {string}
     */
    function buildAdminChatPreview(body) {
        const normalized = normalizeAdminChatBody(body);

        if (normalized.length <= CHAT_PREVIEW_LIMIT) {
            return normalized;
        }

        return normalized.slice(0, CHAT_PREVIEW_LIMIT - 1) + '…';
    }

    /**
     * Sorts conversations by the latest message timestamp.
     *
     * @param {Array<Record<string, unknown>>} conversations
     * @returns {Array<Record<string, unknown>>}
     */
    function sortAdminChatConversations(conversations) {
        return (Array.isArray(conversations) ? conversations : []).slice().sort(function (left, right) {
            return new Date(right.last_message_at || 0).getTime() - new Date(left.last_message_at || 0).getTime();
        });
    }

    /**
     * Formats timestamps as short Arabic relative time labels.
     *
     * @param {string | null | undefined} value
     * @returns {string}
     */
    function formatAdminChatRelativeTime(value) {
        if (!value) {
            return 'الآن';
        }

        const deltaMinutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));

        if (deltaMinutes < 1) return 'الآن';
        if (deltaMinutes < 60) return `منذ ${deltaMinutes} دقيقة`;
        if (deltaMinutes < 1440) return `منذ ${Math.round(deltaMinutes / 60)} ساعة`;

        return `منذ ${Math.round(deltaMinutes / 1440)} يوم`;
    }

    /**
     * Resolves the status copy shown for each conversation row.
     *
     * @param {Record<string, unknown>} conversation
     * @returns {string}
     */
    function getAdminChatStatusLabel(conversation) {
        if (String(conversation?.status || '').toLowerCase() !== CHAT_OPEN_STATUS) {
            return 'مغلقة';
        }

        return String(conversation?.last_message_sender_role || '').toLowerCase() === 'customer'
            ? 'بانتظار الرد'
            : 'تم الرد';
    }

    /**
     * Builds the metadata update applied to a conversation after an admin reply.
     *
     * @param {unknown} body
     * @param {string} [status=CHAT_OPEN_STATUS]
     * @returns {Record<string, unknown>}
     */
    function buildAdminConversationUpdate(body, status) {
        return {
            status: status || CHAT_OPEN_STATUS,
            last_message_preview: buildAdminChatPreview(body),
            last_message_sender_role: 'admin',
            last_message_at: new Date().toISOString()
        };
    }

    /**
     * Builds a customer notification payload after the admin reply is stored.
     *
     * @param {{ user_id?: string, id?: string }} conversation
     * @param {unknown} body
     * @returns {Record<string, unknown>}
     */
    function buildAdminReplyNotification(conversation, body) {
        return {
            user_id: conversation?.user_id,
            title: 'رد جديد على محادثتك المباشرة',
            body: buildAdminChatPreview(body),
            type: 'info',
            reference_type: 'chat',
            reference_id: conversation?.id || ''
        };
    }

    window.AdminChatsHelpers = {
        CHAT_OPEN_STATUS: CHAT_OPEN_STATUS,
        normalizeAdminChatBody: normalizeAdminChatBody,
        buildAdminChatPreview: buildAdminChatPreview,
        sortAdminChatConversations: sortAdminChatConversations,
        formatAdminChatRelativeTime: formatAdminChatRelativeTime,
        getAdminChatStatusLabel: getAdminChatStatusLabel,
        buildAdminConversationUpdate: buildAdminConversationUpdate,
        buildAdminReplyNotification: buildAdminReplyNotification
    };

    if (window.__ENABLE_ADMIN_CHATS_TEST_HOOKS__) {
        window.__adminChatsTestHooks = window.AdminChatsHelpers;
    }
})();
