// ===== TechZone Admin - Notifications =====
(function () {
    'use strict';

    const A = window.AdminApp;
    const H = window.AdminNotificationHelpers;

    if (!A || !H) return;

    /**
     * Checks whether the current session can manage notifications.
     *
     * @returns {boolean}
     */
    function canManageNotifications() {
        const session = typeof TZ !== 'undefined' && typeof TZ.getSession === 'function' ? TZ.getSession() : null;
        const sessionUser = session ? { role: session.role, status: 'active' } : null;

        return Boolean(sessionUser) && typeof TZ.canAccessSection === 'function'
            ? TZ.canAccessSection(sessionUser, 'notifications')
            : true;
    }

    /**
     * Updates buttons, helper text, and the recipient field visibility.
     *
     * @param {{hiddenAudience:HTMLInputElement,toggleButtons:NodeListOf<Element>,recipientField:HTMLElement,recipientSelect:HTMLSelectElement,hint:HTMLElement,recipients:Array<Record<string, unknown>>,isLocked:boolean}} input
     * @returns {void}
     */
    function updateAudienceState(input) {
        const audience = input.hiddenAudience.value === H.AUDIENCE_SINGLE ? H.AUDIENCE_SINGLE : H.AUDIENCE_ALL;
        const isSingle = audience === H.AUDIENCE_SINGLE;
        const selectedUser = input.recipients.find(function (user) {
            return String(user.id) === String(input.recipientSelect.value || '');
        }) || null;

        input.toggleButtons.forEach(function (button) {
            button.classList.toggle('active', button.dataset.audience === audience);
        });
        input.recipientField.hidden = !isSingle;
        input.recipientSelect.disabled = !isSingle || input.isLocked;
        if (!isSingle) {
            input.recipientSelect.value = '';
        }
        input.hint.textContent = H.getAudienceHint({
            audience: audience,
            selectedUser: selectedUser,
            totalRecipients: input.recipients.length
        });
    }

    /**
     * Sends the notification rows to Supabase and handles the form state.
     *
     * @param {{form:HTMLFormElement,submitButton:HTMLButtonElement,hiddenAudience:HTMLInputElement,recipientSelect:HTMLSelectElement,typeSelect:HTMLSelectElement,titleInput:HTMLInputElement,bodyInput:HTMLTextAreaElement,recipients:Array<Record<string, unknown>>}} input
     * @returns {Promise<void>}
     */
    async function submitNotificationForm(input) {
        const audience = input.hiddenAudience.value === H.AUDIENCE_SINGLE ? H.AUDIENCE_SINGLE : H.AUDIENCE_ALL;
        const selectedRecipients = H.collectSelectedRecipients(input.recipients, audience, input.recipientSelect.value);
        const originalLabel = input.submitButton.innerHTML;
        let rows = [];

        try {
            rows = H.buildNotificationRows({
                audience: audience,
                title: input.titleInput.value,
                body: input.bodyInput.value,
                type: input.typeSelect.value,
                recipients: selectedRecipients
            });
        } catch (error) {
            A.showToast(error.message || 'تعذر تجهيز الإشعار.');
            return;
        }

        input.submitButton.disabled = true;
        input.submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الإرسال...';

        try {
            for (const batch of H.buildInsertBatches(rows)) {
                const result = await TZ.supabase.from('notifications').insert(batch);

                if (result.error) {
                    throw new Error(result.error.message || 'تعذر إرسال الإشعارات حالياً.');
                }
            }

            TZ.commitDb(
                'admin_notification_send',
                TZ.getSession()?.userId,
                audience === H.AUDIENCE_ALL
                    ? 'إرسال إشعار جماعي إلى ' + rows.length + ' مستخدم'
                    : 'إرسال إشعار إلى ' + (selectedRecipients[0]?.fullName || selectedRecipients[0]?.id || 'مستخدم')
            );
            input.form.reset();
            input.hiddenAudience.value = audience;
            A.showToast(audience === H.AUDIENCE_ALL ? 'تم إرسال ' + rows.length + ' إشعاراً بنجاح.' : 'تم إرسال الإشعار بنجاح.');
        } catch (error) {
            A.showToast(error.message || 'تعذر إرسال الإشعار حالياً.');
        } finally {
            input.submitButton.disabled = false;
            input.submitButton.innerHTML = originalLabel;
        }
    }

    /**
     * Binds the notifications form interactions after rendering.
     *
     * @param {Array<Record<string, unknown>>} recipients
     * @param {boolean} isLocked
     * @returns {void}
     */
    function bindNotificationEvents(recipients, isLocked) {
        const form = document.getElementById('adminNotificationForm');
        if (!form || isLocked) return;

        const hiddenAudience = document.getElementById('notificationAudience');
        const recipientField = document.getElementById('notificationRecipientField');
        const recipientSelect = document.getElementById('notificationRecipient');
        const hint = document.getElementById('notificationAudienceHint');
        const typeSelect = document.getElementById('notificationType');
        const titleInput = document.getElementById('notificationTitle');
        const bodyInput = document.getElementById('notificationBody');
        const submitButton = document.getElementById('notificationSubmitBtn');
        const toggleButtons = document.querySelectorAll('.admin-segment-btn');
        const audienceStateInput = {
            hiddenAudience: hiddenAudience,
            toggleButtons: toggleButtons,
            recipientField: recipientField,
            recipientSelect: recipientSelect,
            hint: hint,
            recipients: recipients,
            isLocked: isLocked
        };

        toggleButtons.forEach(function (button) {
            button.addEventListener('click', function () {
                hiddenAudience.value = button.dataset.audience === H.AUDIENCE_SINGLE ? H.AUDIENCE_SINGLE : H.AUDIENCE_ALL;
                updateAudienceState(audienceStateInput);
            });
        });
        recipientSelect.addEventListener('change', function () {
            updateAudienceState(audienceStateInput);
        });
        form.addEventListener('submit', async function (event) {
            event.preventDefault();
            await submitNotificationForm({
                form: form,
                submitButton: submitButton,
                hiddenAudience: hiddenAudience,
                recipientSelect: recipientSelect,
                typeSelect: typeSelect,
                titleInput: titleInput,
                bodyInput: bodyInput,
                recipients: recipients
            });
            updateAudienceState(audienceStateInput);
        });

        updateAudienceState(audienceStateInput);
    }

    /**
     * Applies a pending notification prefill from other admin sections.
     *
     * @param {Array<Record<string, unknown>>} recipients
     * @returns {void}
     */
    function applyNotificationPrefill(recipients) {
        const prefill = window.__TZ_ADMIN_NOTIFICATION_PREFILL;
        if (!prefill) return;

        const hiddenAudience = document.getElementById('notificationAudience');
        const recipientSelect = document.getElementById('notificationRecipient');
        const titleInput = document.getElementById('notificationTitle');
        const recipientField = document.getElementById('notificationRecipientField');
        const toggleButtons = document.querySelectorAll('.admin-segment-btn');
        const targetUser = recipients.find(function (user) {
            return String(user.id) === String(prefill.userId || '');
        });

        if (!hiddenAudience || !recipientSelect || !titleInput || !targetUser) {
            window.__TZ_ADMIN_NOTIFICATION_PREFILL = null;
            return;
        }

        hiddenAudience.value = H.AUDIENCE_SINGLE;
        recipientSelect.value = String(targetUser.id);
        titleInput.value = String(prefill.title || titleInput.value || '');
        recipientField.hidden = false;
        toggleButtons.forEach(function (button) {
            button.classList.toggle('active', button.dataset.audience === H.AUDIENCE_SINGLE);
        });
        recipientSelect.dispatchEvent(new Event('change'));
        window.__TZ_ADMIN_NOTIFICATION_PREFILL = null;
    }

    /**
     * Renders the admin notifications section shell.
     *
     * @returns {void}
     */
    function renderNotifications() {
        if (!canManageNotifications()) {
            A.adminContent.innerHTML = '<div class="status-box warning">لا تملك صلاحية الوصول إلى قسم إشعارات المستخدمين.</div>';
            return;
        }

        const recipients = H.getCustomerRecipients(TZ.db.users);
        const isLocked = !TZ.legacyWriteEnabled || recipients.length === 0;
        const notesMarkup = H.NOTE_ITEMS.map(function (item) {
            return '<li><strong>' + item[0] + '</strong>' + item[1] + '</li>';
        }).join('');

        A.adminContent.innerHTML = ''
            + '<div class="admin-notifications-grid">'
            + '  <section class="admin-panel admin-notification-panel">'
            + '      <div class="panel-header"><h2><i class="fas fa-paper-plane"></i> إرسال رسالة</h2></div>'
            + '      <div class="panel-body padded">'
            + '          <div class="admin-notification-inline"><i class="fas fa-bell"></i><span>الإرسال يتم عبر نظام الإشعارات داخل الموقع</span></div>'
            + (TZ.legacyWriteEnabled ? '' : '<div class="status-box warning">لوحة الأدمن القديمة تعمل حالياً بوضع القراءة فقط، لذلك تم تعطيل الإرسال المباشر من هذا القسم.</div>')
            + (recipients.length > 0 ? '' : '<div class="status-box warning">لا يوجد حالياً مستخدمون نشطون يمكن إرسال إشعارات لهم.</div>')
            + '          <form class="admin-form admin-notification-form" id="adminNotificationForm">'
            + '              <input type="hidden" id="notificationAudience" value="' + H.AUDIENCE_ALL + '">'
            + '              <div class="admin-segmented" role="tablist" aria-label="الجمهور المستهدف">'
            + '                  <button type="button" class="admin-segment-btn active" data-audience="' + H.AUDIENCE_ALL + '">أرسل للجميع</button>'
            + '                  <button type="button" class="admin-segment-btn" data-audience="' + H.AUDIENCE_SINGLE + '">أرسل لمستخدم محدد</button>'
            + '              </div>'
            + '              <div class="form-grid">'
            + '                  <div class="admin-form-group"><label for="notificationType">نوع الرسالة</label><select id="notificationType"' + (isLocked ? ' disabled' : '') + '><option value="info">رسالة عادية</option><option value="success">رسالة نجاح</option><option value="warning">تنبيه</option><option value="error">تنبيه مهم</option></select></div>'
            + '                  <div class="admin-form-group"><label for="notificationTitle">عنوان الرسالة</label><div class="admin-input-wrap"><i class="fas fa-heading"></i><input type="text" id="notificationTitle" maxlength="' + H.TITLE_MAX_LENGTH + '" placeholder="رسالة من الإدارة" required' + (isLocked ? ' disabled' : '') + '></div></div>'
            + '                  <div class="admin-form-group full admin-notification-user-field" id="notificationRecipientField" hidden><label for="notificationRecipient">المستخدم المستهدف</label><select id="notificationRecipient" disabled>' + H.buildUserOptions(recipients) + '</select></div>'
            + '                  <div class="admin-form-group full"><label for="notificationBody">محتوى الرسالة</label><textarea id="notificationBody" rows="7" maxlength="' + H.BODY_MAX_LENGTH + '" placeholder="اكتب الرسالة التي تريد إيصالها للمستخدمين" required' + (isLocked ? ' disabled' : '') + '></textarea></div>'
            + '              </div>'
            + '              <div class="admin-notification-footnote" id="notificationAudienceHint">' + H.getAudienceHint({ audience: H.AUDIENCE_ALL, totalRecipients: recipients.length }) + '</div>'
            + '              <div class="admin-form-actions"><button type="submit" class="btn btn-primary" id="notificationSubmitBtn"' + (isLocked ? ' disabled' : '') + '><i class="fas fa-paper-plane"></i> إرسال الرسالة</button></div>'
            + '          </form>'
            + '      </div>'
            + '  </section>'
            + '  <aside class="admin-panel admin-notes-panel">'
            + '      <div class="panel-header"><h2><i class="fas fa-clipboard-list"></i> ملاحظات</h2></div>'
            + '      <div class="panel-body padded"><ul class="admin-notes-list">' + notesMarkup + '</ul></div>'
            + '  </aside>'
            + '</div>';

        bindNotificationEvents(recipients, isLocked);
        applyNotificationPrefill(recipients);
    }

    A.sections.notifications = renderNotifications;
})();
