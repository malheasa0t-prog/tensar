import assert from "node:assert/strict";
import test from "node:test";

import { createAdminSessionHandlers } from "./session.js";

/**
 * Creates a mock Cloudflare Pages context object.
 *
 * @param {Request} request - Incoming request object.
 * @returns {{ env: Record<string, string>, request: Request }} Mock Pages context.
 */
function createContext(request) {
  return { env: {}, request };
}

test("onRequestGet should forward auth failures from requireAdminAccess", async () => {
  const handlers = createAdminSessionHandlers({
    requireAdminAccess: async () => ({
      user: null,
      errorResponse: Response.json({ success: false, error: "[ADM-203] Forbidden", code: "ADM-203" }, { status: 403 }),
    }),
  });

  const response = await handlers.onRequestGet(
    createContext(new Request("https://tensr.systems/api/admin/session", { method: "GET" }))
  );
  const payload = await response.json();

  assert.equal(response.status, 403);
  assert.equal(payload.code, "ADM-203");
});

test("onRequestGet should return the normalized admin session payload", async () => {
  const handlers = createAdminSessionHandlers({
    requireAdminAccess: async () => ({
      user: {
        id: "auth-user-1",
        email: "admin@example.com",
        app_metadata: { role: "admin" },
      },
      errorResponse: null,
    }),
    createSupabaseAdmin: () => ({
      from(tableName) {
        if (tableName === "user_profiles") {
          return {
            select() {
              return this;
            },
            eq() {
              return this;
            },
            maybeSingle() {
              return Promise.resolve({
                data: {
                  user_id: "auth-user-1",
                  full_name: "Admin Profile",
                  role: "super_admin",
                  status: "active",
                },
              });
            },
          };
        }

        return {
          select() {
            return this;
          },
          ilike() {
            return this;
          },
          maybeSingle() {
            return Promise.resolve({
              data: {
                id: "app-1",
                auth_user_id: "auth-user-1",
                full_name: "Legacy Admin",
                email: "admin@example.com",
                role: "admin",
                status: "active",
              },
            });
          },
        };
      },
    }),
  });

  const response = await handlers.onRequestGet(
    createContext(new Request("https://tensr.systems/api/admin/session", { method: "GET" }))
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.deepEqual(payload.user, {
    email: "admin@example.com",
    fullName: "Admin Profile",
    id: "auth-user-1",
    role: "super_admin",
    status: "active",
  });
});

test("onRequestGet should fall back to auth metadata when profile rows are missing", async () => {
  const handlers = createAdminSessionHandlers({
    requireAdminAccess: async () => ({
      user: {
        id: "auth-user-2",
        email: "ops@example.com",
        app_metadata: { role: "admin" },
      },
      errorResponse: null,
    }),
    createSupabaseAdmin: () => ({
      from() {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          ilike() {
            return this;
          },
          maybeSingle() {
            return Promise.resolve({ data: null });
          },
        };
      },
    }),
  });

  const response = await handlers.onRequestGet(
    createContext(new Request("https://tensr.systems/api/admin/session", { method: "GET" }))
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.user.fullName, "ops@example.com");
  assert.equal(payload.user.role, "admin");
});

test("onRequestOptions should return the secured preflight response", () => {
  const handlers = createAdminSessionHandlers();
  const response = handlers.onRequestOptions(
    createContext(new Request("https://tensr.systems/api/admin/session", {
      headers: { Origin: "https://tensr.systems" },
      method: "OPTIONS",
    }))
  );

  assert.equal(response.status, 204);
  assert.equal(response.headers.get("Access-Control-Allow-Methods"), "GET, OPTIONS");
  assert.equal(response.headers.get("Cache-Control"), "no-store, max-age=0");
});
