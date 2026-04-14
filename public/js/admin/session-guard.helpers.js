// ===== TechZone Admin - Session Guard Helpers =====
(function () {
    'use strict';

    function getSessionGuardState(input) {
        const now = Number(input?.now || 0);
        const lastActivityAt = Number(input?.lastActivityAt || 0);
        const timeoutMs = Number(input?.timeoutMs || 0);
        const warningWindowMs = Number(input?.warningWindowMs || 0);
        const idleMs = Math.max(0, now - lastActivityAt);
        const remainingMs = Math.max(0, timeoutMs - idleMs);

        return {
            idleMs: idleMs,
            isExpired: remainingMs === 0,
            isWarning: remainingMs > 0 && remainingMs <= warningWindowMs,
            remainingMs: remainingMs
        };
    }

    window.AdminSessionGuardHelpers = {
        getSessionGuardState: getSessionGuardState
    };

    if (window.__ENABLE_ADMIN_SESSION_GUARD_TEST_HOOKS__) {
        window.__adminSessionGuardTestHooks = window.AdminSessionGuardHelpers;
    }
})();
