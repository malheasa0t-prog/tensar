// ===== TechZone Admin - Live Chats =====
(function () {
    'use strict';

    const A = window.AdminApp;
    const H = window.AdminChatsHelpers;

    if (!A || !H) return;

    const state = {
        conversations: [],
        messages: [],
        selectedConversationId: '',
        loading: false,
        loadingMessages: false,
        sending: false,
        error: '',
        cleanupConversations: null,
        cleanupMessages: null
    };

    /**
     * Returns the currently selected conversation.
     *
     * @returns {Record<string, unknown> | null}
     */
    function getSelectedConversation() {
        return state.conversations.find(function (conversation) {
            return String(conversation.id) === String(state.selectedConversationId || '');
        }) || null;
    }

    /**
     * Removes all active realtime subscriptions for the chats section.
     *
     * @returns {void}
     */
    function cleanupChatsSection() {
        if (typeof state.cleanupConversations === 'function') state.cleanupConversations();
        if (typeof state.cleanupMessages === 'function') state.cleanupMessages();
        state.cleanupConversations = null;
        state.cleanupMessages = null;
    }

    /**
     * Renders the main chats section shell using the current state snapshot.
     *
     * @returns {void}
     */
    function renderChats() {
        const selectedConversation = getSelectedConversation();
        const listMarkup = state.loading
            ? '<div class="admin-chat-empty"><i class="fas fa-spinner fa-spin"></i><p>جاري تحميل المحادثات...</p></div>'
            : state.conversations.length === 0
                ? '<div class="admin-chat-empty"><i class="fas fa-comments"></i><p>لا توجد محادثات مباشرة حالياً.</p></div>'
                : state.conversations.map(function (conversation) {
                    const isActive = String(conversation.id) === String(state.selectedConversationId || '');
                    const customerName = TZ.escapeHtml(conversation.customer_name || 'مستخدم');
                    const customerEmail = TZ.escapeHtml(conversation.customer_email || '-');
                    const statusLabel = H.getAdminChatStatusLabel(conversation);
                    const rowClass = 'admin-chat-item' + (isActive ? ' is-active' : '') + (statusLabel === 'بانتظار الرد' ? ' has-pending' : '');

                    return '<button type="button" class="' + rowClass + '" data-conversation-id="' + conversation.id + '">'
                        + '<div class="admin-chat-item-head"><strong>' + customerName + '</strong><span>' + H.formatAdminChatRelativeTime(conversation.last_message_at) + '</span></div>'
                        + '<p>' + customerEmail + '</p>'
                        + '<div class="admin-chat-item-meta"><span>' + TZ.escapeHtml(H.buildAdminChatPreview(conversation.last_message_preview || '')) + '</span><small>' + statusLabel + '</small></div>'
                        + '</button>';
                }).join('');
        const messagesMarkup = !selectedConversation
            ? '<div class="admin-chat-thread-empty"><i class="fas fa-comment-dots"></i><p>اختر محادثة للرد</p></div>'
            : state.loadingMessages
                ? '<div class="admin-chat-thread-empty"><i class="fas fa-spinner fa-spin"></i><p>جاري تحميل الرسائل...</p></div>'
                : state.messages.length === 0
                    ? '<div class="admin-chat-thread-empty"><i class="fas fa-inbox"></i><p>لا توجد رسائل داخل هذه المحادثة بعد.</p></div>'
                    : state.messages.map(function (message) {
                        const messageClass = message.sender_role === 'admin' ? 'admin-chat-message admin' : 'admin-chat-message customer';
                        return '<div class="' + messageClass + '"><div class="admin-chat-bubble"><div class="admin-chat-message-meta"><strong>'
                            + TZ.escapeHtml(message.sender_name || 'المستخدم')
                            + '</strong><span>' + H.formatAdminChatRelativeTime(message.created_at) + '</span></div><p>'
                            + TZ.escapeHtml(message.body || '')
                            + '</p></div></div>';
                    }).join('');

        A.adminContent.innerHTML = ''
            + '<div class="admin-chat-grid">'
            + '  <section class="admin-panel"><div class="panel-header"><h2><i class="fas fa-comments"></i> الدردشات</h2></div><div class="panel-body padded admin-chat-main">'
            + (state.error ? '<div class="status-box warning">' + TZ.escapeHtml(state.error) + '</div>' : '')
            + (selectedConversation
                ? '<div class="admin-chat-header"><div><strong>' + TZ.escapeHtml(selectedConversation.customer_name || 'مستخدم') + '</strong><p>' + TZ.escapeHtml(selectedConversation.customer_email || '') + '</p></div><div class="admin-chat-header-meta"><span class="status-badge ' + (selectedConversation.status === 'closed' ? 'hidden' : 'active') + '">' + TZ.escapeHtml(H.getAdminChatStatusLabel(selectedConversation)) + '</span><button type="button" class="btn btn-outline btn-sm" id="toggleChatStatusBtn">' + (selectedConversation.status === 'closed' ? 'إعادة الفتح' : 'إغلاق المحادثة') + '</button></div></div>'
                : '')
            + '<div class="admin-chat-thread">' + messagesMarkup + '</div>'
            + (selectedConversation ? '<form id="adminChatReplyForm" class="admin-chat-reply"><textarea id="adminChatReplyBody" placeholder="اكتب الرد هنا..." ' + (state.sending ? 'disabled' : '') + '></textarea><div class="admin-chat-reply-actions"><span>سيظهر الرد فوراً داخل الموقع وعبر الإشعارات.</span><button type="submit" class="btn btn-primary" ' + (state.sending ? 'disabled' : '') + '><i class="fas fa-paper-plane"></i> ' + (state.sending ? 'جاري الإرسال...' : 'إرسال الرد') + '</button></div></form>' : '')
            + '  </div></section>'
            + '  <aside class="admin-panel admin-chat-sidebar"><div class="panel-header"><h2><i class="fas fa-list"></i> المحادثات</h2></div><div class="panel-body admin-chat-list">' + listMarkup + '</div></aside>'
            + '</div>';

        bindChatEvents();
    }

    /**
     * Loads messages for the active conversation and marks customer messages as seen.
     *
     * @param {string} conversationId
     * @returns {Promise<void>}
     */
    async function loadMessages(conversationId) {
        if (!conversationId) return;
        state.loadingMessages = true;
        renderChats();

        const response = await TZ.supabase.from('support_chat_messages').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: true });
        state.messages = response.data || [];
        state.loadingMessages = false;
        if (response.error) state.error = 'تعذر تحميل الرسائل الحالية.';
        renderChats();

        await TZ.supabase.from('support_chat_messages').update({ is_read_by_admin: true }).eq('conversation_id', conversationId).eq('sender_role', 'customer').eq('is_read_by_admin', false);
        if (typeof state.cleanupMessages === 'function') state.cleanupMessages();
        const messagesChannel = TZ.supabase.channel('admin-chat-messages-' + conversationId).on('postgres_changes', {
            event: '*', schema: 'public', table: 'support_chat_messages', filter: 'conversation_id=eq.' + conversationId
        }, function () { void loadMessages(conversationId); }).subscribe();
        state.cleanupMessages = function () {
            TZ.supabase.removeChannel(messagesChannel);
        };
    }

    /**
     * Loads the conversations list while keeping the current selection when possible.
     *
     * @returns {Promise<void>}
     */
    async function loadConversations() {
        state.loading = true;
        renderChats();

        const response = await TZ.supabase.from('support_conversations').select('*').order('last_message_at', { ascending: false }).limit(100);
        state.loading = false;
        state.error = response.error ? 'تعذر تحميل المحادثات المباشرة.' : '';
        state.conversations = H.sortAdminChatConversations(response.data || []);

        if (!getSelectedConversation() && state.conversations.length > 0) {
            state.selectedConversationId = state.conversations[0].id;
        }

        renderChats();
        if (state.selectedConversationId) {
            await loadMessages(state.selectedConversationId);
        }
    }

    /**
     * Sends a new admin reply to the selected conversation.
     *
     * @param {string} body
     * @returns {Promise<void>}
     */
    async function sendReply(body) {
        const conversation = getSelectedConversation();
        const authUser = await TZ.getSupabaseUser();
        const normalizedBody = H.normalizeAdminChatBody(body);

        if (!conversation || !authUser) {
            A.showToast('تعذر تحديد جلسة الأدمن الحالية.');
            return;
        }
        if (!normalizedBody) {
            A.showToast('اكتب الرد أولاً.');
            return;
        }

        state.sending = true;
        renderChats();

        const insertMessage = await TZ.supabase.from('support_chat_messages').insert([{
            conversation_id: conversation.id,
            sender_user_id: authUser.id,
            sender_role: 'admin',
            sender_name: TZ.getSession()?.name || 'الإدارة',
            body: normalizedBody,
            is_read_by_customer: false,
            is_read_by_admin: true
        }]);
        const updateConversation = await TZ.supabase.from('support_conversations').update(H.buildAdminConversationUpdate(normalizedBody)).eq('id', conversation.id);

        let successMessage = 'تم إرسال الرد بنجاح.';
        if (!insertMessage.error && !updateConversation.error) {
            const notifyResponse = await TZ.supabase.from('notifications').insert([H.buildAdminReplyNotification(conversation, normalizedBody)]);
            if (notifyResponse.error) successMessage = 'تم إرسال الرد لكن تعذر إرسال الإشعار.';
            A.showToast(successMessage);
        } else {
            A.showToast('تعذر إرسال الرد حالياً.');
        }

        state.sending = false;
        state.error = insertMessage.error || updateConversation.error ? 'تعذر تحديث المحادثة بعد الرد.' : '';
        await loadConversations();
    }

    /**
     * Updates the selected conversation status between open and closed.
     *
     * @returns {Promise<void>}
     */
    async function toggleConversationStatus() {
        const conversation = getSelectedConversation();
        if (!conversation) return;

        const nextStatus = conversation.status === H.CHAT_OPEN_STATUS ? 'closed' : H.CHAT_OPEN_STATUS;
        const response = await TZ.supabase.from('support_conversations').update({ status: nextStatus }).eq('id', conversation.id);
        A.showToast(response.error ? 'تعذر تحديث حالة المحادثة.' : 'تم تحديث حالة المحادثة.');
        await loadConversations();
    }

    /**
     * Binds click and submit handlers after each render.
     *
     * @returns {void}
     */
    function bindChatEvents() {
        document.querySelectorAll('[data-conversation-id]').forEach(function (button) {
            button.addEventListener('click', function () {
                state.selectedConversationId = this.dataset.conversationId;
                void loadMessages(state.selectedConversationId);
            });
        });

        document.getElementById('toggleChatStatusBtn')?.addEventListener('click', function () {
            void toggleConversationStatus();
        });

        document.getElementById('adminChatReplyForm')?.addEventListener('submit', function (event) {
            event.preventDefault();
            const body = document.getElementById('adminChatReplyBody')?.value || '';
            void sendReply(body);
        });
    }

    /**
     * Renders and subscribes to the admin chats section.
     *
     * @returns {void}
     */
    function renderAdminChatsSection() {
        cleanupChatsSection();
        state.conversations = [];
        state.messages = [];
        state.selectedConversationId = '';
        state.loading = true;
        state.loadingMessages = false;
        state.sending = false;
        state.error = '';
        renderChats();

        const conversationsChannel = TZ.supabase.channel('admin-support-conversations').on('postgres_changes', {
            event: '*', schema: 'public', table: 'support_conversations'
        }, function () { void loadConversations(); }).subscribe();
        state.cleanupConversations = function () {
            TZ.supabase.removeChannel(conversationsChannel);
        };
        void loadConversations();
        A.teardownCurrentSection = cleanupChatsSection;
    }

    A.sections.chats = renderAdminChatsSection;
})();
