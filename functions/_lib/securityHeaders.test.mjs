import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSecurityHeaders,
  withSecurityHeaders,
} from "./securityHeaders.js";
import {
  onRequestGet,
  onRequestOptions,
} from "../api/admin/runtime.js";

test("buildSecurityHeaders should merge the shared baseline with custom headers", () => {
  const headers = buildSecurityHeaders({
    "Ratelimit-Policy": '"api";q=100;w=60',
  });

  assert.equal(headers["Strict-Transport-Security"], "max-age=31536000; includeSubDomains");
  assert.equal(headers["Ratelimit-Policy"], '"api";q=100;w=60');
});

test("withSecurityHeaders should preserve existing response headers", async () => {
  const response = withSecurityHeaders(
    new Response("ok", {
      headers: {
        "Content-Type": "text/plain; charset=UTF-8",
      },
    })
  );

  assert.equal(response.headers.get("Content-Type"), "text/plain; charset=UTF-8");
  assert.equal(response.headers.get("X-Frame-Options"), "DENY");
  assert.equal(response.headers.get("Strict-Transport-Security"), "max-age=31536000; includeSubDomains");
  assert.equal(await response.text(), "ok");
});

test("onRequestGet should return the public runtime config when environment values are present", async () => {
  const response = onRequestGet({
    env: {
      ENABLE_LEGACY_ADMIN_WRITE: "true",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    },
    request: new Request("https://tensr.systems/api/admin/runtime", {
      headers: { Origin: "https://tensr.systems" },
      method: "GET",
    }),
  });
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store, max-age=0");
  assert.equal(response.headers.get("X-Frame-Options"), "DENY");
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "https://tensr.systems");
  assert.deepEqual(payload, {
    success: true,
    supabaseUrl: "https://example.supabase.co",
    supabasePublishableKey: "anon-key",
    writeEnabled: false,
  });
});

test("onRequestGet should surface a missing-config error when public keys are unavailable", async () => {
  const response = onRequestGet({
    env: {},
    request: new Request("https://tensr.systems/api/admin/runtime", {
      headers: { Origin: "https://tensr.systems" },
      method: "GET",
    }),
  });
  const payload = await response.json();

  assert.equal(response.status, 503);
  assert.equal(payload.success, false);
  assert.match(
    payload.error,
    /Legacy admin runtime config is incomplete\. Missing: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY/
  );
});

test("onRequestOptions should return a secured preflight response", () => {
  const response = onRequestOptions({
    request: new Request("https://tensr.systems/api/admin/runtime", {
      headers: { Origin: "https://tensr.systems" },
      method: "OPTIONS",
    }),
  });

  assert.equal(response.status, 204);
  assert.equal(response.headers.get("Access-Control-Allow-Methods"), "GET, OPTIONS");
  assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(response.headers.get("Cache-Control"), "no-store, max-age=0");
});
