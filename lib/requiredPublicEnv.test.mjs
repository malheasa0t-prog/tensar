import assert from "node:assert/strict";
import test from "node:test";

import {
  getMissingPublicBuildEnvKeys,
  readEnvValue,
  resolvePublicBuildEnv,
} from "./requiredPublicEnv.js";

test("readEnvValue should trim present values", () => {
  assert.equal(readEnvValue({ TEST_KEY: "  value  " }, "TEST_KEY"), "value");
});

test("getMissingPublicBuildEnvKeys should report all missing keys", () => {
  assert.deepEqual(getMissingPublicBuildEnvKeys({}), [
    "NEXT_PUBLIC_SITE_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ]);
});

test("resolvePublicBuildEnv should throw during build when keys are missing", () => {
  assert.throws(
    () => resolvePublicBuildEnv({}, "build"),
    /\[ENV-101\] Missing required public environment variables for Vite build: NEXT_PUBLIC_SITE_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY/
  );
});

test("resolvePublicBuildEnv should allow non-build commands to proceed", () => {
  assert.deepEqual(resolvePublicBuildEnv({}, "serve"), {
    siteUrl: "",
    supabaseAnonKey: "",
    supabaseUrl: "",
  });
});

test("resolvePublicBuildEnv should return both values when configured", () => {
  assert.deepEqual(
    resolvePublicBuildEnv(
      {
        NEXT_PUBLIC_SITE_URL: "https://tensr.systems",
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      },
      "build"
    ),
    {
      siteUrl: "https://tensr.systems",
      supabaseAnonKey: "anon-key",
      supabaseUrl: "https://example.supabase.co",
    }
  );
});
