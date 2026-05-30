import assert from "node:assert/strict";
import test from "node:test";

import {
  createAdminSupabaseClient,
  executeAdminWriteOperation,
} from "./adminWriteProxy.js";

test("executeAdminWriteOperation should return a Supabase-like error when no admin session token exists", async () => {
  const result = await executeAdminWriteOperation({
    baseClient: {
      auth: {
        getSession: async () => ({ data: { session: null } }),
      },
    },
    fetchImpl: async () => {
      throw new Error("fetch should not run without an access token");
    },
    operation: { type: "mutation", table: "products", action: "delete", filters: [] },
  });

  assert.equal(result.data, null);
  assert.equal(result.error?.status, 401);
});

test("createAdminSupabaseClient should route admin reads through the secured admin API", async () => {
  const requests = [];
  const client = createAdminSupabaseClient({
    adminPage: true,
    baseClient: {
      auth: {
        getSession: async () => ({ data: { session: { access_token: "token-1" } } }),
      },
      from() {
        return {};
      },
      storage: { tag: "storage-client" },
    },
    fetchImpl: async (url, request) => {
      requests.push({ url, request });
      return new Response(JSON.stringify({
        success: true,
        data: [{ id: "prd-1" }],
        count: null,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });

  const result = await client
    .from("products")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "/api/admin/db");
  assert.deepEqual(JSON.parse(String(requests[0].request.body)), {
    type: "read",
    table: "products",
    columns: "*",
    filters: [],
    orders: [{ column: "created_at", ascending: false }],
    limit: 10,
    single: false,
    maybeSingle: false,
  });
  assert.deepEqual(result.data, [{ id: "prd-1" }]);
  assert.equal(client.storage.tag, "storage-client");
});

test("createAdminSupabaseClient should preserve not filters for secured admin reads", async () => {
  const requests = [];
  const client = createAdminSupabaseClient({
    adminPage: true,
    baseClient: {
      auth: {
        getSession: async () => ({ data: { session: { access_token: "token-1" } } }),
      },
      from() {
        return {};
      },
    },
    fetchImpl: async (url, request) => {
      requests.push({ url, request });
      return new Response(JSON.stringify({
        success: true,
        data: [{ provider_service_id: "srv-1" }],
        count: null,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });

  const result = await client
    .from("services")
    .select("provider_service_id")
    .not("provider_service_id", "is", null);

  assert.equal(requests.length, 1);
  assert.deepEqual(JSON.parse(String(requests[0].request.body)), {
    type: "read",
    table: "services",
    columns: "provider_service_id",
    filters: [{ type: "not", column: "provider_service_id", operator: "is", value: null }],
    orders: [],
    limit: null,
    single: false,
    maybeSingle: false,
  });
  assert.equal(result.error, null);
  assert.deepEqual(result.data, [{ provider_service_id: "srv-1" }]);
});

test("createAdminSupabaseClient should route writes through the secured admin API", async () => {
  const requests = [];
  const client = createAdminSupabaseClient({
    adminPage: true,
    baseClient: {
      auth: {
        getSession: async () => ({ data: { session: { access_token: "token-1" } } }),
      },
      from() {
        return {};
      },
    },
    fetchImpl: async (url, request) => {
      requests.push({ url, request });
      return new Response(JSON.stringify({
        success: true,
        data: { id: "prd-1", status: "draft" },
        count: null,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });

  const result = await client
    .from("products")
    .update({ status: "draft" })
    .eq("id", "prd-1")
    .select("*")
    .single();

  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "/api/admin/db");
  assert.match(String(requests[0].request.headers.Authorization), /^Bearer token-1$/);
  assert.deepEqual(JSON.parse(String(requests[0].request.body)), {
    type: "mutation",
    table: "products",
    action: "update",
    values: { status: "draft" },
    options: null,
    filters: [{ type: "eq", column: "id", value: "prd-1" }],
    select: "*",
    single: true,
    maybeSingle: false,
  });
  assert.equal(result.error, null);
  assert.deepEqual(result.data, { id: "prd-1", status: "draft" });
});

test("createAdminSupabaseClient should proxy privileged RPC calls through the admin API", async () => {
  const client = createAdminSupabaseClient({
    adminPage: true,
    baseClient: {
      auth: {
        getSession: async () => ({ data: { session: { access_token: "token-1" } } }),
      },
    },
    fetchImpl: async (_url, request) => {
      const body = JSON.parse(String(request.body));
      assert.deepEqual(body, {
        type: "rpc",
        functionName: "admin_adjust_wallet_balance",
        args: { amount: 20 },
      });

      return new Response(JSON.stringify({
        success: true,
        data: { ok: true },
        count: null,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });

  const result = await client.rpc("admin_adjust_wallet_balance", { amount: 20 });
  assert.equal(result.error, null);
  assert.deepEqual(result.data, { ok: true });
});
