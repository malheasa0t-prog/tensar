/**
 * Pure assessment helpers for post-deployment security probes.
 */

const REQUIRED_SECURITY_HEADERS = Object.freeze([
  "content-security-policy",
  "strict-transport-security",
  "x-content-type-options",
  "x-frame-options",
]);
const STATUS_FAIL = "fail";
const STATUS_PASS = "pass";
const STATUS_WARN = "warn";

/**
 * Resolves one absolute URL from a deployment base URL and a route path.
 *
 * @param {{ baseUrl: string, path: string }} input - URL components.
 * @returns {string} Absolute URL string.
 */
function buildProbeUrl(input) {
  return new URL(input.path, `${input.baseUrl}/`).toString();
}

/**
 * Extracts same-origin script and stylesheet URLs from one HTML payload.
 *
 * @param {{ baseUrl: string, html: string }} input - HTML document details.
 * @returns {string[]} Same-origin asset URLs that may expose source maps.
 */
function extractAssetUrls(input) {
  const matches = input.html.matchAll(
    /\b(?:src|href)=["']([^"'?#]+\.(?:js|css)(?:\?[^"']*)?)["']/gi
  );
  const baseOrigin = new URL(input.baseUrl).origin;
  const assetUrls = new Set();

  for (const match of matches) {
    const candidate = new URL(match[1], input.baseUrl);
    if (candidate.origin === baseOrigin) assetUrls.add(candidate.toString());
  }

  return [...assetUrls];
}

/**
 * Builds probable source-map URLs from discovered asset files.
 *
 * @param {{ assetUrls: string[] }} input - Same-origin asset URLs.
 * @returns {string[]} Matching `.map` probe URLs.
 */
function buildSourceMapProbeUrls(input) {
  return input.assetUrls.map((assetUrl) => {
    const url = new URL(assetUrl);
    url.pathname = `${url.pathname}.map`;
    return url.toString();
  });
}

/**
 * Evaluates whether the primary document keeps the required headers.
 *
 * @param {{ headers: Record<string, string>, responseUrl: string }} input
 * @returns {{ details: string, status: string }} Probe result.
 */
function evaluateHeaderProbe(input) {
  const missingHeaders = REQUIRED_SECURITY_HEADERS.filter(
    (headerName) => !input.headers[headerName]
  );
  if (missingHeaders.length > 0) {
    return {
      details: `Missing required headers: ${missingHeaders.join(", ")}`,
      status: STATUS_FAIL,
    };
  }

  if (!input.responseUrl.startsWith("https://")) {
    return {
      details: `Deployment responded over non-HTTPS URL: ${input.responseUrl}`,
      status: STATUS_FAIL,
    };
  }

  return {
    details: "Required security headers are present on the primary document.",
    status: STATUS_PASS,
  };
}

/**
 * Evaluates whether the API reflects or wildcards cross-origin access.
 *
 * @param {{ headers: Record<string, string>, probeOrigin: string }} input
 * @returns {{ details: string, status: string }} Probe result.
 */
function evaluateCorsProbe(input) {
  const allowOrigin = String(input.headers["access-control-allow-origin"] || "").trim();
  if (!allowOrigin) {
    return { details: "No permissive CORS header was returned to the probe origin.", status: STATUS_PASS };
  }

  if (allowOrigin === "*" || allowOrigin === input.probeOrigin) {
    return {
      details: `CORS allows the untrusted probe origin: ${allowOrigin}`,
      status: STATUS_FAIL,
    };
  }

  return {
    details: `CORS is restricted to explicit origins (${allowOrigin}).`,
    status: STATUS_PASS,
  };
}

/**
 * Evaluates whether one admin path looks publicly reachable.
 *
 * @param {{ contentType: string, location: string, path: string, statusCode: number }} input
 * @returns {{ details: string, status: string }} Probe result.
 */
function evaluateAdminProbe(input) {
  const isLoginRedirect =
    [301, 302, 307, 308].includes(input.statusCode) &&
    /access|auth|login/i.test(input.location);
  if ([401, 403, 404].includes(input.statusCode) || isLoginRedirect) {
    return {
      details: `${input.path} is not anonymously browsable (status ${input.statusCode}).`,
      status: STATUS_PASS,
    };
  }

  if (input.statusCode === 200 && /text\/html/i.test(input.contentType)) {
    return {
      details: `${input.path} returned a public HTML document.`,
      status: STATUS_WARN,
    };
  }

  return {
    details: `${input.path} returned status ${input.statusCode}. Review access policy manually.`,
    status: STATUS_WARN,
  };
}

/**
 * Evaluates the collected rate-limit probe responses.
 *
 * @param {{ responses: Array<{ headers: Record<string, string>, statusCode: number }> }} input
 * @returns {{ details: string, status: string }} Probe result.
 */
function evaluateRateLimitProbe(input) {
  const responses = input.responses || [];
  const saw429 = responses.some((response) => response.statusCode === 429);
  const sawRetryAfter = responses.some((response) => response.headers["retry-after"]);
  const sawGuestRemaining = responses.some(
    (response) => response.headers["x-checkout-guest-remaining"]
  );
  const sawMissingBinding = responses.some((response) => response.statusCode === 503);

  if (sawMissingBinding) {
    return { details: "Rate-limit probe returned 503, which suggests a missing limiter binding.", status: STATUS_FAIL };
  }

  if (saw429 || sawRetryAfter || sawGuestRemaining) {
    return { details: "Rate limiting responded with retry metadata or an explicit block.", status: STATUS_PASS };
  }

  return {
    details: "No rate-limit evidence was observed during the probe window.",
    status: STATUS_WARN,
  };
}

/**
 * Evaluates a signed deposit-proof URL against an unsigned equivalent.
 *
 * @param {{ signedStatusCode: number, unsignedStatusCode: number }} input
 * @returns {{ details: string, status: string }} Probe result.
 */
function evaluateSignedUrlProbe(input) {
  if (input.signedStatusCode < 200 || input.signedStatusCode >= 300) {
    return { details: `Signed URL failed with status ${input.signedStatusCode}.`, status: STATUS_FAIL };
  }

  if (input.unsignedStatusCode >= 200 && input.unsignedStatusCode < 300) {
    return { details: "Unsigned deposit-proof URL is publicly accessible.", status: STATUS_FAIL };
  }

  return { details: "Signed deposit-proof URL works and the unsigned variant is blocked.", status: STATUS_PASS };
}

/**
 * Converts one report into a shell-friendly exit code.
 *
 * @param {{ failOnWarnings?: boolean, report: { failingChecks: number, warningChecks: number } }} input
 * @returns {number} Process exit code.
 */
function resolvePostdeployExitCode(input) {
  if (input.report.failingChecks > 0) return 1;
  if (input.failOnWarnings && input.report.warningChecks > 0) return 1;
  return 0;
}

/**
 * Formats one multi-line CLI summary for the collected checks.
 *
 * @param {{ report: { failingChecks: number, results: Array<{ details: string, name: string, status: string }>, warningChecks: number } }} input
 * @returns {string} Human-readable terminal output.
 */
function formatPostdeployReport(input) {
  const lines = input.report.results.map((result) => {
    const label = result.status.toUpperCase().padEnd(4, " ");
    return `[${label}] ${result.name} - ${result.details}`;
  });
  lines.push(
    "",
    `Failing checks: ${input.report.failingChecks}`,
    `Warnings: ${input.report.warningChecks}`
  );
  return lines.join("\n");
}

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
};
