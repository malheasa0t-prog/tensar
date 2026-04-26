import assert from "node:assert/strict";
import test from "node:test";

import { createAdminDbHandlers } from "./db.js";

/**
 * Creates a mock Cloudflare Pages context object.
 *
 * @param {Request} request
 * @returns {{ request: Request, env: Record<string, string> }}
 */
function createContext(request) {
  return { request, env: {} };
}

/**
 * Normalizes one mocked query result payload.
 *
 * @param {unknown} result
 * @returns {{ count: number | null, data: unknown, error: { message?: string } | null }}
 */
function normalizeQueryResult(result) {
  if (Array.isArray(result)) {
    return { count: null, data: result, error: null };
  }

  if (!result || typeof result !== "object") {
    return { count: null, data: result ?? null, error: null };
  }

  return {
    count: Number.isFinite(result.count) ? result.count : null,
    data: Object.prototype.hasOwnProperty.call(result, "data") ? result.data : null,
    error: result.error ?? null,
  };
}

/**
 * Creates a promise-like Supabase query builder stub.
 *
 * @param {unknown} result
 * @returns {{ builder: Record<string, unknown>, steps: Array<Record<string, unknown>> }}
 */
function createQueryStub(result) {
  const steps = [];
  const normalizedResult = normalizeQueryResult(result);
  const builder = {
    delete() {
      steps.push({ method: "delete" });
      return builder;
    },
    eq(column, value) {
      steps.push({ method: "eq", column, value });
      return builder;
    },
    ilike(column, value) {
      steps.push({ method: "ilike", column, value });
      return builder;
    },
    in(column, value) {
      steps.push({ method: "in", column, value });
      return builder;
    },
    insert(values, options) {
      steps.push({ method: "insert", values, options: options || null });
      return builder;
    },
    limit(value) {
      steps.push({ method: "limit", value });
      return builder;
    },
    maybeSingle() {
      steps.push({ method: "maybeSingle" });
      return builder;
    },
    order(column, options) {
      steps.push({ method: "order", column, options });
      return builder;
    },
    select(columns) {
      steps.push({ method: "select", columns });
      return builder;
    },
    single() {
      steps.push({ method: "single" });
      return builder;
    },
    update(values, options) {
      steps.push({ method: "update", values, options: options || null });
      return builder;
    },
    upsert(values, options) {
      steps.push({ method: "upsert", values, options: options || null });
      return builder;
    },
    then(resolve, reject) {
      return Promise.resolve(normalizedResult).then(resolve, reject);
    },
  };

  return { builder, steps };
}

test("onRequestPost should forward auth failures from requireAdminAccess", async () => {
  const handlers = createAdminDbHandlers({
    requireAdminAccess: async () => ({
      user: null,
      errorResponse: Response.json({ success: false, error: "[ADM-203] صلاحيات غير كافية", code: "ADM-203" }, { status: 403 }),
    }),
  });

  const response = await handlers.onRequestPost(
    createContext(new Request("https://tensr.systems/api/admin/db", { method: "POST" })),
  );
  const payload = await response.json();

  assert.equal(response.status, 403);
  assert.equal(payload.code, "ADM-203");
});

test("onRequestPost should execute one secured read with filters, order, and limit", async () => {
  const query = createQueryStub([{ id: "msg-1", body: "ok" }]);
  const handlers = createAdminDbHandlers({
    requireAdminAccess: async () => ({
      user: { id: "admin-1", email: "admin@example.com" },
      errorResponse: null,
    }),
    createSupabaseAdmin: () => ({
      from(table) {
        assert.equal(table, "contact_messages");
        return query.builder;
      },
    }),
  });

  const response = await handlers.onRequestPost(createContext(new Request(
    "https://tensr.systems/api/admin/db",
    {
      method: "POST",
      body: JSON.stringify({
        type: "read",
        table: "contact_messages",
        columns: "*",
        filters: [{ type: "eq", column: "status", value: "new" }],
        orders: [{ column: "created_at", ascending: false }],
        limit: 25,
      }),
      headers: { "Content-Type": "application/json" },
    },
  )));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.deepEqual(query.steps, [
    { method: "select", columns: "*" },
    { method: "eq", column: "status", value: "new" },
    { method: "order", column: "created_at", options: { ascending: false } },
    { method: "limit", value: 25 },
  ]);
});

test("onRequestPost should sign deposit proof URLs for admin reads", async () => {
  const query = createQueryStub([{ id: "dep-1", proof_url: "user-1/proof.png" }]);
  const handlers = createAdminDbHandlers({
    requireAdminAccess: async () => ({
      user: { id: "admin-1", email: "admin@example.com" },
      errorResponse: null,
    }),
    createSupabaseAdmin: () => ({
      from() {
        return query.builder;
      },
      storage: {
        from(bucketName) {
          assert.equal(bucketName, "deposits");
          return {
            async createSignedUrl(path, expiresIn) {
              assert.equal(path, "user-1/proof.png");
              assert.equal(expiresIn, 3600);
              return { data: { signedUrl: "https://signed.example.com/proof" }, error: null };
            },
          };
        },
      },
    }),
  });

  const response = await handlers.onRequestPost(createContext(new Request(
    "https://tensr.systems/api/admin/db",
    {
      method: "POST",
      body: JSON.stringify({
        type: "read",
        table: "deposits",
        columns: "*",
      }),
      headers: { "Content-Type": "application/json" },
    },
  )));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.equal(payload.data[0].proof_url, "https://signed.example.com/proof");
});

test("onRequestPost should allow safe admin reads from user_profiles", async () => {
  const query = createQueryStub([{ user_id: "user-1", role: "user", status: "active" }]);
  const handlers = createAdminDbHandlers({
    requireAdminAccess: async () => ({
      user: { id: "admin-1", email: "admin@example.com" },
      errorResponse: null,
    }),
    createSupabaseAdmin: () => ({
      from(table) {
        assert.equal(table, "user_profiles");
        return query.builder;
      },
    }),
  });

  const response = await handlers.onRequestPost(createContext(new Request(
    "https://tensr.systems/api/admin/db",
    {
      method: "POST",
      body: JSON.stringify({
        type: "read",
        table: "user_profiles",
        columns: "user_id,role,status",
      }),
      headers: { "Content-Type": "application/json" },
    },
  )));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.deepEqual(payload.data, [{ user_id: "user-1", role: "user", status: "active" }]);
});

test("onRequestPost should execute one secured mutation with chained filters", async () => {
  const query = createQueryStub({ data: { id: "msg-1", body: "ok" } });
  const handlers = createAdminDbHandlers({
    requireAdminAccess: async () => ({
      user: { id: "admin-1", email: "admin@example.com" },
      errorResponse: null,
    }),
    createSupabaseAdmin: () => ({
      from() {
        return query.builder;
      },
    }),
  });

  const response = await handlers.onRequestPost(createContext(new Request(
    "https://tensr.systems/api/admin/db",
    {
      method: "POST",
      body: JSON.stringify({
        type: "mutation",
        table: "contact_messages",
        action: "update",
        values: { status: "read" },
        filters: [{ type: "eq", column: "id", value: "msg-1" }],
        select: "*",
        single: true,
      }),
      headers: { "Content-Type": "application/json" },
    },
  )));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.deepEqual(query.steps, [
    { method: "update", values: { status: "read" }, options: null },
    { method: "eq", column: "id", value: "msg-1" },
    { method: "select", columns: "*" },
    { method: "single" },
  ]);
});

test("onRequestPost should execute whitelisted admin RPC calls", async () => {
  const rpcCalls = [];
  const handlers = createAdminDbHandlers({
    requireAdminAccess: async () => ({
      user: { id: "admin-1", email: "admin@example.com" },
      errorResponse: null,
    }),
    createSupabaseAdmin: () => ({
      rpc(functionName, args) {
        rpcCalls.push({ functionName, args });
        return Promise.resolve({ data: { ok: true }, error: null });
      },
    }),
  });

  const response = await handlers.onRequestPost(createContext(new Request(
    "https://tensr.systems/api/admin/db",
    {
      method: "POST",
      body: JSON.stringify({
        type: "rpc",
        functionName: "admin_adjust_wallet_balance",
        args: { amount: 50, user_id: "user-1" },
      }),
      headers: { "Content-Type": "application/json" },
    },
  )));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.deepEqual(rpcCalls, [{
    functionName: "admin_adjust_wallet_balance",
    args: { amount: 50, user_id: "user-1" },
  }]);
});

test("onRequestPost should reject generic mutations on app_users", async () => {
  const handlers = createAdminDbHandlers({
    requireAdminAccess: async () => ({
      user: { id: "admin-1", email: "admin@example.com" },
      errorResponse: null,
    }),
    createSupabaseAdmin: () => ({
      from() {
        throw new Error("from should not be called for rejected mutations");
      },
    }),
  });

  const response = await handlers.onRequestPost(createContext(new Request(
    "https://tensr.systems/api/admin/db",
    {
      method: "POST",
      body: JSON.stringify({
        type: "mutation",
        table: "app_users",
        action: "update",
        values: { role: "super_admin" },
        filters: [{ type: "eq", column: "id", value: "user-1" }],
      }),
      headers: { "Content-Type": "application/json" },
    },
  )));
  const payload = await response.json();

  assert.equal(response.status, 403);
  assert.equal(payload.code, "ADB-103");
});

test("onRequestPost should force safe app_users columns when a wildcard read is requested", async () => {
  const query = createQueryStub([{ id: "app-1", email: "user@example.com" }]);
  const handlers = createAdminDbHandlers({
    requireAdminAccess: async () => ({
      user: { id: "admin-1", email: "admin@example.com" },
      errorResponse: null,
    }),
    createSupabaseAdmin: () => ({
      from(table) {
        assert.equal(table, "app_users");
        return query.builder;
      },
    }),
  });

  const response = await handlers.onRequestPost(createContext(new Request(
    "https://tensr.systems/api/admin/db",
    {
      method: "POST",
      body: JSON.stringify({
        type: "read",
        table: "app_users",
        columns: "*",
      }),
      headers: { "Content-Type": "application/json" },
    },
  )));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.deepEqual(query.steps, [
    { method: "select", columns: "id,auth_user_id,full_name,email,phone,role,status,created_at,updated_at" },
  ]);
});

test("onRequestPost should reject unsafe app_users column requests", async () => {
  const handlers = createAdminDbHandlers({
    requireAdminAccess: async () => ({
      user: { id: "admin-1", email: "admin@example.com" },
      errorResponse: null,
    }),
    createSupabaseAdmin: () => ({
      from() {
        throw new Error("from should not be called for rejected app_users columns");
      },
    }),
  });

  const response = await handlers.onRequestPost(createContext(new Request(
    "https://tensr.systems/api/admin/db",
    {
      method: "POST",
      body: JSON.stringify({
        type: "read",
        table: "app_users",
        columns: "id,email,password_hash",
      }),
      headers: { "Content-Type": "application/json" },
    },
  )));
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.code, "ADB-113");
});

test("onRequestPost should reject disallowed admin tables", async () => {
  const handlers = createAdminDbHandlers({
    requireAdminAccess: async () => ({
      user: { id: "admin-1", email: "admin@example.com" },
      errorResponse: null,
    }),
    createSupabaseAdmin: () => ({
      from() {
        throw new Error("from should not be called for rejected tables");
      },
    }),
  });

  const response = await handlers.onRequestPost(createContext(new Request(
    "https://tensr.systems/api/admin/db",
    {
      method: "POST",
      body: JSON.stringify({
        type: "read",
        table: "secret_table",
        columns: "*",
      }),
      headers: { "Content-Type": "application/json" },
    },
  )));
  const payload = await response.json();

  assert.equal(response.status, 403);
  assert.equal(payload.code, "ADB-103");
});
