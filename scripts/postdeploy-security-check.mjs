/**
 * CLI wrapper for the live post-deployment security checks.
 */

import {
  buildPostdeployCheckConfig,
  formatPostdeployReport,
  resolvePostdeployExitCode,
  runPostdeploySecurityChecks,
} from "../lib/postdeploySecurityCheck.mjs";

/**
 * Runs the production smoke checks and exits with a CI-friendly code.
 *
 * @returns {Promise<void>} Resolves when the report has been printed.
 */
async function main() {
  try {
    const config = buildPostdeployCheckConfig();
    const report = await runPostdeploySecurityChecks({ config });
    process.stdout.write(`${formatPostdeployReport({ report })}\n`);
    process.exitCode = resolvePostdeployExitCode({
      failOnWarnings: config.failOnWarnings,
      report,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[FAIL] postdeploy-config - ${message}\n`);
    process.exitCode = 1;
  }
}

await main();
