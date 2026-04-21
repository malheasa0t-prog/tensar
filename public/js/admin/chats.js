/**
 * TechZone Admin — Chats Section (Rebuilt)
 *
 * Support chat management with conversation list and message view.
 * Loads data directly from Supabase since support tables aren't in TZ.db.
 */
(function () {
    'use strict';

    var A = window.AdminApp;
    if (!A) return;

    var selectedConversation = null;
    var cachedConversations = [];
    var cachedMessages = [];

    function esc(v) { return TZ.escapeHtml(v == null ? '' : String(v)); }

    /** Load conversations from Supabase directly */
    async function loadConversations() {
        var result = await TZ.supabase.from('support_conversations')
            .select('*')
            .order('updated_at', { ascending: false });
        cachedConversations = (result.data || []);
        return cachedConversations;
    }

    /** Load messages for a specific conversation */
    async function loadMessages(conversationId) {
        var result = await TZ.supabase.from('support_chat_messages')
            .select('*')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true });
        cachedMessages = (result.data || []);
        return cachedMessages;
    }

    async function sendReply(conversationId, body) {
        var authUser = await TZ.getSupabaseUser();
        if (!authUser) { A.showToast('يجب تسجيل الدخول'); return; }

        var result = await TZ.supabase.from('support_chat_messages').insert([{
            conversation_id: conversationId,
            sender_user_id: authUser.id,
            sender_role: 'admin',
            sender_name: 'الإدارة',
            body: body,
            is_read_by_admin: true
        }]);

        if (result.error) { A.showToast('فشل إرسال الرد'); return; }

        await TZ.supabase.from('support_conversations').update({
            last_message_preview: body.substring(0, 100),
            last_message_at: new Date().toISOString(),
            last_message_sender_role: 'admin',
            updated_at: new Date().toISOString()
        }).eq('id', conversationId);

        A.showToast('تم إرسال الرد');
        renderChats();
    }

    async function closeConversation(id) {
        await TZ.supabase.from('support_conversations').update({
            status: 'closed', updated_at: new Date().toISOString()
        }).eq('id', id);
        A.showToast('تم إغلاق المحادثة');
        selectedConversation = null;
        renderChats();
    }

    async function renderChats() {
        if (selectedConversation) {
            await renderConversationDetail(selectedConversation);
            return;
        }

        A.adminContent.innerHTML = '<div class="admin-section-header"><div><h2><i class="fas fa-comments"></i> المحادثات</h2></div></div>'
            + '<div class="admin-panel"><div class="panel-body"><div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>جاري التحميل...</p></div></div></div>';

        var conversations = await loadConversations();

        var html = '<div class="admin-section-header"><div><h2><i class="fas fa-comments"></i> المحادثات</h2><p>' + conversations.length + ' محادثة</p></div></div>';

        html += '<div class="admin-panel"><div class="panel-body"><div class="table-wrap"><table class="data-table"><thead><tr>'
            + '<th>العميل</th><th>الموضوع</th><th>آخر رسالة</th><th>الحالة</th><th>التاريخ</th><th>إجراءات</th></tr></thead><tbody>';

        if (conversations.length === 0) {
            html += '<tr><td colspan="6"><div class="empty-state"><i class="fas fa-comments"></i><p>لا توجد محادثات</p></div></td></tr>';
        } else {
            conversations.forEach(function (c) {
                var isOpen = c.status === 'open';
                html += '<tr>'
                    + '<td><strong>' + esc(c.customer_name || '-') + '</strong></td>'
                    + '<td>' + esc(c.subject || '-') + '</td>'
                    + '<td><small>' + esc((c.last_message_preview || '').substring(0, 50)) + '</small></td>'
                    + '<td><span class="status-badge ' + (isOpen ? 'active' : 'hidden') + '">' + (isOpen ? 'مفتوحة' : 'مغلقة') + '</span></td>'
                    + '<td><small>' + new Date(c.last_message_at || c.created_at).toLocaleDateString('ar-JO') + '</small></td>'
                    + '<td class="actions-cell">'
                    + '<button class="action-btn open-chat-btn" data-id="' + c.id + '"><i class="fas fa-eye"></i></button>'
                    + (isOpen ? '<button class="action-btn danger close-chat-btn" data-id="' + c.id + '"><i class="fas fa-times-circle"></i></button>' : '')
                    + '</td></tr>';
            });
        }
        html += '</tbody></table></div></div></div>';

        A.adminContent.innerHTML = html;

        document.querySelectorAll('.open-chat-btn').forEach(function (b) {
            b.addEventListener('click', function () {
                selectedConversation = b.dataset.id;
                renderChats();
            });
        });
        document.querySelectorAll('.close-chat-btn').forEach(function (b) {
            b.addEventListener('click', function () { closeConversation(b.dataset.id); });
        });
    }

    async function renderConversationDetail(convId) {
        A.adminContent.innerHTML = '<div class="admin-panel"><div class="panel-body"><div class="empty-state"><i class="fas fa-spinner fa-spin"></i><p>جاري تحميل الرسائل...</p></div></div></div>';

        var conv = cachedConversations.find(function (c) { return c.id === convId; });
        if (!conv) { selectedConversation = null; renderChats(); return; }

        var messages = await loadMessages(convId);

        var html = '<div class="admin-section-header"><div><h2><i class="fas fa-comments"></i> ' + esc(conv.customer_name || 'محادثة') + ' — ' + esc(conv.subject || '') + '</h2></div>'
            + '<div class="admin-section-actions"><button class="btn btn-outline btn-sm" id="backToChats"><i class="fas fa-arrow-right"></i> رجوع</button></div></div>';

        html += '<div class="admin-panel"><div class="panel-body padded" style="max-height:500px;overflow-y:auto;" id="chatMessages">';
        if (messages.length === 0) {
            html += '<div class="empty-state"><i class="fas fa-comment-slash"></i><p>لا توجد رسائل</p></div>';
        } else {
            messages.forEach(function (m) {
                var isAdmin = m.sender_role === 'admin';
                html += '<div style="display:flex;flex-direction:column;align-items:' + (isAdmin ? 'flex-start' : 'flex-end') + ';margin-bottom:12px;">'
                    + '<div style="max-width:75%;padding:12px 16px;border-radius:14px;background:' + (isAdmin ? 'rgba(var(--primary-rgb),0.12)' : 'rgba(255,255,255,0.06)') + ';border:1px solid rgba(255,255,255,0.05);">'
                    + '<small style="color:' + (isAdmin ? 'var(--primary-light)' : 'var(--text-muted)') + ';font-weight:600;">' + esc(m.sender_name || (isAdmin ? 'الإدارة' : 'العميل')) + '</small>'
                    + '<p style="margin:4px 0 0;font-size:0.9rem;">' + esc(m.body) + '</p>'
                    + '</div></div>';
            });
        }
        html += '</div></div>';

        if (conv.status === 'open') {
            html += '<div class="admin-panel"><div class="panel-body padded" style="display:flex;gap:10px;">'
                + '<input type="text" id="chatReplyInput" placeholder="اكتب ردك..." style="flex:1;">'
                + '<button class="btn btn-primary btn-sm" id="sendReplyBtn"><i class="fas fa-paper-plane"></i></button>'
                + '</div></div>';
        }

        A.adminContent.innerHTML = html;

        document.getElementById('backToChats')?.addEventListener('click', function () { selectedConversation = null; renderChats(); });
        document.getElementById('sendReplyBtn')?.addEventListener('click', function () {
            var input = document.getElementById('chatReplyInput');
            var body = (input.value || '').trim();
            if (!body) return;
            sendReply(convId, body);
        });
        document.getElementById('chatReplyInput')?.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') document.getElementById('sendReplyBtn')?.click();
        });

        var chatBox = document.getElementById('chatMessages');
        if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;
    }

    A.sections.chats = renderChats;
    A.sections['support-chats'] = renderChats;
})();
