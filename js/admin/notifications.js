// ===== TechZone Admin - User Notifications =====
(function () {
    'use strict';

    const A = window.AdminApp;
    const LOCAL_HISTORY_KEY = 'tz_admin_notification_history';

    function getCustomers() {
        return TZ.db.users
            .filter((user) => TZ.isCustomerUser(user))
            .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }

    function loadLocalHistory() {
        try {
            return JSON.parse(localStorage.getItem(LOCAL_HISTORY_KEY) || '[]');
        } catch (error) {
            return [];
        }
    }

    function saveLocalHistory(history) {
        localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(history.slice(0, 12)));
    }

    async function getAccessToken() {
        const { data } = await TZ.supabase.auth.getSession();
        return data?.session?.access_token || '';
    }

    function scopeLabel(value) {
        const labels = {
            all_customers: 'كل العملاء',
            active_customers: 'العملاء النشطون',
            specific_user: 'مستخدم محدد',
        };
        return labels[value] || value;
    }

    function renderNotifications() {
        const customers = getCustomers();
        const history = loadLocalHistory();

        A.adminContent.innerHTML = `
            <div class="admin-panel" style="margin-bottom:18px;">
                <div class="panel-header">
                    <h2><i class="fas fa-bell"></i> إرسال إشعارات للمستخدمين</h2>
                </div>
                <div class="panel-body padded" style="display:grid;gap:16px;">
                    <div style="padding:14px;border:1px solid var(--border-color);border-radius:14px;background:var(--bg-lighter);display:grid;gap:8px;">
                        <strong>كيف يعمل هذا القسم؟</strong>
                        <div style="color:var(--text-muted);font-size:.92rem;">يمكنك إرسال إشعار لمستخدم واحد أو لجميع العملاء. سيظهر الإشعار للمستخدم داخل لوحة الحساب في قسم الإشعارات.</div>
                    </div>

                    <form class="admin-form" id="notificationForm">
                        <div class="form-grid">
                            <div class="admin-form-group">
                                <label>النطاق *</label>
                                <select id="notificationScope" required>
                                    <option value="all_customers">كل العملاء</option>
                                    <option value="active_customers">العملاء النشطون فقط</option>
                                    <option value="specific_user">مستخدم محدد</option>
                                </select>
                            </div>
                            <div class="admin-form-group" id="notificationUserWrap" style="display:none;">
                                <label>اختر المستخدم *</label>
                                <select id="notificationUserId">
                                    <option value="">اختر مستخدماً</option>
                                    ${customers.map((customer) => `
                                        <option value="${customer.authUserId || customer.id}">
                                            ${TZ.escapeHtml(customer.fullName)}${customer.phone ? ` - ${TZ.escapeHtml(customer.phone)}` : ''}
                                        </option>
                                    `).join('')}
                                </select>
                            </div>
                            <div class="admin-form-group">
                                <label>نوع الإشعار</label>
                                <select id="notificationType">
                                    <option value="info">معلومة</option>
                                    <option value="success">نجاح</option>
                                    <option value="warning">تنبيه</option>
                                    <option value="error">مهم</option>
                                </select>
                            </div>
                            <div class="admin-form-group full">
                                <label>العنوان *</label>
                                <div class="admin-input-wrap"><i class="fas fa-heading"></i><input type="text" id="notificationTitle" required maxlength="120"></div>
                            </div>
                            <div class="admin-form-group full">
                                <label>نص الإشعار *</label>
                                <textarea id="notificationBody" rows="4" required maxlength="500" placeholder="اكتب الرسالة التي ستصل للمستخدمين"></textarea>
                            </div>
                        </div>
                        <div style="display:flex;gap:10px;flex-wrap:wrap;">
                            <button type="submit" class="btn btn-primary" id="sendNotificationBtn"><i class="fas fa-paper-plane"></i> إرسال الإشعار</button>
                            <button type="button" class="btn btn-outline" id="fillNotificationExampleBtn">تعبئة مثال</button>
                        </div>
                    </form>
                </div>
            </div>

            <div class="admin-panel">
                <div class="panel-header">
                    <h2><i class="fas fa-clock-rotate-left"></i> آخر عمليات الإرسال من هذا المتصفح</h2>
                </div>
                <div class="panel-body">
                    ${history.length === 0 ? `
                        <div class="empty-state" style="padding:24px;">
                            <i class="fas fa-paper-plane"></i>
                            <p>لم يتم إرسال إشعارات من هذه الجلسة بعد.</p>
                        </div>
                    ` : `
                        <div class="table-wrap">
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>العنوان</th>
                                        <th>النطاق</th>
                                        <th>المستلمين</th>
                                        <th>النوع</th>
                                        <th>وقت الإرسال</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${history.map((entry) => `
                                        <tr>
                                            <td><strong>${TZ.escapeHtml(entry.title)}</strong><br><small style="color:var(--text-muted)">${TZ.escapeHtml(entry.body)}</small></td>
                                            <td>${TZ.escapeHtml(scopeLabel(entry.scope))}</td>
                                            <td>${entry.count}</td>
                                            <td><span class="status-badge ${TZ.escapeHtml(entry.type)}">${TZ.escapeHtml(entry.type)}</span></td>
                                            <td>${new Date(entry.createdAt).toLocaleString('ar-JO')}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    `}
                </div>
            </div>
        `;

        bindNotificationEvents(customers, history);
    }

    function bindNotificationEvents(customers, history) {
        const scopeInput = document.getElementById('notificationScope');
        const userWrap = document.getElementById('notificationUserWrap');
        const userInput = document.getElementById('notificationUserId');
        const submitButton = document.getElementById('sendNotificationBtn');

        function syncScope() {
            const specific = scopeInput.value === 'specific_user';
            userWrap.style.display = specific ? '' : 'none';
            userInput.required = specific;
            if (!specific) userInput.value = '';
        }

        syncScope();
        scopeInput.addEventListener('change', syncScope);

        document.getElementById('fillNotificationExampleBtn').addEventListener('click', function () {
            document.getElementById('notificationTitle').value = 'تم تحديث حالة الطلب';
            document.getElementById('notificationBody').value = 'يمكنك الآن مراجعة آخر تحديثات طلبك من داخل لوحة الحساب.';
            document.getElementById('notificationType').value = 'info';
        });

        document.getElementById('notificationForm').addEventListener('submit', async function (event) {
            event.preventDefault();

            const scope = scopeInput.value;
            const title = document.getElementById('notificationTitle').value.trim();
            const body = document.getElementById('notificationBody').value.trim();
            const type = document.getElementById('notificationType').value;

            if (!title || !body) {
                A.showToast('يرجى إدخال عنوان ونص الإشعار.');
                return;
            }

            if (scope === 'specific_user' && !userInput.value) {
                A.showToast('اختر المستخدم الذي تريد إرسال الإشعار له.');
                return;
            }

            const accessToken = await getAccessToken();
            if (!accessToken) {
                A.showToast('انتهت جلسة المدير. يرجى تسجيل الدخول مرة أخرى.');
                return;
            }

            submitButton.disabled = true;
            submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الإرسال...';

            const response = await fetch('/api/admin/notifications', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({
                    scope,
                    title,
                    body,
                    type,
                    userId: userInput.value || null,
                }),
            });
            const result = await response.json().catch(() => ({}));

            submitButton.disabled = false;
            submitButton.innerHTML = '<i class="fas fa-paper-plane"></i> إرسال الإشعار';

            if (!response.ok || !result?.success) {
                A.showToast(result?.error || 'تعذر إرسال الإشعارات حالياً.');
                return;
            }

            history.unshift({
                id: TZ.generateId('notify-log-'),
                title,
                body,
                scope,
                type,
                count: Number(result.count || 0),
                createdAt: TZ.nowIso(),
            });
            saveLocalHistory(history);

            TZ.commitDb('notifications_broadcast', TZ.getSession()?.userId, `${title} (${Number(result.count || 0)})`);
            A.showToast(`تم إرسال الإشعار إلى ${Number(result.count || 0)} مستخدم.`);
            renderNotifications();
        });
    }

    A.sections.notifications = renderNotifications;
})();
