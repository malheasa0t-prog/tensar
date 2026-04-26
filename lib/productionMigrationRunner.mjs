/**
 * Helpers for applying production SQL migrations through the Supabase Management API.
 */

const DEFAULT_MANAGEMENT_API_BASE_URL = "https://api.supabase.com";
const DEFAULT_PRODUCTION_MIGRATION_PATH = "db/2026-04-26-01-security-lockdown.sql";
const MANAGEMENT_TOKEN_ENV_NAMES = Object.freeze([
  "SUPABASE_MANAGEMENT_TOKEN",
  "SUPABASE_ACCESS_TOKEN",
]);
const PROJECT_REF_ENV_NAMES = Object.freeze([
  "SUPABASE_PROJECT_REF",
  "TARGET_SUPABASE_PROJECT_REF",
]);

/**
 * Parses one dotenv-style file content into a plain object.
 *
 * @param {{ content: string }} input - Raw dotenv file contents.
 * @returns {Record<string, string>} Parsed environment values.
 */
function parseEnvFileContent(input) {
  return String(input?.content || "")
    .split(/\r?\n/u)
    .reduce((envMap, line) => {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith("#")) return envMap;

      const separatorIndex = trimmedLine.indexOf("=");
      if (separatorIndex <= 0) return envMap;

      const key = trimmedLine.slice(0, separatorIndex).trim();
      const value = trimmedLine
        .slice(separatorIndex + 1)
        .trim()
        .replace(/^['"]|['"]$/gu, "");
      if (key) envMap[key] = value;
      return envMap;
    }, {});
}

/**
 * Resolves one Supabase project ref from explicit env vars or the public URL.
 *
 * @param {{ env: Record<string, string | undefined> }} input - Runtime environment.
 * @returns {string} Supabase project ref.
 * @throws {Error} When the project ref cannot be inferred safely.
 */
function resolveSupabaseProjectRef(input) {
  const env = input?.env || {};
  for (const envName of PROJECT_REF_ENV_NAMES) {
    const value = String(env[envName] || "").trim();
    if (value) return value;
  }

  const supabaseUrl = String(env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  if (!supabaseUrl) {
    throw new Error("Missing Supabase project ref. Set SUPABASE_PROJECT_REF or NEXT_PUBLIC_SUPABASE_URL.");
  }

  const hostname = new URL(supabaseUrl).hostname.trim();
  const projectRef = hostname.split(".")[0];
  if (!projectRef) {
    throw new Error("Failed to infer the Supabase project ref from NEXT_PUBLIC_SUPABASE_URL.");
  }

  return projectRef;
}

/**
 * Resolves one Supabase management token from the supported environment names.
 *
 * @param {{ env: Record<string, string | undefined> }} input - Runtime environment.
 * @returns {string} Supabase management token.
 * @throws {Error} When no management token is available.
 */
function resolveSupabaseManagementToken(input) {
  const env = input?.env || {};
  for (const envName of MANAGEMENT_TOKEN_ENV_NAMES) {
    const value = String(env[envName] || "").trim();
    if (value) return value;
  }

  throw new Error(
    "Missing Supabase management token. Set SUPABASE_MANAGEMENT_TOKEN or SUPABASE_ACCESS_TOKEN."
  );
}

/**
 * Executes one SQL query through the Supabase Management API.
 *
 * @param {{
 *   apiBaseUrl?: string,
 *   fetchImpl?: typeof fetch,
 *   projectRef: string,
 *   query: string,
 *   token: string,
 * }} input - SQL execution input.
 * @returns {Promise<void>} Resolves when the query is accepted by the API.
 * @throws {Error} When validation fails or the API rejects the query.
 */
async function runSupabaseSqlQuery(input) {
  const projectRef = String(input?.projectRef || "").trim();
  const query = String(input?.query || "").trim();
  const token = String(input?.token || "").trim();
  if (!projectRef) throw new Error("Supabase project ref is required.");
  if (!query) throw new Error("SQL query content is required.");
  if (!token) throw new Error("Supabase management token is required.");

  const requestUrl = new URL(
    `/v1/projects/${projectRef}/database/query`,
    input?.apiBaseUrl || DEFAULT_MANAGEMENT_API_BASE_URL
  ).toString();
  const response = await (input?.fetchImpl || fetch)(requestUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, read_only: false }),
  });

  if (response.ok) return;

  const failureBody = await response.text();
  throw new Error(
    `Supabase Management API rejected the migration (${response.status}): ${failureBody || "no response body"}`
  );
}

export {
  DEFAULT_PRODUCTION_MIGRATION_PATH,
  parseEnvFileContent,
  resolveSupabaseManagementToken,
  resolveSupabaseProjectRef,
  runSupabaseSqlQuery,
};
