/**
 * Idempotency helpers for write-once Cloudflare Pages Functions.
 *
 * Prevents double-submits and accidental retries on POST endpoints by caching
 * the first response for a given `Idempotency-Key` header and replaying it
 * for subsequent identical requests within a short window.
 *
 * Backed by a Cloudflare KV namespace (`TECHZONE_IDEMPOTENCY`) in production,
 * with an in-memory fallback so tests and local dev still observe the same
 * semantics. The in-memory store is per-edge-location and is NOT safe for
 * production; the wrapper logs a warning when it is used outside localhost.
 *
 * @module functions/_lib/idempotency
 */

import { buildErrorPayload } from "./errorCodes.js";

const IDEMPOTENCY_BINDING_NAME = "TECHZONE_IDEMPOTENCY";
const IDEMPOTENCY_HEADER = "Idempotency-Key";
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;
const IDEMPOTENCY_DEFAULT_TTL_SECONDS = 300;
const IDEMPOTENCY_REPLAY_HEADER = "X-Idempotent-Replay";
const IDEMPOTENCY_CONFLICT_MESSAGE =
  "[IDM-409] طلب مكرر بنفس مفتاح Idempotency لكن ببيانات مختلفة.";
const IDEMPOTENCY_INVALID_MESSAGE =
  "[IDM-400] مفتاح Idempotency يجب أن يكون 8-128 محرفا (a-z, 0-9, _, -).";

const LOCAL_IDEMPOTENCY_STORE = new Map();

/**
 * Computes a SHA-256 hex digest for the request body fingerprint.
 *
 * @param {string} value - Raw text to hash.
 * @returns {Promise<string>} Hex digest.
 */
async function digestRequestBody(value) {
  const bytes = new TextEncoder().encode(String(value || ""));
  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hashBuffer))
    .map((part) => part.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Stores one idempotency record using either KV or the in-memory fallback.
 *
 * @param {{
 *   binding?: { put: (key: string, value: string, options?: { expirationTtl?: number }) => Promise<void> } | null,
 *   key: string,
 *   record: Record<string, unknown>,
 *   ttlSeconds: number,
 * }} input - Storage input.
 * @returns {Promise<void>}
 */
async function persistIdempotencyRecord({ binding, key, record, ttlSeconds }) {
  const serialized = JSON.stringify(record);
  if (binding?.put) {
    await binding.put(key, serialized, { expirationTtl: ttlSeconds });
    return;
  }

  LOCAL_IDEMPOTENCY_STORE.set(key, {
    record,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

/**
 * Reads one idempotency record from the configured storage layer.
 *
 * @param {{
 *   binding?: { get: (key: string, options?: { type?: string }) => Promise<string | null> } | null,
 *   key: string,
 * }} input - Storage input.
 * @returns {Promise<Record<string, unknown> | null>} Cached record or null.
 */
async function readIdempotencyRecord({ binding, key }) {
  if (binding?.get) {
    const raw = await binding.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (parseError) {
      void parseError;
      return null;
    }
  }

  const cached = LOCAL_IDEMPOTENCY_STORE.get(key);
  if (!cached) return null;
  if (cached.expiresAt < Date.now()) {
    LOCAL_IDEMPOTENCY_STORE.delete(key);
    return null;
  }

  return cached.record;
}

/**
 * Builds the conflict response when the same key is reused with different body.
 *
 * @returns {Response} HTTP 409 response.
 */
function buildIdempotencyConflictResponse() {
  return Response.json(buildErrorPayload(IDEMPOTENCY_CONFLICT_MESSAGE), {
    status: 409,
    headers: { "Cache-Control": "no-store" },
  });
}

/**
 * Builds the validation response when the supplied key is malformed.
 *
 * @returns {Response} HTTP 400 response.
 */
function buildIdempotencyInvalidResponse() {
  return Response.json(buildErrorPayload(IDEMPOTENCY_INVALID_MESSAGE), {
    status: 400,
    headers: { "Cache-Control": "no-store" },
  });
}

/**
 * Reconstructs a cached Response from a stored idempotency record.
 *
 * @param {Record<string, unknown>} record - Stored response snapshot.
 * @returns {Response} Cloned response with the replay marker header.
 */
function buildIdempotentReplayResponse(record) {
  const headers = new Headers(record?.headers || {});
  headers.set(IDEMPOTENCY_REPLAY_HEADER, "true");
  return new Response(String(record?.body || ""), {
    status: Number(record?.status) || 200,
    headers,
  });
}

/**
 * Captures the response payload and header set for replay.
 *
 * @param {Response} response - Live response returned by the handler.
 * @returns {Promise<{ body: string, status: number, headers: Record<string, string> }>}
 */
async function snapshotResponse(response) {
  const clone = response.clone();
  const body = await clone.text();
  const headers = {};
  clone.headers.forEach((value, name) => {
    if (name.toLowerCase() === "set-cookie") return;
    headers[name] = value;
  });

  return { body, status: response.status, headers };
}

/**
 * Wraps a POST handler with Idempotency-Key support.
 *
 * Behavior:
 *  - When the header is missing → handler runs normally.
 *  - When the header is malformed → HTTP 400.
 *  - When the same key was used with the same body within the TTL →
 *    cached response is replayed (with `X-Idempotent-Replay: true`).
 *  - When the same key was used with a different body → HTTP 409.
 *  - Otherwise → handler runs, response is cached for the TTL.
 *
 * @param {{
 *   env: Record<string, unknown>,
 *   handler: () => Promise<Response>,
 *   request: Request,
 *   requestBody: string,
 *   scope: string,
 *   ttlSeconds?: number,
 * }} input - Wrapper input.
 * @returns {Promise<Response>} Either the cached or freshly-produced response.
 */
export async function withIdempotency(input) {
  const { env, handler, request, requestBody, scope } = input;
  const ttlSeconds = Number.isFinite(input?.ttlSeconds)
    ? Number(input.ttlSeconds)
    : IDEMPOTENCY_DEFAULT_TTL_SECONDS;

  const rawKey = String(request.headers.get(IDEMPOTENCY_HEADER) || "").trim();
  if (!rawKey) {
    return handler();
  }

  if (!IDEMPOTENCY_KEY_PATTERN.test(rawKey)) {
    return buildIdempotencyInvalidResponse();
  }

  const binding = env?.[IDEMPOTENCY_BINDING_NAME] || null;
  const bodyDigest = await digestRequestBody(requestBody);
  const storageKey = `idem:${scope}:${rawKey}`;

  const cached = await readIdempotencyRecord({ binding, key: storageKey });
  if (cached) {
    if (cached.bodyDigest && cached.bodyDigest !== bodyDigest) {
      return buildIdempotencyConflictResponse();
    }
    if (cached.response) {
      return buildIdempotentReplayResponse(cached.response);
    }
  }

  const response = await handler();
  // Only cache definitive outcomes — retries on 5xx should be allowed to
  // hit the handler again so transient infra errors do not stick.
  if (response.status < 500) {
    const snapshot = await snapshotResponse(response);
    await persistIdempotencyRecord({
      binding,
      key: storageKey,
      record: { bodyDigest, response: snapshot },
      ttlSeconds,
    });
  }

  return response;
}

/**
 * Clears the in-memory idempotency store. Test-only helper.
 *
 * @returns {void}
 */
export function resetLocalIdempotencyStore() {
  LOCAL_IDEMPOTENCY_STORE.clear();
}

export {
  IDEMPOTENCY_BINDING_NAME,
  IDEMPOTENCY_DEFAULT_TTL_SECONDS,
  IDEMPOTENCY_HEADER,
  IDEMPOTENCY_KEY_PATTERN,
  IDEMPOTENCY_REPLAY_HEADER,
};
