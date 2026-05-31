/**
 * Signed short-lived cookie helpers for protecting the legacy admin shell.
 */

const ADMIN_SHELL_COOKIE_NAME = "tz_admin_shell";
const ADMIN_SHELL_COOKIE_TTL_HOURS = 24;
const ADMIN_SHELL_COOKIE_TTL_SECONDS = ADMIN_SHELL_COOKIE_TTL_HOURS * 60 * 60;
const ADMIN_SHELL_COOKIE_SECRET_ENV = "ADMIN_SHELL_COOKIE_SECRET";

/**
 * Encodes bytes as URL-safe base64.
 *
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function base64UrlEncode(bytes) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Encodes a string as URL-safe base64.
 *
 * @param {string} value
 * @returns {string}
 */
function base64UrlEncodeText(value) {
  return base64UrlEncode(new TextEncoder().encode(value));
}

/**
 * Decodes a URL-safe base64 string.
 *
 * @param {string} value
 * @returns {string}
 */
function base64UrlDecodeText(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  const binary = atob(padded);
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

/**
 * Resolves the signing secret from environment bindings.
 *
 * @param {Record<string, string | undefined>} env
 * @returns {string}
 */
function getAdminShellCookieSecret(env) {
  return String(env?.[ADMIN_SHELL_COOKIE_SECRET_ENV] || env?.SUPABASE_SERVICE_ROLE_KEY || "").trim();
}

/**
 * Signs a cookie payload with HMAC-SHA256.
 *
 * @param {{ env: Record<string, string | undefined>, payload: string }} input
 * @returns {Promise<string>}
 */
async function signAdminShellPayload(input) {
  const secret = getAdminShellCookieSecret(input.env);
  if (!secret) return "";

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(input.payload));
  return base64UrlEncode(new Uint8Array(signature));
}

/**
 * Compares two signature strings without short-circuiting on the first mismatch.
 *
 * @param {string} expected
 * @param {string} actual
 * @returns {boolean}
 */
function signaturesMatch(expected, actual) {
  const left = String(expected || "");
  const right = String(actual || "");
  let diff = left.length ^ right.length;
  const maxLength = Math.max(left.length, right.length);

  for (let index = 0; index < maxLength; index += 1) {
    diff |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }

  return diff === 0;
}

/**
 * Creates one signed admin-shell cookie value.
 *
 * @param {{ env: Record<string, string | undefined>, nowMs?: number, userId?: string | null }} input
 * @returns {Promise<string>}
 */
export async function createAdminShellCookieValue(input) {
  const userId = String(input?.userId || "").trim();
  const nowMs = Number.isFinite(input?.nowMs) ? Number(input.nowMs) : Date.now();
  const payload = base64UrlEncodeText(JSON.stringify({
    exp: nowMs + ADMIN_SHELL_COOKIE_TTL_SECONDS * 1000,
    sub: userId,
  }));
  const signature = await signAdminShellPayload({ env: input?.env || {}, payload });

  return signature ? `${payload}.${signature}` : "";
}

/**
 * Builds a Set-Cookie header for the signed admin-shell cookie.
 *
 * @param {{ cookieValue: string, request: Request }} input
 * @returns {string}
 */
export function buildAdminShellSetCookieHeader(input) {
  const cookieValue = String(input?.cookieValue || "").trim();
  if (!cookieValue) return "";

  const isSecure = new URL(input.request.url).protocol === "https:";
  return [
    `${ADMIN_SHELL_COOKIE_NAME}=${cookieValue}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${ADMIN_SHELL_COOKIE_TTL_SECONDS}`,
    isSecure ? "Secure" : "",
  ].filter(Boolean).join("; ");
}

/**
 * Reads the signed admin-shell cookie from one request.
 *
 * @param {Request} request
 * @returns {string}
 */
export function readAdminShellCookie(request) {
  const cookieHeader = String(request?.headers?.get?.("cookie") || "");
  const cookiePrefix = `${ADMIN_SHELL_COOKIE_NAME}=`;
  const match = cookieHeader
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(cookiePrefix));

  return match ? match.slice(cookiePrefix.length) : "";
}

/**
 * Verifies whether a request carries a valid admin-shell cookie.
 *
 * @param {{ env: Record<string, string | undefined>, nowMs?: number, request: Request }} input
 * @returns {Promise<boolean>}
 */
export async function verifyAdminShellCookie(input) {
  const cookieValue = readAdminShellCookie(input.request);
  const [payload, signature] = cookieValue.split(".");
  if (!payload || !signature) return false;

  const expectedSignature = await signAdminShellPayload({ env: input?.env || {}, payload });
  if (!expectedSignature || !signaturesMatch(expectedSignature, signature)) {
    return false;
  }

  try {
    const decoded = JSON.parse(base64UrlDecodeText(payload));
    const expiresAt = Number(decoded?.exp);
    const nowMs = Number.isFinite(input?.nowMs) ? Number(input.nowMs) : Date.now();
    return Number.isFinite(expiresAt) && expiresAt > nowMs;
  } catch (error) {
    void error;
    return false;
  }
}

export {
  ADMIN_SHELL_COOKIE_NAME,
  ADMIN_SHELL_COOKIE_SECRET_ENV,
  ADMIN_SHELL_COOKIE_TTL_HOURS,
  ADMIN_SHELL_COOKIE_TTL_SECONDS,
};
