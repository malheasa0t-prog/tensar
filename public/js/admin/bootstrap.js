// ===== TechZone Legacy Admin Bootstrap =====
// Loads the heavy data engine lazily, then hydrates the legacy admin bundles in order.
(function () {
    'use strict';

    const ADMIN_ASSET_VERSION = '20260417-1';
    const DATA_ENGINE_MODULE_PATH = `/js/admin/data-engine.js?v=${ADMIN_ASSET_VERSION}`;
    const ADMIN_SERVICE_WORKER_PATH = `/admin-sw.js?v=${ADMIN_ASSET_VERSION}`;
    const ADMIN_RUNTIME_ROUTE = '/api/admin/runtime';
    const ADMIN_SERVICE_WORKER_SCOPE = '/admin.html';
    const SCRIPT_LOAD_TIMEOUT_MS = 10000;
    const GLOBAL_POLL_INTERVAL_MS = 25;
    const SUPABASE_GLOBAL_KEY = 'supabase';
    const CHART_SCRIPT_URL = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js';
    const ADMIN_BOOTSTRAP_ERROR_TITLE = 'تعذر تشغيل لوحة الإدارة';
    const ADMIN_BOOTSTRAP_ERROR_DESCRIPTION = 'إعدادات تشغيل لوحة الإدارة غير مكتملة على بيئة الإنتاج حاليًا.';
    const BASE_SCRIPT_PATHS = [
        'js/admin/core.helpers.js',
        'js/admin/core.ui.js',
        'js/admin/core.js',
        'js/admin/global-search.helpers.js',
        'js/admin/global-search.js',
        'js/admin/admin-shell.helpers.js',
        'js/admin/admin-shell.js',
        'js/admin/session-guard.helpers.js',
        'js/admin/session-guard.js'
    ];
    const TABLE_SCRIPT_GROUP = [
        'js/admin/table-enhancements.helpers.js',
        'js/admin/table-enhancements.js'
    ];
    const BULK_ACTION_SCRIPT_GROUP = [
        'js/admin/bulk-actions.helpers.js',
        'js/admin/bulk-actions.js'
    ];
    const SECTION_SCRIPT_GROUPS = Object.freeze({
        dashboard: ['js/admin/dashboard.js'],
        orders: ['js/admin/orders.js'],
        'product-orders': ['js/admin/orders.js'],
        'accessory-orders': ['js/admin/orders.js'],
        products: ['js/admin/products.js'],
        categories: ['js/admin/categories.js'],
        'main-categories': ['js/admin/categories.js'],
        subcategories: ['js/admin/categories.js'],
        customers: ['js/admin/customers.js'],
        deposits: ['js/admin/deposits.js'],
        coupons: ['js/admin/coupons.js'],
        notifications: ['js/admin/notifications.js'],
        services: ['js/admin/services.js'],
        'repair-services': ['js/admin/services.js'],
        chats: ['js/admin/chats.js'],
        'support-chats': ['js/admin/chats.js'],
        messages: ['js/admin/messages.js'],
        'contact-messages': ['js/admin/messages.js'],
        settings: ['js/admin/settings.js'],
        logs: ['js/admin/logs.js'],
        'audit-logs': ['js/admin/logs.js'],
        accessories: ['js/admin/accessories.js'],
        'serva-catalog': ['js/admin/serva-catalog.js']
    });
    const loadedScripts = new Set();
    const loadedExternalScripts = new Set();
    const pendingSectionLoads = new Map();

    /**
     * Appends the shared cache-busting version to a legacy admin asset path.
     *
     * @param {string} assetPath
     * @returns {string}
     */
    function withVersion(assetPath) {
        return `${assetPath}?v=${ADMIN_ASSET_VERSION}`;
    }

    /**
     * Applies the runtime config returned by the server.
     *
     * @param {{ supabaseUrl?: string, supabasePublishableKey?: string, writeEnabled?: boolean }} config
     * @returns {void}
     */
    function applyRuntimeConfig(config) {
        window.__TZ_SUPABASE_URL = String(config?.supabaseUrl || '').trim();
        window.__TZ_SUPABASE_PUBLISHABLE_KEY = String(config?.supabasePublishableKey || '').trim();
        window.__TZ_SUPABASE_ANON_KEY = window.__TZ_SUPABASE_PUBLISHABLE_KEY;
        window.__TZ_LEGACY_ADMIN_WRITE_ENABLED = config?.writeEnabled === true;
    }

    /**
     * Reads any runtime config that was already injected into the page.
     *
     * @returns {{ supabasePublishableKey: string, supabaseUrl: string, writeEnabled: boolean }}
     */
    function readPreloadedRuntimeConfig() {
        const publishableKey = String(
            window.__TZ_SUPABASE_PUBLISHABLE_KEY || window.__TZ_SUPABASE_ANON_KEY || ''
        ).trim();

        return {
            supabasePublishableKey: publishableKey,
            supabaseUrl: String(window.__TZ_SUPABASE_URL || '').trim(),
            writeEnabled: window.__TZ_LEGACY_ADMIN_WRITE_ENABLED === true
        };
    }

    /**
     * Checks whether one runtime config object is complete enough to bootstrap the admin.
     *
     * @param {{ supabasePublishableKey?: string, supabaseUrl?: string }} config
     * @returns {boolean}
     */
    function hasCompleteRuntimeConfig(config) {
        return Boolean(
            String(config?.supabaseUrl || '').trim()
            && String(config?.supabasePublishableKey || '').trim()
        );
    }

    /**
     * Tries the static runtime config before falling back to the server runtime route.
     *
     * @returns {boolean}
     */
    function applyPreloadedRuntimeConfigIfAvailable() {
        const preloadedConfig = readPreloadedRuntimeConfig();

        if (!hasCompleteRuntimeConfig(preloadedConfig)) {
            return false;
        }

        applyRuntimeConfig(preloadedConfig);
        return true;
    }

    /**
     * Loads the legacy admin runtime config from the server.
     *
     * @returns {Promise<void>}
     * @throws {Error}
     */
    async function loadRuntimeConfig() {
        if (applyPreloadedRuntimeConfigIfAvailable()) {
            return;
        }

        const response = await fetch(ADMIN_RUNTIME_ROUTE, {
            cache: 'no-store',
            headers: { accept: 'application/json' }
        });

        let payload = null;
        try {
            payload = await response.json();
        } catch (error) {
            void error;
        }

        if (!response.ok) {
            throw new Error(payload?.error || `Failed to load admin runtime config (${response.status}).`);
        }

        if (!payload?.success) {
            throw new Error(payload?.error || 'Admin runtime config is unavailable.');
        }

        applyRuntimeConfig(payload);
    }

    /**
     * Waits until a global browser key becomes available or times out.
     *
     * @param {string} globalKey
     * @returns {Promise<void>}
     * @throws {Error}
     */
    async function waitForGlobal(globalKey) {
        const startedAt = Date.now();

        while (!window[globalKey]) {
            if (Date.now() - startedAt > SCRIPT_LOAD_TIMEOUT_MS) {
                throw new Error(`Timed out waiting for global "${globalKey}"`);
            }

            await new Promise((resolve) => window.setTimeout(resolve, GLOBAL_POLL_INTERVAL_MS));
        }
    }

    /**
     * Loads a classic admin script while preserving deterministic execution order.
     *
     * @param {string} assetPath
     * @returns {Promise<void>}
     * @throws {Error}
     */
    function loadAdminScript(assetPath) {
        if (loadedScripts.has(assetPath)) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');

            script.src = withVersion(assetPath);
            script.defer = true;
            script.async = false;
            script.onload = () => {
                loadedScripts.add(assetPath);
                resolve();
            };
            script.onerror = () => reject(new Error(`Failed to load script: ${assetPath}`));

            document.body.appendChild(script);
        });
    }

    /**
     * Loads an external script only once.
     *
     * @param {string} scriptUrl
     * @returns {Promise<void>}
     */
    function loadExternalScript(scriptUrl) {
        if (loadedExternalScripts.has(scriptUrl)) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');

            script.src = scriptUrl;
            script.async = true;
            script.onload = () => {
                loadedExternalScripts.add(scriptUrl);
                resolve();
            };
            script.onerror = () => reject(new Error(`Failed to load external script: ${scriptUrl}`));

            document.body.appendChild(script);
        });
    }

    /**
     * Loads a group of classic admin scripts in order.
     *
     * @param {string[]} assetPaths
     * @returns {Promise<void>}
     */
    async function loadScriptGroup(assetPaths) {
        for (const assetPath of assetPaths) {
            await loadAdminScript(assetPath);
        }
    }

    /**
     * Reads the requested admin section from the current URL.
     *
     * @returns {string}
     */
    function getCurrentSectionFromUrl() {
        try {
            const url = new URL(window.location.href);
            return String(url.searchParams.get('section') || 'dashboard').trim().toLowerCase();
        } catch (error) {
            void error;
            return 'dashboard';
        }
    }

    /**
     * Lazily loads the legacy script bundle required for a single admin section.
     *
     * @param {string} section
     * @returns {Promise<void>}
     */
    function loadSectionModules(section) {
        const normalizedSection = String(section || 'dashboard').trim().toLowerCase();
        const scriptGroup = SECTION_SCRIPT_GROUPS[normalizedSection] || [];

        if (scriptGroup.length === 0) {
            return Promise.resolve();
        }

        if (pendingSectionLoads.has(normalizedSection)) {
            return pendingSectionLoads.get(normalizedSection);
        }

        const loadPromise = loadScriptGroup(scriptGroup).finally(() => {
            pendingSectionLoads.delete(normalizedSection);
        });

        pendingSectionLoads.set(normalizedSection, loadPromise);
        return loadPromise;
    }

    /**
     * Registers the legacy admin service worker for offline shell support.
     *
     * @returns {Promise<void>}
     */
    async function registerAdminServiceWorker() {
        if (!('serviceWorker' in navigator)) {
            return;
        }

        try {
            await navigator.serviceWorker.register(ADMIN_SERVICE_WORKER_PATH, { scope: ADMIN_SERVICE_WORKER_SCOPE });
        } catch (error) {
            console.error('Failed to register admin service worker.', error);
        }
    }

    /**
     * Converts runtime bootstrap failures into concise Arabic copy for operators.
     *
     * @param {unknown} error
     * @returns {string}
     */
    function getBootstrapErrorMessage(error) {
        const rawMessage = String(error?.message || '').trim();

        if (!rawMessage) {
            return 'تعذر تحميل ملفات لوحة الإدارة. أعد المحاولة بعد تحديث الصفحة.';
        }

        if (rawMessage.includes('NEXT_PUBLIC_SUPABASE_')) {
            return 'مفاتيح Supabase العامة غير مضبوطة على بيئة Cloudflare. اضبط NEXT_PUBLIC_SUPABASE_URL و NEXT_PUBLIC_SUPABASE_ANON_KEY أو NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ثم أعد النشر.';
        }

        return rawMessage;
    }

    /**
     * Reveals a visible failure state instead of leaving the admin shell hidden.
     *
     * @param {unknown} error
     * @returns {void}
     */
    function showBootstrapErrorState(error) {
        const loginOverlay = document.getElementById('adminLoginOverlay');
        const loginForm = document.getElementById('adminLoginForm');
        const loginError = document.getElementById('loginError');
        const adminLayout = document.getElementById('adminLayout');
        const title = loginOverlay?.querySelector('h2');
        const description = loginOverlay?.querySelector('p');
        const errorMessage = getBootstrapErrorMessage(error);

        if (adminLayout) {
            adminLayout.style.display = 'none';
        }

        if (title) {
            title.textContent = ADMIN_BOOTSTRAP_ERROR_TITLE;
        }

        if (description) {
            description.textContent = ADMIN_BOOTSTRAP_ERROR_DESCRIPTION;
        }

        if (loginForm) {
            loginForm.querySelectorAll('input, button').forEach((element) => {
                element.disabled = true;
            });
            loginForm.style.opacity = '0.6';
        }

        if (loginError) {
            loginError.textContent = errorMessage;
            loginError.style.display = 'block';
        }

        if (loginOverlay) {
            loginOverlay.style.display = 'flex';
            loginOverlay.setAttribute('aria-hidden', 'false');
        }
    }

    /**
     * Boots the legacy admin runtime after the base dependencies are ready.
     *
     * @returns {Promise<void>}
     */
    async function bootstrapLegacyAdmin() {
        try {
            await registerAdminServiceWorker();
            await waitForGlobal(SUPABASE_GLOBAL_KEY);
            await loadRuntimeConfig();
            const dataEngineModule = await import(DATA_ENGINE_MODULE_PATH);
            await loadScriptGroup(BASE_SCRIPT_PATHS);

            window.__TZ_ADMIN_LOAD_SECTION_MODULES = loadSectionModules;
            window.__TZ_ADMIN_SECTION_SCRIPT_GROUPS = SECTION_SCRIPT_GROUPS;
            window.__TZ_ADMIN_LOAD_EXTERNAL_SCRIPT = loadExternalScript;
            window.__TZ_ADMIN_CHART_SCRIPT_URL = CHART_SCRIPT_URL;
            window.addEventListener('tz-admin-runtime-access-request', (event) => {
                if (event.detail?.enabled) {
                    dataEngineModule.grantAdminRuntimeAccess?.();
                    return;
                }

                dataEngineModule.revokeAdminRuntimeAccess?.();
            });

            window.__TZ_ADMIN_BOOTSTRAPPED = true;
            window.dispatchEvent(new Event('tz-admin-bootstrap-ready'));
            void loadSectionModules(getCurrentSectionFromUrl());
        } catch (error) {
            console.error('Failed to bootstrap legacy admin assets.', error);
            showBootstrapErrorState(error);
        }
    }

    void bootstrapLegacyAdmin();
})();
