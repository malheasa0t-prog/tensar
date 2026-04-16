import assert from "node:assert/strict";
import test from "node:test";

import { buildAdminRuntimePayload, resolvePublicSupabaseKey, readRequiredEnvValue } from "./env.mjs";

test("readRequiredEnvValue should return the first populated value", () => {
  assert.equal(
    readRequiredEnvValue({ FIRST_KEY: "", SECOND_KEY: "value" }, ["FIRST_KEY", "SECOND_KEY"]),
    "value"
  );
});

test("resolvePublicSupabaseKey should support publishable and anon keys", () => {
  assert.equal(
    resolvePublicSupabaseKey({ NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key" }),
    "publishable-key"
  );
  assert.equal(
    resolvePublicSupabaseKey({ NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key" }),
    "anon-key"
  );
});

test("buildAdminRuntimePayload should expose public values only", () => {
  const payload = buildAdminRuntimePayload({
    ENABLE_LEGACY_ADMIN_WRITE: "true",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_demo",
    NEXT_PUBLIC_SUPABASE_URL: "https://demo.supabase.co"
  });

  assert.deepEqual(payload, {
    supabasePublishableKey: "sb_publishable_demo",
    supabaseUrl: "https://demo.supabase.co",
    writeEnabled: true
  });
});
