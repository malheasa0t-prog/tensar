// ===== TechZone Admin - Messages =====
(function () {
    'use strict';
    const A = window.AdminApp;

    // ===== CONTACT MESSAGES =====
    function renderMessages() {
        const msgs = TZ.clone(TZ.db.contactMessages).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        A.adminContent.innerHTML = `
            <div class="admin-panel">
                <div class="panel-header"><h2><i class="fas fa-envelope"></i> رسائل التواصل (${msgs.length})</h2></div>
                <div class="panel-body">
                    ${msgs.length === 0 ? '<div class="empty-state"><i class="fas fa-inbox"></i><p>لا توجد رسائل</p></div>' : `
                    <div class="table-wrap">
                    <table class="data-table">
                        <thead><tr><th>الاسم</th><th>البريد</th><th>الجوال</th><th>الخدمة</th><th>الرسالة</th><th>الحالة</th><th>التاريخ</th><th>إجراءات</th></tr></thead>
                        <tbody>
                            ${msgs.map(m => `<tr>
                                <td><strong>${TZ.escapeHtml(m.name)}</strong></td>
                                <td>${TZ.escapeHtml(m.email || '-')}</td>
                                <td dir="ltr">${TZ.escapeHtml(m.phone || '-')}</td>
                                <td>${TZ.escapeHtml(m.serviceType || '-')}</td>
                                <td title="${TZ.escapeHtml(m.message || '')}">${TZ.escapeHtml((m.message || '').substring(0, 50))}${(m.message || '').length > 50 ? '...' : ''}</td>
                                <td><span class="status-badge ${m.status === 'new' ? 'pending' : 'active'}">${m.status === 'new' ? 'جديد' : 'مقروء'}</span></td>
                                <td>${A.formatDate(m.createdAt)}</td>
                                <td class="actions-cell">
                                    ${m.status === 'new' ? `<button class="action-btn success btn-mark-read" data-id="${m.id}" title="تعليم كمقروء"><i class="fas fa-check"></i></button>` : ''}
                                </td>
                            </tr>`).join('')}
                        </tbody>
                    </table>
                    </div>`}
                </div>
            </div>
        `;

        document.querySelectorAll('.btn-mark-read').forEach(btn => {
            btn.addEventListener('click', function () {
                const msg = TZ.db.contactMessages.find(m => m.id === this.dataset.id);
                if (msg) {
                    msg.status = 'read';
                    TZ.commitDb('message_read', TZ.getSession()?.userId, msg.name, { type: 'contact_message', data: msg });
                    renderMessages();
                    A.showToast('تم تعليم الرسالة كمقروءة');
                }
            });
        });
    }

    A.sections.messages = renderMessages;
})();
