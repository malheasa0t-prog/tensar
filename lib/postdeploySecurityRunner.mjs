/**
 * Network probes for the post-deployment security checks.
 */

import tls from "node:tls";

import {
  buildProbeUrl,
  buildSourceMapProbeUrls,
  evaluateAdminProbe,
  evaluateCorsProbe,
  evaluateHeaderProbe,
  evaluateRateLimitProbe,
  evaluateSignedUrlProbe,
  extractAssetUrls,
} from "./postdeploySecurityAssessment.mjs";

const HEADER_PROBE_PATH = "/";
const SOURCE_MAP_STATUS_CODES = new Set([200, 206]);
const STATUS_FAIL = "fail";
const STATUS_PASS = "pass";
const STATUS_SKIP = "skip";
const STATUS_WARN = "warn";
const UNSIGNED_TOKEN_PARAM = "token";

/**
 * Determines whether one probe response looks like a genuine source-map file.
 *
 * @param {{ contentType: string, statusCode: number, text: string }} input - Probe response details.
 * @returns {boolean} True when the response appears to be a real source map.
 */
function isExposedSourceMapResponse(input) {
  if (!SOURCE_MAP_STATUS_CODES.has(input.statusCode)) {
    return false;
  }

  if (/text\/html/i.test(input.contentType)) {
    return false;
  }

  if (/application\/json|text\/plain|application\/octet-stream/i.test(input.contentType)) {
    return true;
  }

  const trimmedText = String(input.text || "").trim();
  return trimmedText.startsWith("{")
    && trimmedText.includes('"version"')
    && trimmedText.includes('"sources"');
}

/**
 * Converts response headers into a lower-cased plain object.
 *
 * @param {{ headers?: Headers }} input - Response metadata.
 * @returns {Record<string, string>} Case-insensitive header map.
 */
function normalizeHeaders(input) {
  return Object.fromEntries(
    Array.from(input.headers?.entries?.() || []).map(([key, value]) => [
      key.toLowerCase(),
      value,
    ])
  );
}

/**
 * Performs one HTTP probe and returns normalized metadata.
 *
 * @param {{ fetchImpl?: typeof fetch, init?: RequestInit, url: string }} input
 * @returns {Promise<{ contentType: string, headers: Record<string, string>, location: string, responseUrl: string, statusCode: number, text: string }>}
 */
async function performFetchProbe(input) {
  const response = await (input.fetchImpl || fetch)(input.url, input.init);
  const headers = normalizeHeaders({ headers: response.headers });
  const contentType = String(headers["content-type"] || "");
  const shouldReadText =
    /text\/html|application\/json|text\/plain|application\/octet-stream/i.test(contentType)
    || input.url.endsWith(".map");
  const text = shouldReadText
    ? await response.text()
    : "";

  return {
    contentType,
    headers,
    location: String(headers.location || ""),
    responseUrl: response.url || input.url,
    statusCode: response.status,
    text,
  };
}

/**
 * Opens one TLS socket and inspects the certificate metadata.
 *
 * @param {{ baseUrl: string, timeoutMs: number, tlsConnectImpl?: (input: object) => import("node:tls").TLSSocket }} input
 * @returns {Promise<{ details: string, status: string }>} TLS probe result.
 */
async function probeTls(input) {
  const url = new URL(input.baseUrl);
  if (url.protocol !== "https:") {
    return { details: "Deployment URL is not HTTPS.", status: STATUS_FAIL };
  }

  const tlsConnectImpl = input.tlsConnectImpl || ((options) => tls.connect(options));
  return new Promise((resolve) => {
    const socket = tlsConnectImpl({
      host: url.hostname,
      port: Number(url.port || 443),
      rejectUnauthorized: false,
      servername: url.hostname,
    });

    socket.setTimeout(input.timeoutMs, () => {
      socket.destroy();
      resolve({ details: "TLS handshake timed out.", status: STATUS_FAIL });
    });
    socket.once("error", (error) => {
      resolve({ details: `TLS probe failed: ${error.message}`, status: STATUS_FAIL });
    });
    socket.once("secureConnect", () => {
      const certificate = socket.getPeerCertificate();
      const protocol = socket.getProtocol?.() || "unknown";
      const isAuthorized = socket.authorized !== false || !socket.authorizationError;
      socket.end();
      resolve({
        details: isAuthorized
          ? `TLS negotiated ${protocol} with certificate subject ${certificate?.subject?.CN || "unknown"}.`
          : `TLS authorization error: ${socket.authorizationError || "unknown"}.`,
        status: isAuthorized ? STATUS_PASS : STATUS_FAIL,
      });
    });
  });
}

/**
 * Runs every supported post-deploy probe against the target deployment.
 *
 * @param {{ config: { adminPaths: string[], baseUrl: string, probeOrigin: string, rateLimitAttempts: number, rateLimitBody: Record<string, unknown>, rateLimitMethod: string, rateLimitPath: string, signedDepositProofUrl: string, timeoutMs: number }, fetchImpl?: typeof fetch, tlsConnectImpl?: (input: object) => import("node:tls").TLSSocket }} input
 * @returns {Promise<{ failingChecks: number, results: Array<{ details: string, name: string, status: string }>, warningChecks: number }>}
 */
async function runPostdeploySecurityChecks(input) {
  const config = input.config;
  const fetchImpl = input.fetchImpl || fetch;
  const results = [];
  const headerResponse = await performFetchProbe({
    fetchImpl,
    url: buildProbeUrl({ baseUrl: config.baseUrl, path: HEADER_PROBE_PATH }),
  });

  results.push({
    name: "tls",
    ...(await probeTls({
      baseUrl: config.baseUrl,
      timeoutMs: config.timeoutMs,
      tlsConnectImpl: input.tlsConnectImpl,
    })),
  });
  results.push({
    name: "headers",
    ...evaluateHeaderProbe({
      headers: headerResponse.headers,
      responseUrl: headerResponse.responseUrl,
    }),
  });
  results.push({
    name: "cors",
    ...evaluateCorsProbe({
      headers: (await performFetchProbe({
        fetchImpl,
        init: {
          headers: {
            "Access-Control-Request-Method": config.rateLimitMethod,
            Origin: config.probeOrigin,
          },
          method: "OPTIONS",
          redirect: "manual",
        },
        url: buildProbeUrl({ baseUrl: config.baseUrl, path: config.rateLimitPath }),
      })).headers,
      probeOrigin: config.probeOrigin,
    }),
  });

  const adminResults = await Promise.all(
    config.adminPaths.map(async (path) => ({
      name: `admin:${path}`,
      ...evaluateAdminProbe({
        ...(await performFetchProbe({
          fetchImpl,
          init: { redirect: "manual" },
          url: buildProbeUrl({ baseUrl: config.baseUrl, path }),
        })),
        path,
      }),
    }))
  );
  results.push(...adminResults);

  const sourceMapUrls = buildSourceMapProbeUrls({
    assetUrls: extractAssetUrls({
      baseUrl: config.baseUrl,
      html: headerResponse.text,
    }),
  });
  const exposedSourceMaps = [];
  for (const url of sourceMapUrls) {
    const response = await performFetchProbe({ fetchImpl, url });
    if (isExposedSourceMapResponse(response)) {
      exposedSourceMaps.push(url);
    }
  }
  results.push({
    details: exposedSourceMaps.length > 0
      ? `Source maps are publicly reachable: ${exposedSourceMaps.join(", ")}`
      : "No public source maps were found for discovered same-origin assets.",
    name: "source-maps",
    status: exposedSourceMaps.length > 0 ? STATUS_FAIL : STATUS_PASS,
  });

  const rateLimitResponses = [];
  for (let index = 0; index < config.rateLimitAttempts; index += 1) {
    rateLimitResponses.push(await performFetchProbe({
      fetchImpl,
      init: {
        body: JSON.stringify(config.rateLimitBody),
        headers: { "Content-Type": "application/json" },
        method: config.rateLimitMethod,
      },
      url: buildProbeUrl({ baseUrl: config.baseUrl, path: config.rateLimitPath }),
    }));
  }
  results.push({
    name: "rate-limit",
    ...evaluateRateLimitProbe({ responses: rateLimitResponses }),
  });

  if (!config.signedDepositProofUrl) {
    results.push({
      details: "Skipped because TARGET_SIGNED_DEPOSIT_PROOF_URL was not provided.",
      name: "signed-deposit-proof",
      status: STATUS_SKIP,
    });
  } else {
    const signedResponse = await performFetchProbe({
      fetchImpl,
      url: config.signedDepositProofUrl,
    });
    const unsignedUrl = new URL(config.signedDepositProofUrl);
    unsignedUrl.searchParams.delete(UNSIGNED_TOKEN_PARAM);
    unsignedUrl.search = unsignedUrl.searchParams.toString();
    const unsignedResponse = await performFetchProbe({
      fetchImpl,
      url: unsignedUrl.toString(),
    });
    results.push({
      name: "signed-deposit-proof",
      ...evaluateSignedUrlProbe({
        signedStatusCode: signedResponse.statusCode,
        unsignedStatusCode: unsignedResponse.statusCode,
      }),
    });
  }

  return {
    failingChecks: results.filter((result) => result.status === STATUS_FAIL).length,
    results,
    warningChecks: results.filter((result) => result.status === STATUS_WARN).length,
  };
}

export {
  performFetchProbe,
  runPostdeploySecurityChecks,
};
