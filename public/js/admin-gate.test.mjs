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
  return new Promise((resolve) => setTimeout(resolve, 20));
}

/**
 * Creates a tiny DOM facade for running the gate script in Node tests.
 *
 * @returns {{ document: Record<string, unknown>, nodes: Record<string, Record<string, unknown>> }}
 */
function createDocumentStub() {
  const nodes = {
    gateDenied: { style: {} },
    gateDeniedMsg: { textContent: "" },
    gateLoading: { style: {} },
    gateStatus: { textContent: "" },
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
 * @param {{ fetchImpl: typeof fetch, locationHref?: string }} input - Browser mock inputs.
 * @returns {{ fetchCalls: Array<{ headers: Record<string, string>, url: string }>, nodes: Record<string, unknown> }}
 */
async function runAdminGateScript(input) {
  const scriptSource = fs.readFileSync(ADMIN_GATE_SCRIPT, "utf8");
  const { document, nodes } = createDocumentStub();
  const fetchCalls = [];
  const window = {
    __tzAdminGate: {
      panelPath: "/tz-panel.html?v=20260525-1",
      sessionRoute: "/api/admin/session",
      supabaseAnonKey: "anon-key",
      supabaseUrl: "https://example.supabase.co",
    },
    location: new URL(input.locationHref || "https://tensr.systems/admin.html"),
    supabase: {
      createClient() {
        return {
          auth: {
            getSession() {
              return Promise.resolve({ data: { session: { access_token: "admin-token" } } });
            },
          },
        };
      },
    },
  };
  const context = vm.createContext({
    Date,
    Error,
    Promise,
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
  return { fetchCalls, nodes };
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
