import assert from "node:assert/strict";
import test from "node:test";

import {
  hasAdminMetadataAccess,
  hasStoredAdminAccess,
  isAdminBypassEnabled,
  requireAdminAccess,
} from "./adminAccess.js";

/**
 * Builds one stubbed privileged client for access tests.
 *
 * @param {{
 *   appUserRecord?: Record<string, unknown> | null,
 *   profileRecord?: Record<string, unknown> | null,
 *   onAuditInsert?: (payload: unknown) => void,
 * }} [options={}]
 * @returns {import("@supabase/supabase-js").SupabaseClient}
 */
function createAdminClientStub(options = {}) {
  return {
    from(tableName) {
      if (tableName === "audit_logs") {
        return {
          insert(payload) {
            options.onAuditInsert?.(payload);
            return Promise.resolve({ error: null });
          },
        };
      }

      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle() {
                  return Promise.resolve({ data: options.profileRecord ?? null });
                },
              };
            },
            ilike() {
              return {
                maybeSingle() {
                  return Promise.resolve({ data: options.appUserRecord ?? null });
                },
              };
            },
          };
        },
      };
    },
  };
}

test("isAdminBypassEnabled should allow bypass for localhost only", () => {
  assert.equal(
    isAdminBypassEnabled(
      { ADMIN_DEV_BYPASS: "true" },
      new Request("http://localhost:8788/api/admin/db")
    ),
    true
  );
  assert.equal(
    isAdminBypassEnabled(
      { ADMIN_DEV_BYPASS: "true" },
      new Request("https://tensr.systems/api/admin/db")
    ),
    false
  );
  assert.equal(
    isAdminBypassEnabled(
      { ADMIN_DEV_BYPASS: "false" },
      new Request("http://localhost:8788/api/admin/db")
    ),
    false
  );
});

test("hasAdminMetadataAccess should only honor server-controlled app_metadata", () => {
  // app_metadata is set by service-role on the server — safe to trust
  assert.equal(hasAdminMetadataAccess({ app_metadata: { role: "admin" } }), true);
  assert.equal(hasAdminMetadataAccess({ app_metadata: { role: "super_admin" } }), true);
  assert.equal(hasAdminMetadataAccess({ app_metadata: { role: "customer" } }), false);
  // user_metadata is user-writable via auth.updateUser — MUST be ignored (CRIT-001)
  assert.equal(hasAdminMetadataAccess({ user_metadata: { role: "admin" } }), false);
  assert.equal(hasAdminMetadataAccess({ user_metadata: { role: "super_admin" } }), false);
  // missing metadata
  assert.equal(hasAdminMetadataAccess({}), false);
  assert.equal(hasAdminMetadataAccess(null), false);
});

test("requireAdminAccess should reject user_metadata.role escalation attempts", async () => {
  const publicClient = {
    auth: {
      getUser() {
        return Promise.resolve({
          data: {
            user: {
              id: "user-evil",
              email: "evil@example.com",
              app_metadata: { role: "customer" },
              user_metadata: { role: "admin" }, // attacker-controlled
            },
          },
          error: null,
        });
      },
    },
  };
  const adminClient = createAdminClientStub({ profileRecord: { role: "customer", status: "active" } });

  const result = await requireAdminAccess(
    new Request("https://tensr.systems/api/admin/db", {
      headers: { Authorization: "Bearer token" },
    }),
    {},
    { adminClient, publicClient }
  );

  assert.equal(result.errorResponse.status, 403);
});

test("hasStoredAdminAccess should accept active admin profile records", async () => {
  const adminClient = createAdminClientStub({
    profileRecord: { role: "admin", status: "active" },
  });

  assert.equal(
    await hasStoredAdminAccess(adminClient, { id: "user-1", email: "admin@example.com" }),
    true
  );
});

test("hasStoredAdminAccess should reject legacy rows matched only via ilike wildcards", async () => {
  // Attacker authenticates as `_dmin@store.com`; `_` is a SQL LIKE wildcard so
  // the ilike pattern matches the real `admin@store.com` row. The exact-email
  // guard must reject this escalation attempt.
  const adminClient = createAdminClientStub({
    appUserRecord: { email: "admin@store.com", role: "admin", status: "active" },
  });

  assert.equal(
    await hasStoredAdminAccess(adminClient, { id: "user-evil", email: "_dmin@store.com" }),
    false
  );
});

test("hasStoredAdminAccess should accept legacy rows with an exact (case-insensitive) email", async () => {
  const adminClient = createAdminClientStub({
    appUserRecord: { email: "admin@store.com", role: "admin", status: "active" },
  });

  assert.equal(
    await hasStoredAdminAccess(adminClient, { id: "user-1", email: "Admin@Store.com" }),
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
  assert.match(await result.errorResponse.text(), /\[ADM-201\]/);
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

test("requireAdminAccess should log local bypass usage before granting access", async () => {
  const auditPayloads = [];
  const publicClient = {
    auth: {
      getUser() {
        return Promise.resolve({
          data: {
            user: { id: "user-7", email: "user@example.com", app_metadata: { role: "customer" } },
          },
          error: null,
        });
      },
    },
  };
  const adminClient = createAdminClientStub({
    onAuditInsert(payload) {
      auditPayloads.push(payload);
    },
  });

  const result = await requireAdminAccess(
    new Request("http://localhost:8788/api/admin/db", {
      headers: { Authorization: "Bearer token" },
    }),
    { ADMIN_DEV_BYPASS: "true" },
    { adminClient, publicClient }
  );

  assert.equal(result.errorResponse, null);
  assert.equal(auditPayloads.length, 1);
  assert.deepEqual(auditPayloads[0], {
    action: "admin_bypass_used",
    actor_email: "user@example.com",
    actor_id: "user-7",
    details: {
      reason: "local_admin_dev_bypass",
      request_url: "http://localhost:8788/api/admin/db",
    },
    target_id: "user-7",
    target_table: "admin_access",
  });
});

test("requireAdminAccess should reject production requests even when bypass env is true", async () => {
  const publicClient = {
    auth: {
      getUser() {
        return Promise.resolve({
          data: {
            user: { id: "user-2", email: "user@example.com", app_metadata: { role: "customer" } },
          },
          error: null,
        });
      },
    },
  };
  const adminClient = createAdminClientStub();

  const result = await requireAdminAccess(
    new Request("https://tensr.systems/api/admin/db", {
      headers: { Authorization: "Bearer token" },
    }),
    { ADMIN_DEV_BYPASS: "true" },
    { adminClient, publicClient }
  );

  assert.equal(result.user.email, "user@example.com");
  assert.equal(result.errorResponse.status, 403);
});
