/**
 * TechZone Admin — Contact Messages Section (Rebuilt)
 *
 * Displays contact messages and updates status via Supabase.
 * Uses mapper names: id, name, email, phone, serviceType, message, status, createdAt.
 */
(function () {
    'use strict';

    var A = window.AdminApp;
    if (!A) return;

    function esc(v) { return TZ.escapeHtml(v == null ? '' : String(v)); }

    var STATUS_MAP = { new: 'جديدة', open: 'مفتوحة', replied: 'تم الرد', closed: 'مغلقة', archived: 'مؤرشفة' };

    async function updateStatus(id, status) {
        var result = await TZ.supabase.from('contact_messages').update({
            status: status, updated_at: new Date().toISOString()
        }).eq('id', id);
        if (result.error) { A.showToast('فشل تحديث حالة الرسالة'); return; }
        A.showToast('تم تحديث الحالة');
        await TZ.refreshData();
        renderMessages();
    }

    function renderMessages() {
        var messages = TZ.db.contactMessages || [];
        messages.sort(function (a, b) { return new Date(b.createdAt || 0) - new Date(a.createdAt || 0); });

        var html = '<div class="admin-section-header"><div><h2><i class="fas fa-envelope"></i> رسائل التواصل</h2><p>' + messages.length + ' رسالة</p></div></div>';

        html += '<div class="admin-panel"><div class="panel-body"><div class="table-wrap"><table class="data-table"><thead><tr>'
            + '<th>المرسل</th><th>نوع الخدمة</th><th>الرسالة</th><th>الحالة</th><th>التاريخ</th><th>إجراءات</th></tr></thead><tbody>';

        if (messages.length === 0) {
            html += '<tr><td colspan="6"><div class="empty-state"><i class="fas fa-envelope-open-text"></i><p>لا توجد رسائل</p></div></td></tr>';
        } else {
            messages.forEach(function (m) {
                var contact = esc(m.name || '-') + (m.email ? '<br><small style="color:var(--text-muted);">' + esc(m.email) + '</small>' : '');
                var statusClass = m.status === 'new' ? 'pending' : (m.status === 'replied' ? 'completed' : m.status);
                html += '<tr>'
                    + '<td>' + contact + '</td>'
                    + '<td>' + esc(m.serviceType || '-') + '</td>'
                    + '<td><small>' + esc((m.message || '').substring(0, 80)) + (m.message && m.message.length > 80 ? '...' : '') + '</small></td>'
                    + '<td><span class="status-badge ' + statusClass + '">' + (STATUS_MAP[m.status] || m.status || 'جديدة') + '</span></td>'
                    + '<td><small>' + A.formatDate(m.createdAt) + '</small></td>'
                    + '<td class="actions-cell">'
                    + '<select class="msg-status-sel" data-id="' + m.id + '" style="min-height:32px;padding:4px 8px;border-radius:8px;font-size:0.78rem;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.04);color:var(--text-primary);">';
                Object.keys(STATUS_MAP).forEach(function (s) {
                    html += '<option value="' + s + '"' + (m.status === s ? ' selected' : '') + '>' + STATUS_MAP[s] + '</option>';
                });
                html += '</select></td></tr>';
            });
        }
        html += '</tbody></table></div></div></div>';

        A.adminContent.innerHTML = html;

        document.querySelectorAll('.msg-status-sel').forEach(function (sel) {
            var orig = sel.value;
            sel.addEventListener('change', function () {
                if (sel.value !== orig) updateStatus(sel.dataset.id, sel.value);
            });
        });
    }

    A.sections.messages = renderMessages;
    A.sections['contact-messages'] = renderMessages;
})();
