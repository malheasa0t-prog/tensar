/**
 * Public entry point for the post-deployment security checks.
 */

export {
  DEFAULT_ADMIN_PATHS,
  DEFAULT_RATE_LIMIT_ATTEMPTS,
  buildPostdeployCheckConfig,
  normalizeBaseUrl,
} from "./postdeploySecurityConfig.mjs";

export {
  buildProbeUrl,
  buildSourceMapProbeUrls,
  evaluateAdminProbe,
  evaluateCorsProbe,
  evaluateHeaderProbe,
  evaluateRateLimitProbe,
  evaluateSignedUrlProbe,
  extractAssetUrls,
  formatPostdeployReport,
  resolvePostdeployExitCode,
} from "./postdeploySecurityAssessment.mjs";

export {
  performFetchProbe,
  runPostdeploySecurityChecks,
} from "./postdeploySecurityRunner.mjs";
