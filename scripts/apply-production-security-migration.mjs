/**
 * Applies the production security lockdown migration through the Supabase Management API.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import {
  DEFAULT_PRODUCTION_MIGRATION_PATH,
  parseEnvFileContent,
  resolveSupabaseManagementToken,
  resolveSupabaseProjectRef,
  runSupabaseSqlQuery,
} from "../lib/productionMigrationRunner.mjs";

/**
 * Reads one text file when it exists and returns an empty string otherwise.
 *
 * @param {{ filePath: string }} input - Text file location.
 * @returns {Promise<string>} File contents or an empty string.
 */
async function readOptionalTextFile(input) {
  try {
    return await readFile(input.filePath, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return "";
    }

    throw error;
  }
}

/**
 * Resolves the merged runtime environment from process.env and .env.local.
 *
 * @param {{ cwd: string, processEnv: NodeJS.ProcessEnv }} input - Execution context.
 * @returns {Promise<Record<string, string | undefined>>} Merged environment map.
 */
async function buildRuntimeEnv(input) {
  const envFilePath = path.resolve(input.cwd, ".env.local");
  const envFileContent = await readOptionalTextFile({ filePath: envFilePath });
  return {
    ...parseEnvFileContent({ content: envFileContent }),
    ...input.processEnv,
  };
}

/**
 * Resolves the absolute migration file path from the supported inputs.
 *
 * @param {{ cwd: string, env: Record<string, string | undefined> }} input - Script inputs.
 * @returns {string} Absolute migration path.
 */
function resolveMigrationPath(input) {
  const requestedPath = String(
    input?.env?.PRODUCTION_MIGRATION_PATH || DEFAULT_PRODUCTION_MIGRATION_PATH
  ).trim();
  return path.resolve(input.cwd, requestedPath);
}

/**
 * Runs the production migration application flow.
 *
 * @returns {Promise<void>} Resolves when the migration is applied successfully.
 */
async function main() {
  const cwd = process.cwd();
  const env = await buildRuntimeEnv({ cwd, processEnv: process.env });
  const projectRef = resolveSupabaseProjectRef({ env });
  const token = resolveSupabaseManagementToken({ env });
  const migrationPath = resolveMigrationPath({ cwd, env });
  const query = await readFile(migrationPath, "utf8");

  await runSupabaseSqlQuery({ projectRef, query, token });
  process.stdout.write(
    `Applied ${path.basename(migrationPath)} to Supabase project ${projectRef}.\n`
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
