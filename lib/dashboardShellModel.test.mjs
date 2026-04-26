import test from "node:test";
import assert from "node:assert/strict";

import {
  BASE_DASHBOARD_NAV_ITEMS,
  buildDashboardNavItems,
  createDashboardShellTimeoutError,
  DASHBOARD_SHELL_TIMEOUT_MESSAGE,
  DASHBOARD_SHELL_TIMEOUT_MS,
  resolveDashboardDisplayName,
} from "./dashboardShellModel.js";

test("resolveDashboardDisplayName should prefer the trimmed profile full name", () => {
  assert.equal(
    resolveDashboardDisplayName({
      profile: { full_name: "  Ali Ahmad  " },
      user: { email: "ali@example.com" },
    }),
    "Ali Ahmad"
  );
});

test("resolveDashboardDisplayName should fall back to the user email prefix", () => {
  assert.equal(
    resolveDashboardDisplayName({
      profile: null,
      user: { email: "ali@example.com" },
    }),
    "ali"
  );
});

test("buildDashboardNavItems should attach live badges to favorites and notifications", () => {
  const navItems = buildDashboardNavItems({
    favoriteCount: 8,
    unreadNotifications: 125,
  });

  assert.equal(navItems.length, BASE_DASHBOARD_NAV_ITEMS.length);
  assert.equal(navItems.find((item) => item.href === "/dashboard/favorites")?.badge, 8);
  assert.equal(
    navItems.find((item) => item.href === "/dashboard/notifications")?.badge,
    "99+"
  );
});

test("createDashboardShellTimeoutError should expose the public retry copy", () => {
  const error = createDashboardShellTimeoutError();

  assert.equal(DASHBOARD_SHELL_TIMEOUT_MS, 10000);
  assert.equal(error.message, `[DSH-305] ${DASHBOARD_SHELL_TIMEOUT_MESSAGE}`);
});
