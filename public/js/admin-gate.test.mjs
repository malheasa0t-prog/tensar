import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ADMIN_GATE_SCRIPT = path.join(PROJECT_ROOT, "public/js/admin-gate.js");

/**
 * Waits for chained promise callbacks scheduled by the browser gate script.
 *
 * @returns {Promise<void>}
 */
function flushGatePromises() {
  return new Promise((resolve) => setTimeout(resolve, 30));
}

/**
 * Builds a lightweight DOM node stub for the gate script tests.
 *
 * @param {Record<string, unknown>} [overrides={}]
 * @returns {Record<string, unknown>}
 */
function createNode(overrides = {}) {
  return {
    disabled: false,
    listeners: {},
    style: {},
    textContent: "",
    value: "",
    addEventListener(type, handler) {
      this.listeners[type] = handler;
    },
    focus() {
      this.focusCalled = true;
    },
    ...overrides,
  };
}

/**
 * Creates a tiny DOM facade for running the gate script in Node tests.
 *
 * @returns {{ document: Record<string, unknown>, nodes: Record<string, Record<string, unknown>> }}
 */
function createDocumentStub() {
  const nodes = {
    gateAuth: createNode(),
    gateAuthError: createNode(),
    gateAuthForm: createNode(),
    gateAuthMsg: createNode(),
    gateDenied: createNode(),
    gateDeniedMsg: createNode(),
    gateEmail: createNode(),
    gateLoading: createNode(),
    gatePassword: createNode(),
    gateStatus: createNode(),
    gateSubmit: createNode(),
  };

  return {
    document: {
      close() {},
      getElementById(id) {
        return nodes[id] || null;
      },
      open() {},
      write(html) {
        nodes.writtenHtml = html;
      },
    },
    nodes,
  };
}

/**
 * Runs the admin gate script with mocked browser dependencies.
 *
 * @param {{
 *   fetchImpl: typeof fetch,
 *   locationHref?: string,
 *   supabaseClient?: { auth: Record<string, Function> }
 * }} input
 * @returns {Promise<{ fetchCalls: Array<{ headers: Record<string, string>, url: string }>, nodes: Record<string, unknown>, supabaseClient: { auth: Record<string, Function> } }>}
 */
async function runAdminGateScript(input) {
  const scriptSource = fs.readFileSync(ADMIN_GATE_SCRIPT, "utf8");
  const { document, nodes } = createDocumentStub();
  const fetchCalls = [];
  const supabaseClient = input.supabaseClient || {
    auth: {
      getSession() {
        return Promise.resolve({ data: { session: { access_token: "admin-token" } } });
      },
      signInWithPassword() {
        return Promise.resolve({ data: { session: { access_token: "admin-token" } }, error: null });
      },
    },
  };
  const window = {
    __tzAdminGate: {
      panelPath: "/tz-panel.html?v=20260525-1",
      sessionRoute: "/api/admin/session",
      supabaseAnonKey: "anon-key",
      supabaseUrl: "https://example.supabase.co",
    },
    location: new URL(input.locationHref || "https://tensr.systems/admin.html"),
    setTimeout,
    supabase: {
      createClient() {
        return supabaseClient;
      },
    },
  };
  const context = vm.createContext({
    Date,
    Error,
    Promise,
    Response,
    URL,
    console,
    document,
    fetch(url, options = {}) {
      fetchCalls.push({ headers: options.headers || {}, url });
      return input.fetchImpl(url, options);
    },
    navigator: {},
    setTimeout,
    window,
  });

  vm.runInContext(scriptSource, context);
  await flushGatePromises();
  return { fetchCalls, nodes, supabaseClient };
}

test("admin gate should preserve panel version while appending current query params", async () => {
  const result = await runAdminGateScript({
    locationHref: "https://tensr.systems/admin.html?section=orders",
    fetchImpl(url) {
      if (url === "/api/admin/session") {
        return Promise.resolve(Response.json({ success: true, user: { id: "admin-1" } }));
      }

      return Promise.resolve(new Response("<html>ok</html>", { status: 200 }));
    },
  });

  assert.equal(result.fetchCalls[1].url, "/tz-panel.html?v=20260525-1&section=orders");
  assert.equal(result.nodes.writtenHtml, "<html>ok</html>");
});

test("admin gate should retry panel loading with the signed cookie when bearer loading fails", async () => {
  const result = await runAdminGateScript({
    fetchImpl(url, options = {}) {
      if (url === "/api/admin/session") {
        return Promise.resolve(Response.json({ success: true, user: { id: "admin-1" } }));
      }

      if (options.headers?.Authorization) {
        return Promise.resolve(new Response("Not Found", { status: 404 }));
      }

      return Promise.resolve(new Response("<html>cookie ok</html>", { status: 200 }));
    },
  });

  assert.equal(result.fetchCalls.length, 3);
  assert.equal(result.fetchCalls[1].headers.Authorization, "Bearer admin-token");
  assert.equal(result.fetchCalls[2].headers.Authorization, undefined);
  assert.equal(result.nodes.writtenHtml, "<html>cookie ok</html>");
});

test("admin gate should show the email/password form when no session exists", async () => {
  const result = await runAdminGateScript({
    fetchImpl() {
      return Promise.reject(new Error("fetch should not run without a session"));
    },
    supabaseClient: {
      auth: {
        getSession() {
          return Promise.resolve({ data: { session: null } });
        },
        signInWithPassword() {
          return Promise.resolve({ data: { session: null }, error: null });
        },
      },
    },
  });

  assert.equal(result.fetchCalls.length, 0);
  assert.equal(result.nodes.gateLoading.style.display, "none");
  assert.equal(result.nodes.gateAuth.style.display, "block");
  assert.match(result.nodes.gateAuthMsg.textContent, /لوحة التحكم/);
});

test("admin gate should sign in with email/password and load the shell for admins", async () => {
  let receivedCredentials = null;
  const result = await runAdminGateScript({
    fetchImpl(url) {
      if (url === "/api/admin/session") {
        return Promise.resolve(Response.json({ success: true, user: { id: "admin-1" } }));
      }

      return Promise.resolve(new Response("<html>admin shell</html>", { status: 200 }));
    },
    supabaseClient: {
      auth: {
        getSession() {
          return Promise.resolve({ data: { session: null } });
        },
        signInWithPassword(credentials) {
          receivedCredentials = credentials;
          return Promise.resolve({ data: { session: { access_token: "fresh-admin-token" } }, error: null });
        },
      },
    },
  });

  result.nodes.gateEmail.value = "ADMIN@EXAMPLE.COM";
  result.nodes.gatePassword.value = "Secret123!";
  await result.nodes.gateAuthForm.listeners.submit({ preventDefault() {} });
  await flushGatePromises();
  await flushGatePromises();

  assert.equal(receivedCredentials.email, "admin@example.com");
  assert.equal(receivedCredentials.password, "Secret123!");
  assert.equal(result.fetchCalls[0].url, "/api/admin/session");
  assert.equal(result.fetchCalls[0].headers.Authorization, "Bearer fresh-admin-token");
  assert.equal(result.fetchCalls[1].url, "/tz-panel.html?v=20260525-1");
  assert.equal(result.nodes.writtenHtml, "<html>admin shell</html>");
});
