import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_PRODUCTION_MIGRATION_PATH,
  parseEnvFileContent,
  resolveSupabaseManagementToken,
  resolveSupabaseProjectRef,
  runSupabaseSqlQuery,
} from "./productionMigrationRunner.mjs";

test("parseEnvFileContent should parse dotenv key-value pairs safely", () => {
  const envMap = parseEnvFileContent({
    content: [
      "# comment",
      "NEXT_PUBLIC_SUPABASE_URL=https://bayubxlmrgkquwoutwmn.supabase.co",
      "SUPABASE_PROJECT_REF=bayubxlmrgkquwoutwmn",
    ].join("\n"),
  });

  assert.equal(
    envMap.NEXT_PUBLIC_SUPABASE_URL,
    "https://bayubxlmrgkquwoutwmn.supabase.co"
  );
  assert.equal(envMap.SUPABASE_PROJECT_REF, "bayubxlmrgkquwoutwmn");
  assert.equal(DEFAULT_PRODUCTION_MIGRATION_PATH.endsWith(".sql"), true);
});

test("resolveSupabaseProjectRef should prefer explicit env vars", () => {
  const projectRef = resolveSupabaseProjectRef({
    env: {
      SUPABASE_PROJECT_REF: "explicit-project-ref",
      TARGET_SUPABASE_PROJECT_REF: "fallback-project-ref",
    },
  });

  assert.equal(projectRef, "explicit-project-ref");
});

test("resolveSupabaseProjectRef should infer the ref from NEXT_PUBLIC_SUPABASE_URL", () => {
  const projectRef = resolveSupabaseProjectRef({
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "https://bayubxlmrgkquwoutwmn.supabase.co",
    },
  });

  assert.equal(projectRef, "bayubxlmrgkquwoutwmn");
});

test("resolveSupabaseManagementToken should prefer the explicit management token", () => {
  const token = resolveSupabaseManagementToken({
    env: {
      SUPABASE_ACCESS_TOKEN: "access-token",
      SUPABASE_MANAGEMENT_TOKEN: "management-token",
    },
  });

  assert.equal(token, "management-token");
});

test("runSupabaseSqlQuery should post the SQL migration to the management API", async () => {
  const fetchCalls = [];
  await runSupabaseSqlQuery({
    fetchImpl: async (url, init) => {
      fetchCalls.push({ init, url });
      return new Response("{}", { status: 201 });
    },
    projectRef: "bayubxlmrgkquwoutwmn",
    query: "select 1;",
    token: "token-123",
  });

  assert.equal(fetchCalls.length, 1);
  assert.equal(
    fetchCalls[0].url,
    "https://api.supabase.com/v1/projects/bayubxlmrgkquwoutwmn/database/query"
  );
  assert.equal(fetchCalls[0].init.method, "POST");
  assert.match(String(fetchCalls[0].init.headers.Authorization), /^Bearer /);
});

test("runSupabaseSqlQuery should surface API failures clearly", async () => {
  await assert.rejects(
    () => runSupabaseSqlQuery({
      fetchImpl: async () => new Response('{"message":"forbidden"}', { status: 403 }),
      projectRef: "bayubxlmrgkquwoutwmn",
      query: "select 1;",
      token: "token-123",
    }),
    /403/
  );
});
