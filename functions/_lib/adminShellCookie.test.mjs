import assert from "node:assert/strict";
import test from "node:test";
import {
  ADMIN_SHELL_COOKIE_NAME,
  ADMIN_SHELL_COOKIE_TTL_SECONDS,
  buildAdminShellSetCookieHeader,
  createAdminShellCookieValue,
  verifyAdminShellCookie,
} from "./adminShellCookie.js";

const TEST_ENV = Object.freeze({ ADMIN_SHELL_COOKIE_SECRET: "test-secret" });

test("createAdminShellCookieValue should create a verifiable signed cookie", async () => {
  const cookieValue = await createAdminShellCookieValue({
    env: TEST_ENV,
    nowMs: 1_000,
    userId: "admin-1",
  });
  const request = new Request("https://tensr.systems/__tz-panel.html", {
    headers: { Cookie: `${ADMIN_SHELL_COOKIE_NAME}=${cookieValue}` },
  });

  assert.equal(await verifyAdminShellCookie({ env: TEST_ENV, nowMs: 2_000, request }), true);
});

test("verifyAdminShellCookie should reject expired or tampered cookies", async () => {
  const cookieValue = await createAdminShellCookieValue({
    env: TEST_ENV,
    nowMs: 1_000,
    userId: "admin-1",
  });
  const expiredRequest = new Request("https://tensr.systems/__tz-panel.html", {
    headers: { Cookie: `${ADMIN_SHELL_COOKIE_NAME}=${cookieValue}` },
  });
  const tamperedRequest = new Request("https://tensr.systems/__tz-panel.html", {
    headers: { Cookie: `${ADMIN_SHELL_COOKIE_NAME}=${cookieValue.slice(0, -2)}xx` },
  });

  assert.equal(
    await verifyAdminShellCookie({
      env: TEST_ENV,
      nowMs: 1_000 + (ADMIN_SHELL_COOKIE_TTL_SECONDS * 1_000) + 1,
      request: expiredRequest,
    }),
    false
  );
  assert.equal(await verifyAdminShellCookie({ env: TEST_ENV, nowMs: 2_000, request: tamperedRequest }), false);
});

test("buildAdminShellSetCookieHeader should mark HTTPS cookies as secure", async () => {
  const cookieValue = await createAdminShellCookieValue({ env: TEST_ENV, userId: "admin-1" });
  const header = buildAdminShellSetCookieHeader({
    cookieValue,
    request: new Request("https://tensr.systems/api/admin/session"),
  });

  assert.match(header, new RegExp(`^${ADMIN_SHELL_COOKIE_NAME}=`));
  assert.match(header, /HttpOnly/);
  assert.match(header, /SameSite=Strict/);
  assert.match(header, /Secure/);
  assert.match(header, new RegExp(`Max-Age=${ADMIN_SHELL_COOKIE_TTL_SECONDS}`));
});
