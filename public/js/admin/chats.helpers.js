/**
 * TechZone Admin - Chats Helpers
 * Shared utilities for the admin support chat experience.
 */
(function () {
    'use strict';

    var PREVIEW_MAX_LENGTH = 90;

    /**
     * Normalizes free-form chat text before previewing or sending it.
     *
     * @param {unknown} value
     * @returns {string}
     */
    function normalizeAdminChatText(value) {
        return String(value || '').replace(/\s+/g, ' ').trim();
    }

    /**
     * Resolves the most relevant timestamp for a conversation row.
     *
     * @param {Object} conversation
     * @returns {number}
     */
    function getConversationTimestamp(conversation) {
        return new Date(
            conversation?.last_message_at
            || conversation?.updated_at
            || conversation?.created_at
            || 0
        ).getTime();
    }

    /**
     * Returns conversations sorted from newest activity to oldest.
     *
     * @param {Object[]} conversations
     * @returns {Object[]}
     */
    function sortAdminChatConversations(conversations) {
        return (Array.isArray(conversations) ? conversations : []).slice().sort(function (first, second) {
            return getConversationTimestamp(second) - getConversationTimestamp(first);
        });
    }

    /**
     * Returns the localized status label displayed to admins.
     *
     * @param {Object} conversation
     * @returns {string}
     */
    function getAdminChatStatusLabel(conversation) {
        if (conversation?.status === 'closed') {
            return 'مغلقة';
        }

        if (conversation?.last_message_sender_role === 'customer') {
            return 'بانتظار الرد';
        }

        if (conversation?.assigned_admin_id) {
            return 'قيد المتابعة';
        }

        return 'مفتوحة';
    }

    /**
     * Returns the badge class used by the admin status badge.
     *
     * @param {Object} conversation
     * @returns {string}
     */
    function getAdminChatStatusClass(conversation) {
        if (conversation?.status === 'closed') {
            return 'completed';
        }

        return conversation?.last_message_sender_role === 'customer' ? 'pending' : 'active';
    }

    /**
     * Filters conversations by query text and derived status.
     *
     * @param {{ conversations?: Object[], searchQuery?: string, statusFilter?: string }} input
     * @returns {Object[]}
     */
    function filterAdminChatConversations(input) {
        var conversations = Array.isArray(input?.conversations) ? input.conversations : [];
        var normalizedQuery = normalizeAdminChatText(input?.searchQuery).toLowerCase();
        var statusFilter = String(input?.statusFilter || 'all').trim().toLowerCase();

        return conversations.filter(function (conversation) {
            var searchable = [
                conversation?.customer_name,
                conversation?.customer_email,
                conversation?.customer_phone,
                conversation?.subject,
                conversation?.last_message_preview
            ].join(' ').toLowerCase();
            var isPending = conversation?.status !== 'closed'
                && conversation?.last_message_sender_role === 'customer';

            if (statusFilter === 'pending' && !isPending) {
                return false;
            }

            if (statusFilter === 'open' && (conversation?.status === 'closed' || isPending)) {
                return false;
            }

            if (statusFilter === 'closed' && conversation?.status !== 'closed') {
                return false;
            }

            return !normalizedQuery || searchable.indexOf(normalizedQuery) !== -1;
        });
    }

    /**
     * Builds the conversation metadata update applied after an admin reply.
     *
     * @param {unknown} body
     * @returns {Object}
     */
    function buildAdminConversationUpdate(body) {
        var normalizedBody = normalizeAdminChatText(body);

        return {
            status: 'open',
            last_message_preview: normalizedBody.slice(0, PREVIEW_MAX_LENGTH),
            last_message_at: new Date().toISOString(),
            last_message_sender_role: 'admin'
        };
    }

    /**
     * Builds the user notification payload triggered after an admin reply.
     *
     * @param {Object} conversation
     * @param {unknown} body
     * @returns {Object|null}
     */
    function buildAdminReplyNotification(conversation, body) {
        var userId = String(conversation?.user_id || '').trim();
        var conversationId = String(conversation?.id || '').trim();

        if (!userId || !conversationId) {
            return null;
        }

        return {
            user_id: userId,
            title: 'رد جديد على محادثتك المباشرة',
            body: normalizeAdminChatText(body),
            type: 'info',
            reference_type: 'chat',
            reference_id: conversationId
        };
    }

    /**
     * Builds the summary counters shown above the admin chat workspace.
     *
     * @param {Object[]} conversations
     * @returns {{ total: number, open: number, pending: number, closed: number }}
     */
    function buildAdminChatSummary(conversations) {
        return (Array.isArray(conversations) ? conversations : []).reduce(function (summary, conversation) {
            summary.total += 1;

            if (conversation?.status === 'closed') {
                summary.closed += 1;
                return summary;
            }

            if (conversation?.last_message_sender_role === 'customer') {
                summary.pending += 1;
                return summary;
            }

            summary.open += 1;
            return summary;
        }, {
            total: 0,
            open: 0,
            pending: 0,
            closed: 0
        });
    }

    window.AdminChatsHelpers = {
        buildAdminChatSummary: buildAdminChatSummary,
        buildAdminConversationUpdate: buildAdminConversationUpdate,
        buildAdminReplyNotification: buildAdminReplyNotification,
        filterAdminChatConversations: filterAdminChatConversations,
        getAdminChatStatusClass: getAdminChatStatusClass,
        getAdminChatStatusLabel: getAdminChatStatusLabel,
        normalizeAdminChatText: normalizeAdminChatText,
        sortAdminChatConversations: sortAdminChatConversations
    };

    if (window.__ENABLE_ADMIN_CHATS_TEST_HOOKS__) {
        window.__adminChatsTestHooks = window.AdminChatsHelpers;
    }
})();
