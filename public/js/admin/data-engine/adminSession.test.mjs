import assert from "node:assert/strict";
import test from "node:test";

import { getAdminSessionUser } from "./adminSession.js";

test("getAdminSessionUser should return null when no session token is available", async () => {
  const result = await getAdminSessionUser({
    baseClient: {
      auth: {
        async getSession() {
          return { data: { session: null } };
        },
      },
    },
  });

  assert.deepEqual(result, { error: null, user: null });
});

test("getAdminSessionUser should return the validated admin payload", async () => {
  const result = await getAdminSessionUser({
    baseClient: {
      auth: {
        async getSession() {
          return { data: { session: { access_token: "token-1" } } };
        },
      },
    },
    fetchImpl: async (url, init) => {
      assert.equal(url, "/api/admin/session");
      assert.equal(init.method, "GET");
      assert.equal(init.headers.Authorization, "Bearer token-1");
      return Response.json({
        success: true,
        user: { id: "admin-1", role: "admin", status: "active" },
      });
    },
  });

  assert.equal(result.error, null);
  assert.deepEqual(result.user, { id: "admin-1", role: "admin", status: "active" });
});

test("getAdminSessionUser should treat 403 as a non-admin session", async () => {
  const result = await getAdminSessionUser({
    baseClient: {
      auth: {
        async getSession() {
          return { data: { session: { access_token: "token-2" } } };
        },
      },
    },
    fetchImpl: async () => Response.json({
      success: false,
      error: "[ADM-203] Forbidden",
    }, { status: 403 }),
  });

  assert.deepEqual(result, { error: null, user: null });
});

test("getAdminSessionUser should surface transport failures", async () => {
  const result = await getAdminSessionUser({
    baseClient: {
      auth: {
        async getSession() {
          return { data: { session: { access_token: "token-3" } } };
        },
      },
    },
    fetchImpl: async () => {
      throw new Error("network down");
    },
  });

  assert.equal(result.user, null);
  assert.match(result.error || "", /network down/);
});
