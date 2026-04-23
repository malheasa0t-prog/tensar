/**
 * TechZone Admin - Chats Section
 * Renders the support conversation workspace for admins.
 */
(function () {
    'use strict';

    var A = window.AdminApp;
    var Helpers = window.AdminChatsHelpers;
    var MAX_REPLY_LENGTH = 1000;
    var state = {
        conversations: [],
        messages: [],
        searchQuery: '',
        selectedConversationId: '',
        statusFilter: 'all'
    };

    if (!A || !Helpers) return;

    /**
     * Escapes any dynamic UI string.
     *
     * @param {unknown} value
     * @returns {string}
     */
    function esc(value) {
        return TZ.escapeHtml(value == null ? '' : String(value));
    }

    /**
     * Returns the currently selected conversation from cached state.
     *
     * @returns {Object|null}
     */
    function getSelectedConversation() {
        return state.conversations.find(function (conversation) {
            return conversation.id === state.selectedConversationId;
        }) || null;
    }

    /**
     * Returns the filtered conversation list for the current controls.
     *
     * @returns {Object[]}
     */
    function getFilteredConversations() {
        return Helpers.filterAdminChatConversations({
            conversations: state.conversations,
            searchQuery: state.searchQuery,
            statusFilter: state.statusFilter
        });
    }

    /**
     * Shows a loading shell while the chat workspace is hydrated.
     *
     * @param {string} message
     * @returns {void}
     */
    function renderLoadingState(message) {
        A.adminContent.innerHTML = '<div class="admin-section-header"><div><h2><i class="fas fa-comments"></i> الدردشات</h2></div></div>'
            + '<div class="admin-panel"><div class="panel-body"><div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>'
            + esc(message || 'جاري تحميل المحادثات...')
            + '</p></div></div></div>';
    }

    /**
     * Loads all support conversations sorted by latest activity.
     *
     * @returns {Promise<void>}
     * @throws {Error}
     */
    async function loadConversations() {
        var result = await TZ.supabase.from('support_conversations')
            .select('*')
            .order('last_message_at', { ascending: false });

        if (result.error) {
            throw new Error('تعذر تحميل المحادثات الحالية.');
        }

        state.conversations = Helpers.sortAdminChatConversations(result.data || []);
    }

    /**
     * Loads the message thread for one conversation.
     *
     * @param {string} conversationId
     * @returns {Promise<void>}
     * @throws {Error}
     */
    async function loadMessages(conversationId) {
        if (!conversationId) {
            state.messages = [];
            return;
        }

        var result = await TZ.supabase.from('support_chat_messages')
            .select('*')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true });

        if (result.error) {
            throw new Error('تعذر تحميل رسائل المحادثة.');
        }

        state.messages = Array.isArray(result.data) ? result.data : [];
    }

    /**
     * Ensures the selected conversation stays in sync with the active filters.
     *
     * @returns {Promise<void>}
     */
    async function syncSelectedConversation() {
        var filteredConversations = getFilteredConversations();
        var fallbackConversation = filteredConversations[0] || null;
        var selectedConversation = filteredConversations.find(function (conversation) {
            return conversation.id === state.selectedConversationId;
        }) || fallbackConversation;

        state.selectedConversationId = selectedConversation ? selectedConversation.id : '';
        await loadMessages(state.selectedConversationId);
    }

    /**
     * Marks unread customer messages as seen by admin.
     *
     * @param {string} conversationId
     * @returns {Promise<void>}
     */
    async function markCustomerMessagesAsRead(conversationId) {
        if (!conversationId) {
            return;
        }

        await TZ.supabase.from('support_chat_messages').update({
            is_read_by_admin: true
        }).eq('conversation_id', conversationId)
            .eq('sender_role', 'customer')
            .eq('is_read_by_admin', false);
    }

    /**
     * Refreshes the entire chat workspace from Supabase.
     *
     * @param {string} loadingMessage
     * @returns {Promise<void>}
     */
    async function hydrateChats(loadingMessage) {
        renderLoadingState(loadingMessage || 'جاري تحميل المحادثات...');

        try {
            await loadConversations();
            await syncSelectedConversation();
            renderWorkspace();
        } catch (error) {
            A.showErrorToast('CHT-101', error?.message || 'تعذر تحميل قسم الدردشات.');
            renderLoadingState('تعذر تحميل الدردشات حاليًا.');
        }
    }

    /**
     * Returns the HTML for the stat cards shown above the workspace.
     *
     * @param {{ total: number, open: number, pending: number, closed: number }} summary
     * @returns {string}
     */
    function buildSummaryCards(summary) {
        return '<div class="stats-grid">'
            + '<div class="stat-card-admin"><div class="stat-icon blue"><i class="fas fa-comments"></i></div><div class="stat-info"><h3>' + summary.total + '</h3><p>إجمالي المحادثات</p></div></div>'
            + '<div class="stat-card-admin"><div class="stat-icon orange"><i class="fas fa-reply"></i></div><div class="stat-info"><h3>' + summary.pending + '</h3><p>بانتظار رد الإدارة</p></div></div>'
            + '<div class="stat-card-admin"><div class="stat-icon green"><i class="fas fa-headset"></i></div><div class="stat-info"><h3>' + summary.open + '</h3><p>تحت المتابعة</p></div></div>'
            + '<div class="stat-card-admin"><div class="stat-icon teal"><i class="fas fa-check-circle"></i></div><div class="stat-info"><h3>' + summary.closed + '</h3><p>محادثات مغلقة</p></div></div>'
            + '</div>';
    }

    /**
     * Builds the conversation sidebar list.
     *
     * @param {Object[]} conversations
     * @returns {string}
     */
    function buildConversationList(conversations) {
        if (conversations.length === 0) {
            return '<div class="admin-chat-empty"><div><i class="fas fa-comments"></i><p>لا توجد محادثات مطابقة للبحث الحالي.</p></div></div>';
        }

        return conversations.map(function (conversation) {
            var isActive = conversation.id === state.selectedConversationId;
            var isPending = conversation.status !== 'closed'
                && conversation.last_message_sender_role === 'customer';
            var customerMeta = [conversation.customer_email, conversation.customer_phone].filter(Boolean).join(' • ');

            return '<button type="button" class="admin-chat-item'
                + (isActive ? ' is-active' : '')
                + (isPending ? ' has-pending' : '')
                + '" data-chat-open="' + esc(conversation.id) + '">'
                + '<div class="admin-chat-item-head"><strong>' + esc(conversation.customer_name || 'عميل الموقع') + '</strong>'
                + '<span class="status-badge ' + esc(Helpers.getAdminChatStatusClass(conversation)) + '">'
                + esc(Helpers.getAdminChatStatusLabel(conversation))
                + '</span></div>'
                + '<p>' + esc(conversation.subject || 'محادثة مباشرة') + '</p>'
                + '<div class="admin-chat-item-meta"><span>' + esc((conversation.last_message_preview || 'لا توجد رسائل بعد').slice(0, 90)) + '</span>'
                + '<small>' + esc(A.formatDateTime(conversation.last_message_at || conversation.created_at)) + '</small></div>'
                + (customerMeta ? '<div class="admin-chat-item-meta"><small>' + esc(customerMeta) + '</small></div>' : '')
                + '</button>';
        }).join('');
    }

    /**
     * Builds the message thread for the selected conversation.
     *
     * @returns {string}
     */
    function buildMessageThread() {
        if (state.messages.length === 0) {
            return '<div class="admin-chat-thread-empty"><div><i class="fas fa-comment-slash"></i><p>لا توجد رسائل داخل هذه المحادثة بعد.</p></div></div>';
        }

        return state.messages.map(function (message) {
            var senderRole = message.sender_role === 'admin' ? 'admin' : 'customer';
            var senderName = message.sender_name || (senderRole === 'admin' ? 'الإدارة' : 'العميل');

            return '<div class="admin-chat-message ' + senderRole + '">'
                + '<div class="admin-chat-bubble">'
                + '<div class="admin-chat-message-meta"><strong>' + esc(senderName) + '</strong><span>' + esc(A.formatDateTime(message.created_at)) + '</span></div>'
                + '<p>' + esc(message.body || '') + '</p>'
                + '</div></div>';
        }).join('');
    }

    /**
     * Builds the main conversation panel for the selected row.
     *
     * @param {Object|null} conversation
     * @returns {string}
     */
    function buildConversationPanel(conversation) {
        if (!conversation) {
            return '<div class="admin-panel admin-chat-main"><div class="panel-body"><div class="admin-chat-empty"><div><i class="fas fa-comments"></i><p>اختر محادثة من القائمة الجانبية لعرض التفاصيل والرد عليها.</p></div></div></div></div>';
        }

        var customerMeta = [conversation.customer_email, conversation.customer_phone].filter(Boolean).join(' • ');
        var controls = conversation.status === 'closed'
            ? '<button type="button" class="btn btn-outline btn-sm" data-chat-reopen="' + esc(conversation.id) + '"><i class="fas fa-rotate-left"></i> إعادة فتح</button>'
            : '<button type="button" class="btn btn-outline btn-sm" data-chat-close="' + esc(conversation.id) + '"><i class="fas fa-lock"></i> إغلاق المحادثة</button>';

        return '<div class="admin-panel admin-chat-main">'
            + '<div class="panel-header admin-chat-header"><div><strong>' + esc(conversation.customer_name || 'عميل الموقع') + '</strong><p>' + esc(conversation.subject || 'محادثة مباشرة') + '</p></div>'
            + '<div class="admin-chat-header-meta"><span class="status-badge ' + esc(Helpers.getAdminChatStatusClass(conversation)) + '">' + esc(Helpers.getAdminChatStatusLabel(conversation)) + '</span>'
            + '<button type="button" class="btn btn-outline btn-sm" id="refreshChatsBtn"><i class="fas fa-rotate"></i> تحديث</button>'
            + controls + '</div></div>'
            + '<div class="panel-body padded">'
            + '<div class="admin-chat-header-meta"><p>' + esc(customerMeta || 'لا توجد بيانات تواصل إضافية') + '</p><p>آخر نشاط: ' + esc(A.formatDateTime(conversation.last_message_at || conversation.created_at)) + '</p></div>'
            + '<div class="admin-chat-thread" id="chatMessages">' + buildMessageThread() + '</div>'
            + '</div>'
            + (conversation.status === 'closed'
                ? '<div class="panel-body"><div class="admin-chat-empty"><div><i class="fas fa-lock"></i><p>هذه المحادثة مغلقة حاليًا. يمكنك إعادة فتحها إذا احتجت متابعة العميل.</p></div></div></div>'
                : '<div class="panel-body padded"><div class="admin-chat-reply">'
                    + '<textarea id="chatReplyInput" placeholder="اكتب رد الإدارة هنا..." maxlength="' + MAX_REPLY_LENGTH + '"></textarea>'
                    + '<div class="admin-chat-reply-actions"><span>الحد الأقصى ' + MAX_REPLY_LENGTH + ' حرف</span>'
                    + '<button type="button" class="btn btn-primary" id="sendReplyBtn"><i class="fas fa-paper-plane"></i> إرسال الرد</button></div>'
                    + '</div></div>')
            + '</div>';
    }

    /**
     * Binds click and input handlers after each render.
     *
     * @returns {void}
     */
    function bindEvents() {
        document.getElementById('chatSearch')?.addEventListener('input', function () {
            state.searchQuery = this.value;
            void syncSelectedConversation().then(renderWorkspace);
        });

        document.getElementById('chatStatusFilter')?.addEventListener('change', function () {
            state.statusFilter = this.value;
            void syncSelectedConversation().then(renderWorkspace);
        });

        document.getElementById('refreshChatsBtn')?.addEventListener('click', function () {
            void hydrateChats('جاري تحديث الدردشات...');
        });

        document.getElementById('sendReplyBtn')?.addEventListener('click', function () {
            void sendReply();
        });

        document.getElementById('chatReplyInput')?.addEventListener('keydown', function (event) {
            if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void sendReply();
            }
        });

        document.querySelectorAll('[data-chat-open]').forEach(function (button) {
            button.addEventListener('click', function () {
                void openConversation(button.dataset.chatOpen);
            });
        });

        document.querySelector('[data-chat-close]')?.addEventListener('click', function (event) {
            void updateConversationStatus(event.currentTarget.dataset.chatClose, 'closed');
        });

        document.querySelector('[data-chat-reopen]')?.addEventListener('click', function (event) {
            void updateConversationStatus(event.currentTarget.dataset.chatReopen, 'open');
        });
    }

    /**
     * Renders the full chat workspace using the current state snapshot.
     *
     * @returns {void}
     */
    function renderWorkspace() {
        var filteredConversations = getFilteredConversations();
        var selectedConversation = getSelectedConversation();
        var summary = Helpers.buildAdminChatSummary(state.conversations);
        var html = '<div class="admin-section-header"><div><h2><i class="fas fa-comments"></i> الدردشات</h2><p>'
            + summary.total + ' محادثة دعم مباشرة</p></div></div>';

        html += buildSummaryCards(summary);
        html += '<div class="filter-bar">'
            + '<input type="search" id="chatSearch" placeholder="ابحث بالاسم أو البريد أو الموضوع..." value="' + esc(state.searchQuery) + '">'
            + '<select id="chatStatusFilter">'
            + '<option value="all"' + (state.statusFilter === 'all' ? ' selected' : '') + '>كل الحالات</option>'
            + '<option value="pending"' + (state.statusFilter === 'pending' ? ' selected' : '') + '>بانتظار الرد</option>'
            + '<option value="open"' + (state.statusFilter === 'open' ? ' selected' : '') + '>تحت المتابعة</option>'
            + '<option value="closed"' + (state.statusFilter === 'closed' ? ' selected' : '') + '>مغلقة</option>'
            + '</select></div>';
        html += '<div class="admin-chat-grid">'
            + buildConversationPanel(selectedConversation)
            + '<div class="admin-panel admin-chat-sidebar"><div class="panel-header"><h2><i class="fas fa-list"></i> قائمة المحادثات</h2></div><div class="panel-body"><div class="admin-chat-list">'
            + buildConversationList(filteredConversations)
            + '</div></div></div></div>';

        A.adminContent.innerHTML = html;
        bindEvents();

        var chatBox = document.getElementById('chatMessages');
        if (chatBox) {
            chatBox.scrollTop = chatBox.scrollHeight;
        }
    }

    /**
     * Opens one conversation and marks customer messages as seen.
     *
     * @param {string} conversationId
     * @returns {Promise<void>}
     */
    async function openConversation(conversationId) {
        state.selectedConversationId = String(conversationId || '').trim();

        try {
            await loadMessages(state.selectedConversationId);
            await markCustomerMessagesAsRead(state.selectedConversationId);
            renderWorkspace();
        } catch (error) {
            A.showErrorToast('CHT-102', error?.message || 'تعذر فتح المحادثة.');
        }
    }

    /**
     * Sends an admin reply to the current conversation.
     *
     * @returns {Promise<void>}
     */
    async function sendReply() {
        var conversation = getSelectedConversation();
        var input = document.getElementById('chatReplyInput');
        var body = Helpers.normalizeAdminChatText(input?.value);
        var authUser = await TZ.getSupabaseUser();

        if (!conversation) {
            A.showErrorToast('CHT-201', 'اختر محادثة أولًا قبل إرسال الرد.');
            return;
        }

        if (!authUser) {
            A.showErrorToast('CHT-202', 'يجب تسجيل دخول الأدمن قبل إرسال الرد.');
            return;
        }

        if (!body) {
            A.showErrorToast('CHT-203', 'اكتب نص الرد أولًا.');
            return;
        }

        if (body.length > MAX_REPLY_LENGTH) {
            A.showErrorToast('CHT-204', 'نص الرد طويل جدًا.');
            return;
        }

        var messageResult = await TZ.supabase.from('support_chat_messages').insert([{
            conversation_id: conversation.id,
            sender_user_id: authUser.id,
            sender_role: 'admin',
            sender_name: A.currentUser?.fullName || 'الإدارة',
            body: body,
            is_read_by_admin: true,
            is_read_by_customer: false
        }]).select('*').single();

        if (messageResult.error) {
            A.showErrorToast('CHT-301', 'تعذر إرسال الرد الحالي.');
            return;
        }

        var updatePayload = Helpers.buildAdminConversationUpdate(body);
        updatePayload.assigned_admin_id = authUser.id;

        var conversationResult = await TZ.supabase.from('support_conversations').update(updatePayload)
            .eq('id', conversation.id)
            .select('*')
            .single();

        if (conversationResult.error) {
            A.showToast('تم إرسال الرد لكن تعذر تحديث آخر نشاط المحادثة.');
        }

        var notificationPayload = Helpers.buildAdminReplyNotification(conversation, body);
        if (notificationPayload) {
            var notificationResult = await TZ.supabase.from('notifications').insert([notificationPayload]);
            if (notificationResult.error) {
                A.showToast('تم إرسال الرد لكن تعذر إرسال إشعار للعميل.');
            }
        }

        if (input) {
            input.value = '';
        }

        A.showToast('تم إرسال الرد بنجاح.');
        await hydrateChats('جاري تحديث المحادثة...');
    }

    /**
     * Updates the conversation status after admin confirmation when needed.
     *
     * @param {string} conversationId
     * @param {'open'|'closed'} status
     * @returns {Promise<void>}
     */
    async function updateConversationStatus(conversationId, status) {
        var actionLabel = status === 'closed' ? 'إغلاق' : 'إعادة فتح';
        var shouldContinue = true;

        if (status === 'closed') {
            shouldContinue = await A.showConfirmModal({
                title: 'إغلاق المحادثة',
                message: 'سيتم إغلاق المحادثة الحالية ويمكنك إعادة فتحها لاحقًا من نفس القسم.',
                confirmText: 'إغلاق',
                cancelText: 'إلغاء',
                type: 'warning'
            });
        }

        if (!shouldContinue) {
            return;
        }

        var result = await TZ.supabase.from('support_conversations').update({
            status: status,
            updated_at: new Date().toISOString()
        }).eq('id', conversationId);

        if (result.error) {
            A.showErrorToast('CHT-302', 'تعذر ' + actionLabel + ' المحادثة.');
            return;
        }

        A.showToast('تم ' + actionLabel + ' المحادثة بنجاح.');
        await hydrateChats('جاري تحديث الحالة...');
    }

    /**
     * Entry point used by the admin shell for both chat sections.
     *
     * @returns {void}
     */
    function renderChats() {
        void hydrateChats('جاري تحميل الدردشات...');
    }

    A.sections.chats = renderChats;
    A.sections['support-chats'] = renderChats;
})();
