import assert from "node:assert/strict";
import test from "node:test";
import { onRequest } from "./_middleware.js";

/**
 * Creates a minimal Pages middleware context for admin asset tests.
 *
 * @param {{
 *   accessAllowed?: boolean,
 *   accessStatus?: number,
 *   cookieAllowed?: boolean,
 *   cookieThrows?: boolean,
 *   url: string
 * }} input - Test context options.
 * @returns {{ context: Record<string, unknown>, calls: { cookieVerifier: number, next: number, verifier: number } }}
 */
function createMiddlewareContext({
  accessAllowed = true,
  accessStatus = 401,
  cookieAllowed = false,
  cookieThrows = false,
  url,
}) {
  const calls = { cookieVerifier: 0, next: 0, verifier: 0 };

  return {
    calls,
    context: {
      data: {
        async requireAdminAccess() {
          calls.verifier += 1;
          return accessAllowed
            ? { errorResponse: null, user: { id: "admin-1" } }
            : { errorResponse: new Response("Unauthorized", { status: accessStatus }), user: null };
        },
        async verifyAdminShellCookie() {
          calls.cookieVerifier += 1;
          if (cookieThrows) {
            throw new Error("cookie verification failed");
          }
          return cookieAllowed;
        },
      },
      env: {},
      request: new Request(url, {
        headers: { Authorization: "Bearer session-token" },
      }),
      async next() {
        calls.next += 1;
        return new Response("ok");
      },
    },
  };
}

test("middleware should hide protected admin shell assets when admin access fails", async () => {
  const { calls, context } = createMiddlewareContext({
    accessAllowed: false,
    url: "https://tensr.systems/__tz-panel.html",
  });

  const response = await onRequest(context);

  assert.equal(response.status, 404);
  assert.equal(await response.text(), "Not Found");
  assert.equal(calls.verifier, 1);
  assert.equal(calls.cookieVerifier, 1);
  assert.equal(calls.next, 0);
});

test("middleware should serve protected admin shell assets with a valid shell cookie", async () => {
  const { calls, context } = createMiddlewareContext({
    accessAllowed: false,
    cookieAllowed: true,
    url: "https://tensr.systems/__tz-panel.html",
  });

  const response = await onRequest(context);

  assert.equal(response.status, 200);
  assert.equal(await response.text(), "ok");
  assert.equal(calls.verifier, 0);
  assert.equal(calls.cookieVerifier, 1);
  assert.equal(calls.next, 1);
});

test("middleware should hide protected assets when cookie and bearer access both fail", async () => {
  const { calls, context } = createMiddlewareContext({
    accessAllowed: false,
    accessStatus: 403,
    url: "https://tensr.systems/__tz-panel.html",
  });

  const response = await onRequest(context);

  assert.equal(response.status, 404);
  assert.equal(calls.verifier, 1);
  assert.equal(calls.cookieVerifier, 1);
  assert.equal(calls.next, 0);
});

test("middleware should fail closed when shell cookie verification throws", async () => {
  const { calls, context } = createMiddlewareContext({
    accessAllowed: false,
    cookieThrows: true,
    url: "https://tensr.systems/__tz-panel.html",
  });

  const response = await onRequest(context);

  assert.equal(response.status, 404);
  assert.equal(calls.verifier, 1);
  assert.equal(calls.cookieVerifier, 1);
  assert.equal(calls.next, 0);
});

test("middleware should serve protected admin shell assets after admin access passes", async () => {
  const { calls, context } = createMiddlewareContext({
    url: "https://tensr.systems/__tz-panel.html",
  });

  const response = await onRequest(context);

  assert.equal(response.status, 200);
  assert.equal(await response.text(), "ok");
  assert.equal(response.headers.get("Cache-Control"), "private, no-store, max-age=0");
  assert.equal(calls.verifier, 1);
  assert.equal(calls.next, 1);
});

test("middleware should retire the legacy admin config asset", async () => {
  const { calls, context } = createMiddlewareContext({
    url: "https://tensr.systems/admin-config.js",
  });

  const response = await onRequest(context);

  assert.equal(response.status, 404);
  assert.equal(calls.verifier, 0);
  assert.equal(calls.next, 0);
});

test("middleware should pass through unrelated routes", async () => {
  const { calls, context } = createMiddlewareContext({
    url: "https://tensr.systems/products",
  });

  const response = await onRequest(context);

  assert.equal(response.status, 200);
  assert.equal(calls.verifier, 0);
  assert.equal(calls.next, 1);
});
