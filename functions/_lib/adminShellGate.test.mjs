import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateAdminShellAccess,
  getAdminShellAccessMode,
  getAllowedAdminShellDomains,
  getAllowedAdminShellEmails,
  normalizeAdminShellAccessMode,
} from "./adminShellGate.js";
import {
  buildDeniedAdminShellResponse,
  handleAdminShellRequest,
} from "./adminShellHandler.js";

/**
 * Creates one request with an optional Cloudflare Access email header.
 *
 * @param {{ email?: string, path?: string }} input - Request details.
 * @returns {Request} Test request object.
 */
function buildRequest(input = {}) {
  const headers = new Headers();
  if (input.email) {
    headers.set("cf-access-authenticated-user-email", input.email);
  }

  return new Request(`https://tensr.systems${input.path || "/admin"}`, { headers });
}

test("normalizeAdminShellAccessMode should fail closed when mode is missing", () => {
  assert.equal(normalizeAdminShellAccessMode(""), "deny");
  assert.equal(getAdminShellAccessMode({}), "deny");
});

test("normalizeAdminShellAccessMode should fail closed when mode is invalid", () => {
  assert.equal(normalizeAdminShellAccessMode("unexpected"), "deny");
});

test("normalizeAdminShellAccessMode should honor explicit public opt-in for development", () => {
  assert.equal(normalizeAdminShellAccessMode("public"), "public");
});

test("getAllowedAdminShellEmails should parse the configured allowlist", () => {
  assert.deepEqual(
    getAllowedAdminShellEmails({
      ADMIN_SHELL_ALLOWED_EMAILS: "Admin@Example.com, ops@example.com  ",
    }),
    ["admin@example.com", "ops@example.com"]
  );
});

test("getAllowedAdminShellDomains should parse the configured domain allowlist", () => {
  assert.deepEqual(
    getAllowedAdminShellDomains({
      ADMIN_SHELL_ALLOWED_DOMAINS: "Example.com,staff.example.org ",
    }),
    ["example.com", "staff.example.org"]
  );
});

test("evaluateAdminShellAccess should deny by default when no mode is configured", () => {
  const result = evaluateAdminShellAccess({ request: buildRequest() });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, "deny_mode");
});

test("evaluateAdminShellAccess should allow when public mode is explicitly opted in", () => {
  const result = evaluateAdminShellAccess({
    env: { ADMIN_SHELL_ACCESS_MODE: "public" },
    request: buildRequest(),
  });
  assert.equal(result.allowed, true);
  assert.equal(result.reason, "public_mode");
});

test("evaluateAdminShellAccess should deny when cf-access mode lacks an authenticated email", () => {
  const result = evaluateAdminShellAccess({
    env: { ADMIN_SHELL_ACCESS_MODE: "cf-access" },
    request: buildRequest(),
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reason, "missing_cf_access_email");
});

test("evaluateAdminShellAccess should allow any Access-authenticated email when no allowlist is configured", () => {
  const result = evaluateAdminShellAccess({
    env: { ADMIN_SHELL_ACCESS_MODE: "cf-access" },
    request: buildRequest({ email: "admin@example.com" }),
  });

  assert.equal(result.allowed, true);
  assert.equal(result.reason, "cf_access_allowed");
});

test("evaluateAdminShellAccess should enforce the configured email allowlist", () => {
  const deniedResult = evaluateAdminShellAccess({
    env: {
      ADMIN_SHELL_ACCESS_MODE: "cf-access",
      ADMIN_SHELL_ALLOWED_EMAILS: "ops@example.com",
    },
    request: buildRequest({ email: "admin@example.com" }),
  });
  const allowedResult = evaluateAdminShellAccess({
    env: {
      ADMIN_SHELL_ACCESS_MODE: "cf-access",
      ADMIN_SHELL_ALLOWED_EMAILS: "ops@example.com,admin@example.com",
    },
    request: buildRequest({ email: "admin@example.com" }),
  });

  assert.equal(deniedResult.allowed, false);
  assert.equal(deniedResult.reason, "email_not_allowed");
  assert.equal(allowedResult.allowed, true);
});

test("evaluateAdminShellAccess should enforce the configured domain allowlist", () => {
  const deniedResult = evaluateAdminShellAccess({
    env: {
      ADMIN_SHELL_ACCESS_MODE: "cf-access",
      ADMIN_SHELL_ALLOWED_DOMAINS: "staff.example.org",
    },
    request: buildRequest({ email: "admin@example.com" }),
  });
  const allowedResult = evaluateAdminShellAccess({
    env: {
      ADMIN_SHELL_ACCESS_MODE: "cf-access",
      ADMIN_SHELL_ALLOWED_DOMAINS: "example.com",
    },
    request: buildRequest({ email: "admin@example.com" }),
  });

  assert.equal(deniedResult.allowed, false);
  assert.equal(deniedResult.reason, "domain_not_allowed");
  assert.equal(allowedResult.allowed, true);
});

test("buildDeniedAdminShellResponse should return a hardened not-found response", async () => {
  const response = buildDeniedAdminShellResponse();

  assert.equal(response.status, 404);
  assert.equal(response.headers.get("Cache-Control"), "no-store, max-age=0");
  assert.equal(response.headers.get("X-Robots-Tag"), "noindex, nofollow, noarchive");
  assert.equal(response.headers.get("X-Frame-Options"), "DENY");
  assert.equal(await response.text(), "Not found");
});

test("handleAdminShellRequest should deny anonymous access when cf-access mode is enabled", async () => {
  const response = await handleAdminShellRequest({
    env: { ADMIN_SHELL_ACCESS_MODE: "cf-access" },
    next: () => Promise.resolve(new Response("ok")),
    request: buildRequest(),
  });

  assert.equal(response.status, 404);
});

test("handleAdminShellRequest should pass through and add headers for allowed access", async () => {
  const response = await handleAdminShellRequest({
    env: {
      ADMIN_SHELL_ACCESS_MODE: "cf-access",
      ADMIN_SHELL_ALLOWED_EMAILS: "admin@example.com",
    },
    next: () => Promise.resolve(new Response("<html></html>", { status: 200 })),
    request: buildRequest({ email: "admin@example.com", path: "/admin.html" }),
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store, max-age=0");
  assert.equal(response.headers.get("X-Robots-Tag"), "noindex, nofollow, noarchive");
});
