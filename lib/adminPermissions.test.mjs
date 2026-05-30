import assert from "node:assert/strict";
import test from "node:test";

import {
  PERMISSION_SECTIONS,
  buildFullAdminContext,
  buildPermissionMap,
  hasSectionAccess,
  isFullAdminRole,
  isKnownSection,
  isPanelStaffRole,
  requirementForRpc,
  sectionForTable,
} from "./adminPermissions.js";

test("isFullAdminRole only accepts super_admin and admin", () => {
  assert.equal(isFullAdminRole("super_admin"), true);
  assert.equal(isFullAdminRole("ADMIN"), true);
  assert.equal(isFullAdminRole("employee"), false);
  assert.equal(isFullAdminRole("technician"), false);
  assert.equal(isFullAdminRole("customer"), false);
  assert.equal(isFullAdminRole(null), false);
});

test("isPanelStaffRole accepts admins and granular staff only", () => {
  for (const role of ["super_admin", "admin", "employee", "technician"]) {
    assert.equal(isPanelStaffRole(role), true);
  }
  assert.equal(isPanelStaffRole("seller"), false);
  assert.equal(isPanelStaffRole("customer"), false);
});

test("sectionForTable maps tables to governing sections", () => {
  assert.equal(sectionForTable("orders"), "orders");
  assert.equal(sectionForTable("service_orders"), "orders");
  assert.equal(sectionForTable("repair_bookings"), "orders");
  assert.equal(sectionForTable("orange_money_logs"), "deposits");
  assert.equal(sectionForTable("audit_logs"), "logs");
  assert.equal(sectionForTable("staff_permissions"), "staff");
  assert.equal(sectionForTable("unknown_table"), null);
});

test("requirementForRpc requires manage on the right section", () => {
  assert.deepEqual(requirementForRpc("admin_approve_refund"), { section: "refunds", level: "manage" });
  assert.deepEqual(requirementForRpc("admin_set_staff_role"), { section: "staff", level: "manage" });
  assert.equal(requirementForRpc("not_a_function"), null);
});

test("buildFullAdminContext grants every section at both levels", () => {
  const context = buildFullAdminContext("admin");
  assert.equal(context.isFullAdmin, true);
  for (const section of PERMISSION_SECTIONS) {
    assert.equal(hasSectionAccess(context, section.key, "view"), true);
    assert.equal(hasSectionAccess(context, section.key, "manage"), true);
  }
});

test("buildPermissionMap normalizes rows and manage implies view", () => {
  const map = buildPermissionMap([
    { section: "orders", can_view: true, can_manage: false },
    { section: "deposits", can_view: false, can_manage: true },
    { section: "", can_view: true },
  ]);
  assert.deepEqual(map.orders, { view: true, manage: false });
  assert.deepEqual(map.deposits, { view: true, manage: true });
  assert.equal(map[""], undefined);
});

test("hasSectionAccess enforces view vs manage for granular staff", () => {
  const context = {
    isFullAdmin: false,
    permissions: {
      orders: { view: true, manage: false },
      deposits: { view: true, manage: true },
    },
  };
  assert.equal(hasSectionAccess(context, "orders", "view"), true);
  assert.equal(hasSectionAccess(context, "orders", "manage"), false);
  assert.equal(hasSectionAccess(context, "deposits", "manage"), true);
  assert.equal(hasSectionAccess(context, "products", "view"), false);
  assert.equal(hasSectionAccess(null, "orders", "view"), false);
});

test("isKnownSection validates against the catalog", () => {
  assert.equal(isKnownSection("orders"), true);
  assert.equal(isKnownSection("STAFF"), true);
  assert.equal(isKnownSection("nope"), false);
});
