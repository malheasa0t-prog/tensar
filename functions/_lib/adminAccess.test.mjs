import assert from "node:assert/strict";
import test from "node:test";

import {
  hasAdminMetadataAccess,
  hasStoredAdminAccess,
  isAdminBypassEnabled,
  requireAdminAccess,
} from "./adminAccess.js";

test("isAdminBypassEnabled should detect explicit true values", () => {
  assert.equal(isAdminBypassEnabled({ ADMIN_DEV_BYPASS: "true" }), true);
  assert.equal(isAdminBypassEnabled({ ADMIN_DEV_BYPASS: "false" }), false);
});

test("hasAdminMetadataAccess should accept admin roles from user metadata", () => {
  assert.equal(hasAdminMetadataAccess({ user_metadata: { role: "admin" } }), true);
  assert.equal(hasAdminMetadataAccess({ app_metadata: { role: "customer" } }), false);
});

test("hasStoredAdminAccess should accept active admin profile records", async () => {
  const adminClient = {
    from(tableName) {
      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle() {
                  return Promise.resolve(
                    tableName === "user_profiles"
                      ? { data: { role: "admin", status: "active" } }
                      : { data: null }
                  );
                },
              };
            },
            ilike() {
              return {
                maybeSingle() {
                  return Promise.resolve({ data: null });
                },
              };
            },
          };
        },
      };
    },
  };

  assert.equal(
    await hasStoredAdminAccess(adminClient, { id: "user-1", email: "admin@example.com" }),
    true
  );
});

test("requireAdminAccess should reject missing bearer tokens", async () => {
  const result = await requireAdminAccess(
    new Request("https://tensr.systems/api/provider/services"),
    {}
  );

  assert.equal(result.user, null);
  assert.equal(result.errorResponse.status, 401);
  assert.match(await result.errorResponse.text(), /غير مصرح/);
});

test("requireAdminAccess should allow authenticated admin metadata users", async () => {
  const publicClient = {
    auth: {
      getUser() {
        return Promise.resolve({
          data: { user: { id: "user-1", email: "admin@example.com", app_metadata: { role: "admin" } } },
          error: null,
        });
      },
    },
  };

  const result = await requireAdminAccess(
    new Request("https://tensr.systems/api/provider/services", {
      headers: { Authorization: "Bearer token" },
    }),
    {},
    { publicClient }
  );

  assert.equal(result.errorResponse, null);
  assert.equal(result.user.email, "admin@example.com");
});
