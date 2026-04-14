// ===== TechZone Admin - Session Guard =====
(function () {
    'use strict';

    const helpers = window.AdminSessionGuardHelpers;
    const ACTIVITY_EVENTS = ['click', 'keydown', 'mousedown', 'pointerdown', 'scroll', 'touchstart'];
    const CHECK_INTERVAL_MS = 30000;
    const TIMEOUT_MS = 30 * 60 * 1000;
    const WARNING_WINDOW_MS = 5 * 60 * 1000;
    const state = { intervalId: null, lastActivityAt: Date.now(), warningShown: false };

    if (!helpers) return;

    function isAdminVisible() {
        const adminLayout = document.getElementById('adminLayout');
        return adminLayout && adminLayout.style.display !== 'none' && !!window.AdminApp?.currentUser;
    }

    function refreshActivity() {
        state.lastActivityAt = Date.now();
        state.warningShown = false;
    }

    function startMonitoring() {
        if (state.intervalId) return;
        state.intervalId = window.setInterval(checkIdleState, CHECK_INTERVAL_MS);
        ACTIVITY_EVENTS.forEach((eventName) => {
            window.addEventListener(eventName, refreshActivity, { passive: true });
        });
    }

    function stopMonitoring() {
        if (state.intervalId) {
            window.clearInterval(state.intervalId);
            state.intervalId = null;
        }
    }

    async function showWarningModal() {
        state.warningShown = true;
        const confirmed = await window.AdminApp.showConfirmModal({
            type: 'warning',
            title: 'ستنتهي الجلسة قريبًا',
            message: 'ستنتهي جلسة الأدمن خلال أقل من 5 دقائق بسبب عدم وجود نشاط. هل تريد تمديد الجلسة؟',
            confirmText: 'تمديد الجلسة',
            cancelText: 'تسجيل الخروج'
        });

        if (confirmed) {
            refreshActivity();
            const session = TZ.getSession();
            if (session) {
                TZ.setSession(session.userId, session.role, session.name);
            }
            return;
        }

        document.getElementById('logoutBtn')?.click();
    }

    function checkIdleState() {
        if (!isAdminVisible()) return;
        const guardState = helpers.getSessionGuardState({
            now: Date.now(),
            lastActivityAt: state.lastActivityAt,
            timeoutMs: TIMEOUT_MS,
            warningWindowMs: WARNING_WINDOW_MS
        });

        if (guardState.isExpired) {
            document.getElementById('logoutBtn')?.click();
            return;
        }

        if (guardState.isWarning && !state.warningShown) {
            void showWarningModal();
        }
    }

    window.addEventListener('tz-admin-bootstrap-ready', startMonitoring);
    document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') {
            checkIdleState();
        }
    });
    window.addEventListener('beforeunload', stopMonitoring);
})();
