import assert from "node:assert/strict";
import test from "node:test";

import { buildAdminGateHtml, onRequestGet } from "./admin.html.js";

test("buildAdminGateHtml should validate access through the secured admin session route", () => {
  const html = buildAdminGateHtml({
    supabaseUrl: "https://example.supabase.co",
    supabaseAnonKey: "anon-key",
  });

  assert.match(html, /\/api\/admin\/session/);
  assert.match(html, /\u062C\u0627\u0631\u064A \u0627\u0644\u062A\u062D\u0642\u0642/);
  assert.match(html, /if\(!token\)\{loadShell\(\);return;\}/);
  assert.doesNotMatch(html, /Ø/);
  assert.doesNotMatch(html, /user_profiles/);
  assert.doesNotMatch(html, /app_users/);
});

test("onRequestGet should return the hardened admin gate page", async () => {
  const response = await onRequestGet({
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    },
  });

  const html = await response.text();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store, max-age=0");
  assert.equal(response.headers.get("X-Robots-Tag"), "noindex, nofollow, noarchive");
  assert.match(html, /\/api\/admin\/session/);
});
