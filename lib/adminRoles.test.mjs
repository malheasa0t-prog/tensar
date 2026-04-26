import assert from "node:assert/strict";
import test from "node:test";

import {
  canAccessAdminRecord,
  canAccessAdminRole,
  getAdminDisplayName,
} from "./adminRoles.js";

test("canAccessAdminRole should allow only admin and super_admin roles", () => {
  assert.equal(canAccessAdminRole("admin"), true);
  assert.equal(canAccessAdminRole("super_admin"), true);
  assert.equal(canAccessAdminRole("technician"), false);
  assert.equal(canAccessAdminRole("employee"), false);
});

test("canAccessAdminRecord should require an active admin-capable record", () => {
  assert.equal(
    canAccessAdminRecord({ role: "admin", status: "active" }),
    true
  );
  assert.equal(
    canAccessAdminRecord({ role: "admin", status: "banned" }),
    false
  );
  assert.equal(
    canAccessAdminRecord({ role: "customer", status: "active" }),
    false
  );
});

test("getAdminDisplayName should prefer profile then legacy name then email", () => {
  assert.equal(
    getAdminDisplayName({
      profile: { full_name: "Profile Admin" },
      legacyUser: { full_name: "Legacy Admin" },
      fallbackEmail: "admin@example.com",
    }),
    "Profile Admin"
  );

  assert.equal(
    getAdminDisplayName({
      profile: null,
      legacyUser: { full_name: "Legacy Admin" },
      fallbackEmail: "admin@example.com",
    }),
    "Legacy Admin"
  );

  assert.equal(
    getAdminDisplayName({
      profile: null,
      legacyUser: null,
      fallbackEmail: "admin@example.com",
    }),
    "admin@example.com"
  );
});
