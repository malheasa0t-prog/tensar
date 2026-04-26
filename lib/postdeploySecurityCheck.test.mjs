/**
 * Unit tests for the live post-deployment security probes.
 */

import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";

import {
  DEFAULT_ADMIN_PATHS,
  buildPostdeployCheckConfig,
  buildSourceMapProbeUrls,
  evaluateAdminProbe,
  evaluateCorsProbe,
  evaluateRateLimitProbe,
  evaluateSignedUrlProbe,
  extractAssetUrls,
  formatPostdeployReport,
  normalizeBaseUrl,
  resolvePostdeployExitCode,
  runPostdeploySecurityChecks,
} from "./postdeploySecurityCheck.mjs";

/**
 * Builds a deterministic fetch stub keyed by method and URL.
 *
 * @param {{ responses: Record<string, Array<{ body?: string, headers?: Record<string, string>, status?: number }>> }} input
 * @returns {typeof fetch} Fetch-compatible stub for unit tests.
 */
function createFetchStub(input) {
  const responseMap = new Map(Object.entries(input.responses));

  return async function fetchStub(url, init = {}) {
    const method = String(init.method || "GET").toUpperCase();
    const key = `${method} ${url}`;
    const queue = responseMap.get(key);
    if (!queue || queue.length === 0) {
      throw new Error(`Unexpected request: ${key}`);
    }

    const next = queue.shift();
    const body = next.status === 204 || next.status === 205 || next.status === 304
      ? null
      : next.body || "";
    return new Response(body, {
      headers: next.headers || {},
      status: next.status || 200,
    });
  };
}

/**
 * Creates a TLS socket stub that emits a successful secure-connect event.
 *
 * @param {{ authorizationError?: string | null, authorized?: boolean, protocol?: string, subjectCn?: string }} [input]
 * @returns {(options: object) => EventEmitter & Record<string, unknown>} Test TLS connector.
 */
function createTlsConnectStub(input = {}) {
  return function tlsConnectStub() {
    const socket = new EventEmitter();
    socket.authorized = input.authorized ?? true;
    socket.authorizationError = input.authorizationError ?? null;
    socket.destroy = () => {};
    socket.end = () => {};
    socket.getPeerCertificate = () => ({ subject: { CN: input.subjectCn || "example.com" } });
    socket.getProtocol = () => input.protocol || "TLSv1.3";
    socket.setTimeout = () => {};
    queueMicrotask(() => socket.emit("secureConnect"));
    return socket;
  };
}

test("normalizeBaseUrl should trim whitespace and remove trailing slashes", () => {
  assert.equal(
    normalizeBaseUrl({ rawUrl: " https://tensr.systems/ " }),
    "https://tensr.systems"
  );
  assert.throws(() => normalizeBaseUrl({ rawUrl: "" }), /TARGET_BASE_URL is required/);
});

test("buildPostdeployCheckConfig should apply defaults and parse custom values", () => {
  const config = buildPostdeployCheckConfig({
    env: {
      POSTDEPLOY_FAIL_ON_WARNINGS: "true",
      TARGET_ADMIN_PATHS: "/admin,/secure-admin",
      TARGET_BASE_URL: "https://tensr.systems/",
      TARGET_RATE_LIMIT_ATTEMPTS: "9",
      TARGET_RATE_LIMIT_BODY: "{\"items\":[]}",
      TARGET_RATE_LIMIT_METHOD: "post",
      TARGET_RATE_LIMIT_PATH: "/api/custom-checkout",
    },
  });

  assert.deepEqual(DEFAULT_ADMIN_PATHS, ["/admin", "/admin.html"]);
  assert.deepEqual(config.adminPaths, ["/admin", "/secure-admin"]);
  assert.equal(config.baseUrl, "https://tensr.systems");
  assert.equal(config.failOnWarnings, true);
  assert.equal(config.rateLimitAttempts, 9);
  assert.equal(config.rateLimitMethod, "POST");
  assert.equal(config.rateLimitPath, "/api/custom-checkout");
  assert.deepEqual(config.rateLimitBody, { items: [] });
});

test("extractAssetUrls and buildSourceMapProbeUrls should keep same-origin assets only", () => {
  const assetUrls = extractAssetUrls({
    baseUrl: "https://tensr.systems",
    html: `
      <link rel="stylesheet" href="/assets/app.css" />
      <script src="/assets/app.js"></script>
      <script src="https://cdn.example.com/app.js"></script>
    `,
  });

  assert.deepEqual(assetUrls, [
    "https://tensr.systems/assets/app.css",
    "https://tensr.systems/assets/app.js",
  ]);
  assert.deepEqual(buildSourceMapProbeUrls({ assetUrls }), [
    "https://tensr.systems/assets/app.css.map",
    "https://tensr.systems/assets/app.js.map",
  ]);
});

test("evaluateCorsProbe should reject wildcard and reflected origins", () => {
  assert.equal(
    evaluateCorsProbe({
      headers: { "access-control-allow-origin": "*" },
      probeOrigin: "https://security-check.invalid",
    }).status,
    "fail"
  );
  assert.equal(
    evaluateCorsProbe({
      headers: { "access-control-allow-origin": "https://security-check.invalid" },
      probeOrigin: "https://security-check.invalid",
    }).status,
    "fail"
  );
  assert.equal(
    evaluateCorsProbe({
      headers: {},
      probeOrigin: "https://security-check.invalid",
    }).status,
    "pass"
  );
});

test("evaluateAdminProbe should pass blocked paths and warn on public documents", () => {
  assert.equal(
    evaluateAdminProbe({
      contentType: "text/html; charset=UTF-8",
      location: "",
      path: "/admin",
      statusCode: 403,
    }).status,
    "pass"
  );
  assert.equal(
    evaluateAdminProbe({
      contentType: "text/html; charset=UTF-8",
      location: "",
      path: "/admin",
      statusCode: 200,
    }).status,
    "warn"
  );
});

test("evaluateRateLimitProbe should classify fail, pass, and warning cases", () => {
  assert.equal(
    evaluateRateLimitProbe({
      responses: [{ headers: {}, statusCode: 503 }],
    }).status,
    "fail"
  );
  assert.equal(
    evaluateRateLimitProbe({
      responses: [{ headers: { "retry-after": "12" }, statusCode: 429 }],
    }).status,
    "pass"
  );
  assert.equal(
    evaluateRateLimitProbe({
      responses: [{ headers: {}, statusCode: 400 }],
    }).status,
    "warn"
  );
});

test("evaluateSignedUrlProbe should require the unsigned variant to fail", () => {
  assert.equal(
    evaluateSignedUrlProbe({
      signedStatusCode: 200,
      unsignedStatusCode: 403,
    }).status,
    "pass"
  );
  assert.equal(
    evaluateSignedUrlProbe({
      signedStatusCode: 200,
      unsignedStatusCode: 200,
    }).status,
    "fail"
  );
});

test("runPostdeploySecurityChecks should pass for a hardened deployment", async () => {
  const fetchStub = createFetchStub({
    responses: {
      "GET https://tensr.systems/": [
        {
          body: '<script src="/assets/app.js"></script>',
          headers: {
            "Content-Security-Policy": "default-src 'self'",
            "Content-Type": "text/html; charset=UTF-8",
            "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
          },
        },
      ],
      "OPTIONS https://tensr.systems/api/checkout": [
        {
          headers: {
            "Access-Control-Allow-Methods": "POST, OPTIONS",
          },
          status: 204,
        },
      ],
      "GET https://tensr.systems/admin": [{ headers: { "Content-Type": "text/html" }, status: 403 }],
      "GET https://tensr.systems/admin.html": [{ headers: { "Content-Type": "text/html" }, status: 403 }],
      "GET https://tensr.systems/assets/app.js.map": [{ status: 404 }],
      "POST https://tensr.systems/api/checkout": [
        { headers: { "X-Checkout-Guest-Remaining": "4" }, status: 400 },
        { headers: { "X-Checkout-Guest-Remaining": "3" }, status: 400 },
        { headers: { "X-Checkout-Guest-Remaining": "2" }, status: 400 },
        { headers: { "X-Checkout-Guest-Remaining": "1" }, status: 400 },
        { headers: { "X-Checkout-Guest-Remaining": "0", "Retry-After": "600" }, status: 429 },
        { headers: { "X-Checkout-Guest-Remaining": "0", "Retry-After": "600" }, status: 429 },
      ],
    },
  });
  const report = await runPostdeploySecurityChecks({
    config: buildPostdeployCheckConfig({
      env: { TARGET_BASE_URL: "https://tensr.systems" },
    }),
    fetchImpl: fetchStub,
    tlsConnectImpl: createTlsConnectStub(),
  });

  assert.equal(report.failingChecks, 0);
  assert.equal(report.warningChecks, 0);
  assert.match(formatPostdeployReport({ report }), /\[PASS\] headers/);
});

test("runPostdeploySecurityChecks should ignore HTML fallbacks on source-map routes", async () => {
  const fetchStub = createFetchStub({
    responses: {
      "GET https://tensr.systems/": [
        {
          body: '<script src="/assets/app.js"></script>',
          headers: {
            "Content-Security-Policy": "default-src 'self'",
            "Content-Type": "text/html; charset=UTF-8",
            "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
          },
        },
      ],
      "OPTIONS https://tensr.systems/api/checkout": [
        {
          headers: {
            "Access-Control-Allow-Methods": "POST, OPTIONS",
          },
          status: 204,
        },
      ],
      "GET https://tensr.systems/admin": [{ headers: { "Content-Type": "text/html" }, status: 403 }],
      "GET https://tensr.systems/admin.html": [{ headers: { "Content-Type": "text/html" }, status: 403 }],
      "GET https://tensr.systems/assets/app.js.map": [
        {
          body: "<!DOCTYPE html><html><body>SPA fallback</body></html>",
          headers: { "Content-Type": "text/html; charset=UTF-8" },
          status: 200,
        },
      ],
      "POST https://tensr.systems/api/checkout": [
        { headers: { "X-Checkout-Guest-Remaining": "4" }, status: 400 },
        { headers: { "X-Checkout-Guest-Remaining": "3" }, status: 400 },
        { headers: { "X-Checkout-Guest-Remaining": "2" }, status: 400 },
        { headers: { "X-Checkout-Guest-Remaining": "1" }, status: 400 },
        { headers: { "X-Checkout-Guest-Remaining": "0", "Retry-After": "60" }, status: 429 },
        { headers: { "X-Checkout-Guest-Remaining": "0", "Retry-After": "60" }, status: 429 },
      ],
    },
  });
  const report = await runPostdeploySecurityChecks({
    config: buildPostdeployCheckConfig({
      env: { TARGET_BASE_URL: "https://tensr.systems" },
    }),
    fetchImpl: fetchStub,
    tlsConnectImpl: createTlsConnectStub(),
  });

  const sourceMapResult = report.results.find((result) => result.name === "source-maps");
  assert.equal(sourceMapResult?.status, "pass");
});

test("resolvePostdeployExitCode should fail warnings only when configured", () => {
  const report = {
    failingChecks: 0,
    results: [{ details: "public admin", name: "admin:/admin", status: "warn" }],
    warningChecks: 1,
  };

  assert.equal(resolvePostdeployExitCode({ failOnWarnings: false, report }), 0);
  assert.equal(resolvePostdeployExitCode({ failOnWarnings: true, report }), 1);
});
