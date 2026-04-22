// ===== TechZone Admin - Shell =====
(function () {
    'use strict';

    const A = window.AdminApp;
    const H = window.AdminShellHelpers;
    const THEME_KEY = 'tz_admin_theme';
    const SIDEBAR_KEY = 'tz_admin_sidebar_collapsed';
    const state = { activeCommandIndex: 0, alerts: [], commandItems: [], offlineQueueCount: 0 };
    const elements = {
        alertsBadge: document.getElementById('adminHeaderAlertsCount'),
        alertsButton: document.getElementById('adminHeaderAlertsBtn'),
        alertsMenu: document.getElementById('adminHeaderAlertsDropdown'),
        breadcrumbs: document.getElementById('adminHeaderBreadcrumbs'),
        commandButton: document.getElementById('adminCommandPaletteBtn'),
        commandInput: document.getElementById('adminCommandPaletteInput'),
        commandList: document.getElementById('adminCommandPaletteList'),
        commandModal: document.getElementById('adminCommandPalette'),
        collapseToggle: document.getElementById('sidebarCollapseToggle'),
        layout: document.getElementById('adminLayout'),
        logoutButton: document.getElementById('logoutBtn'),
        profileButton: document.getElementById('adminHeaderProfileBtn'),
        profileMenu: document.getElementById('adminHeaderProfileDropdown'),
        profileMeta: document.getElementById('adminHeaderProfileMeta'),
        themeButton: document.getElementById('adminThemeToggleBtn')
    };

    if (!A || !H || !elements.layout) return;

    function syncSidebarTooltips() {
        document.querySelectorAll('.sidebar-link, .sidebar-group-toggle').forEach(function (node) {
            const labelNode = node.classList.contains('sidebar-link')
                ? node.querySelector('span:not(.sidebar-badge)')
                : node.querySelector('.sidebar-group-label > span');
            const label = String(labelNode?.textContent || node.textContent || '').replace(/\s+/g, ' ').trim();
            if (label) node.title = label;
        });
    }

    function setSidebarCollapsed(nextValue) {
        const collapsed = nextValue && window.innerWidth > 768;
        elements.layout.classList.toggle('sidebar-collapsed', collapsed);
        localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0');
        syncSidebarTooltips();
    }

    function setTheme(nextTheme) {
        document.body.dataset.theme = nextTheme === 'light' ? 'light' : 'dark';
        localStorage.setItem(THEME_KEY, document.body.dataset.theme);
        const themeLabel = document.body.dataset.theme === 'light' ? 'الوضع الداكن' : 'الوضع الفاتح';
        const textNode = elements.themeButton.querySelector('span:last-child');
        if (textNode) textNode.textContent = themeLabel;
    }

    function renderBreadcrumbs() {
        const breadcrumbs = H.buildAdminBreadcrumbs(A.currentSection);
        elements.breadcrumbs.innerHTML = breadcrumbs.map(function (item, index) {
            const separator = index === breadcrumbs.length - 1 ? '' : '<span>/</span>';
            const icon = item.icon ? `<i class="fas ${item.icon}"></i>` : '';
            return `<button type="button" class="admin-breadcrumb ${item.current ? 'is-current' : ''}" data-breadcrumb-section="${item.section}">${icon}${item.label}</button>${separator}`;
        }).join('');
    }

    function getAlertSnapshot() {
        return {
            offlineQueueCount: state.offlineQueueCount,
            pendingOrders: (TZ.db.orders || []).filter(function (order) { return ['pending', 'processing', 'awaiting_delivery'].includes(order.status); }).length
        };
    }

    function renderAlerts() {
        state.alerts = H.buildAdminHeaderAlerts(getAlertSnapshot());
        const actionableAlerts = state.alerts.filter(function (item) { return item.id !== 'healthy'; });
        elements.alertsBadge.hidden = actionableAlerts.length === 0;
        elements.alertsBadge.textContent = actionableAlerts.length;
        elements.alertsMenu.innerHTML = state.alerts.map(function (item) {
            return `<button type="button" class="admin-header-menu-item" data-alert-section="${item.section}">
                <span class="admin-header-menu-icon admin-header-menu-icon--${item.tone}"><i class="fas ${item.icon}"></i></span>
                <span>${item.title}</span>
            </button>`;
        }).join('');
    }

    function exportBackup() {
        const content = JSON.stringify({ exportedAt: new Date().toISOString(), data: TZ.clone(TZ.db) }, null, 2);
        const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `techzone-admin-backup-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(link.href);
    }

    function canUseCommand(command) {
        const [action, target] = String(command?.action || '').split(':');
        if ((action === 'navigate' || action === 'trigger') && typeof A.canAccessSection === 'function') {
            return A.canAccessSection(target);
        }
        return true;
    }

    function runCommand(command) {
        const [action, target, selector] = String(command.action || '').split(':');
        if (action === 'navigate' && target) A.renderSection(target, { history: 'push' });
        if (action === 'trigger' && target && selector) {
            A.renderSection(target, { history: 'push' });
            window.setTimeout(function () { document.querySelector(selector)?.click(); }, 50);
        }
        if (command.action === 'site') window.open('/', '_blank', 'noopener');
        if (command.action === 'backup') exportBackup();
        if (command.action === 'theme') setTheme(document.body.dataset.theme === 'light' ? 'dark' : 'light');
        closeCommandPalette();
    }

    function renderCommandResults(query) {
        const results = H.searchAdminCommands(state.commandItems, query, 8);
        state.activeCommandIndex = results.length ? 0 : -1;
        elements.commandList.innerHTML = results.map(function (command, index) {
            return `<button type="button" class="admin-command-item ${index === 0 ? 'is-active' : ''}" data-command-id="${command.id}">
                <span class="admin-command-item-icon"><i class="fas ${command.icon}"></i></span>
                <span><strong>${command.title}</strong><small>${command.description}</small></span>
            </button>`;
        }).join('') || '<div class="admin-command-empty">لا توجد أوامر مطابقة.</div>';
    }

    function openCommandPalette() {
        state.commandItems = H.buildAdminCommandItems().filter(canUseCommand);
        elements.commandModal.hidden = false;
        elements.commandInput.value = '';
        renderCommandResults('');
        window.setTimeout(function () { elements.commandInput.focus(); }, 0);
    }

    function closeCommandPalette() {
        elements.commandModal.hidden = true;
    }

    function toggleMenu(menu, button) {
        const nextHidden = !menu.hidden;
        document.querySelectorAll('.admin-header-menu').forEach(function (item) { item.hidden = true; });
        elements.alertsButton?.setAttribute('aria-expanded', 'false');
        elements.profileButton?.setAttribute('aria-expanded', 'false');
        if (nextHidden) return;
        menu.hidden = false;
        button.setAttribute('aria-expanded', 'true');
    }

    function refreshShell() {
        renderBreadcrumbs();
        renderAlerts();
        elements.profileMeta.innerHTML = `<strong>${document.getElementById('adminName')?.textContent || 'المدير'}</strong><small>${document.getElementById('adminRole')?.textContent || ''}</small>`;
    }

    elements.collapseToggle?.addEventListener('click', function () {
        setSidebarCollapsed(!elements.layout.classList.contains('sidebar-collapsed'));
    });
    elements.commandButton?.addEventListener('click', openCommandPalette);
    elements.themeButton?.addEventListener('click', function () {
        setTheme(document.body.dataset.theme === 'light' ? 'dark' : 'light');
    });
    elements.alertsButton?.addEventListener('click', function () { toggleMenu(elements.alertsMenu, this); });
    elements.profileButton?.addEventListener('click', function () { toggleMenu(elements.profileMenu, this); });
    elements.breadcrumbs?.addEventListener('click', function (event) {
        const button = event.target.closest('[data-breadcrumb-section]');
        if (button) A.renderSection(button.dataset.breadcrumbSection, { history: 'push' });
    });
    elements.alertsMenu?.addEventListener('click', function (event) {
        const button = event.target.closest('[data-alert-section]');
        if (!button) return;
        A.renderSection(button.dataset.alertSection, { history: 'push' });
        elements.alertsMenu.hidden = true;
    });
    elements.profileMenu?.addEventListener('click', function (event) {
        const action = event.target.closest('[data-profile-action]')?.dataset.profileAction;
        if (action === 'logout') elements.logoutButton?.click();
        if (action === 'site') window.open('/', '_blank', 'noopener');
        elements.profileMenu.hidden = true;
    });
    elements.commandModal?.addEventListener('click', function (event) {
        if (event.target === elements.commandModal || event.target.closest('[data-close-command-palette]')) closeCommandPalette();
    });
    elements.commandInput?.addEventListener('input', function () {
        renderCommandResults(this.value);
    });
    elements.commandInput?.addEventListener('keydown', function (event) {
        const items = Array.from(elements.commandList.querySelectorAll('.admin-command-item'));
        if (event.key === 'Escape') return closeCommandPalette();
        if (!items.length) return;
        if (event.key === 'ArrowDown') state.activeCommandIndex = (state.activeCommandIndex + 1) % items.length;
        if (event.key === 'ArrowUp') state.activeCommandIndex = (state.activeCommandIndex - 1 + items.length) % items.length;
        if (event.key === 'Enter') items[state.activeCommandIndex]?.click();
        items.forEach(function (item, index) { item.classList.toggle('is-active', index === state.activeCommandIndex); });
    });
    elements.commandList?.addEventListener('click', function (event) {
        const button = event.target.closest('[data-command-id]');
        if (!button) return;
        const command = state.commandItems.find(function (item) { return item.id === button.dataset.commandId; });
        if (command) runCommand(command);
    });

    document.addEventListener('click', function (event) {
        if (!event.target.closest('.admin-header-dropdown')) {
            document.querySelectorAll('.admin-header-menu').forEach(function (menu) { menu.hidden = true; });
            elements.alertsButton?.setAttribute('aria-expanded', 'false');
            elements.profileButton?.setAttribute('aria-expanded', 'false');
        }
    });
    document.addEventListener('keydown', function (event) {
        if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'p') {
            event.preventDefault();
            openCommandPalette();
        }
    });
    window.addEventListener('resize', function () {
        if (window.innerWidth <= 768) setSidebarCollapsed(false);
    });
    window.addEventListener('tz-admin-section-rendered', refreshShell);
    window.addEventListener('tz-data-updated', renderAlerts);
    window.addEventListener('tz-offline-queue-updated', function (event) {
        state.offlineQueueCount = Number(event.detail?.count || 0);
        renderAlerts();
    });

    setTheme(localStorage.getItem(THEME_KEY) || document.body.dataset.theme || 'dark');
    setSidebarCollapsed(localStorage.getItem(SIDEBAR_KEY) === '1');
    syncSidebarTooltips();
    refreshShell();
})();
