/**
 * Cloudflare Pages Function - Admin panel gate page.
 *
 * Intercepts GET /admin.html and serves a lightweight bootstrap page that
 * loads the protected admin shell after checking the current session.
 *
 * @module functions/admin.html
 */

import { withSecurityHeaders } from "./_lib/securityHeaders.js";

const NO_CACHE_HEADERS = Object.freeze({
  "Cache-Control": "private, no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
});
const ADMIN_SESSION_ROUTE = "/api/admin/session";
const ADMIN_SHELL_VERSION = "20260530-2";
const PANEL_FETCH_PATH = `/tz-panel.html?v=${ADMIN_SHELL_VERSION}`;
const ADMIN_GATE_SCRIPT_PATH = `/js/admin-gate.js?v=${ADMIN_SHELL_VERSION}`;
const SUPABASE_CDN_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";

/**
 * Generates a cryptographically-random nonce suitable for `script-src` CSP.
 *
 * @returns {string} 128-bit base64-url nonce string.
 */
function generateAdminGateNonce() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Builds the nonce-scoped CSP for the admin gate page.
 *
 * Removes `'unsafe-inline'` from script-src — the page contains no inline
 * scripts; the config blob is injected as JSON via a type=application/json
 * tag and consumed by /js/admin-gate.js.
 *
 * @param {string} nonce - Random per-request nonce.
 * @returns {string} Content-Security-Policy header value.
 */
function buildAdminGateCsp(nonce) {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "img-src 'self' data:",
    `script-src 'self' 'nonce-${nonce}' https://cdn.jsdelivr.net`,
    "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com",
    "font-src 'self' data: https://cdnjs.cloudflare.com",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "manifest-src 'self'",
    "worker-src 'self' blob:",
  ].join("; ");
}

/**
 * Reads the public Supabase URL from environment bindings.
 *
 * @param {Record<string, string>} env - Cloudflare environment bindings.
 * @returns {string} The Supabase project URL.
 */
function getSupabaseUrl(env) {
  return String(env?.NEXT_PUBLIC_SUPABASE_URL || env?.SUPABASE_URL || "").trim();
}

/**
 * Reads the public Supabase key from environment bindings.
 *
 * @param {Record<string, string>} env - Cloudflare environment bindings.
 * @returns {string} The publishable Supabase key.
 */
function getSupabaseAnonKey(env) {
  return String(
    env?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    || env?.NEXT_PUBLIC_SUPABASE_ANON_KEY
    || env?.SUPABASE_ANON_KEY
    || ""
  ).trim();
}

/**
 * Escapes a string for safe inclusion inside a `<script type="application/json">`
 * block. The two characters we need to neutralize are `<` (so the parser can't
 * see `</script>` early) and `&` (so the decoder doesn't interpret entities).
 *
 * @param {string} value - Raw text to embed.
 * @returns {string} Encoded text safe for JSON-in-HTML embedding.
 */
function escapeJsonInHtml(value) {
  return String(value || "")
    .replace(/&/g, "\\u0026")
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/**
 * Builds the admin gate page.
 *
 * The page checks whether a session exists, then validates it through the
 * secured admin endpoint before loading the protected shell. The bootstrap
 * runs from /js/admin-gate.js so the page CSP can drop `'unsafe-inline'`.
 *
 * @param {{ nonce: string, supabaseAnonKey: string, supabaseUrl: string }} config - Runtime config.
 * @returns {string} Complete HTML gate document.
 */
export function buildAdminGateHtml({ nonce, supabaseAnonKey, supabaseUrl }) {
  const safeNonce = String(nonce || "").replace(/[^A-Za-z0-9_-]/g, "");
  const configJson = escapeJsonInHtml(JSON.stringify({
    panelPath: PANEL_FETCH_PATH,
    sessionRoute: ADMIN_SESSION_ROUTE,
    supabaseAnonKey,
    supabaseUrl,
  }));

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="robots" content="noindex,nofollow,noarchive">
<title>TechZone</title>
<style>
body{margin:0;padding:0;font-family:system-ui,sans-serif;background:#0f172a;color:#94a3b8;display:flex;align-items:center;justify-content:center;min-height:100vh}
.g-l{text-align:center;max-width:400px;padding:20px}
.g-s{width:36px;height:36px;border:3px solid #1e293b;border-top-color:#6366f1;border-radius:50%;animation:r .8s linear infinite;margin:0 auto 16px}
@keyframes r{to{transform:rotate(360deg)}}
.g-t{font-size:14px;opacity:.8}
.g-d{display:none}
.g-i{font-size:48px;margin-bottom:16px}
.g-b{display:inline-block;margin-top:16px;padding:10px 24px;background:#6366f1;color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer;text-decoration:none;transition:background .2s}
.g-b:hover{background:#4f46e5}
.g-e{color:#f87171}
</style>
</head>
<body>
<div class="g-l">
<div id="gateLoading"><div class="g-s"></div><div class="g-t" id="gateStatus">\u062C\u0627\u0631\u064A \u0627\u0644\u062A\u062D\u0642\u0642...</div></div>
<div id="gateDenied" class="g-d"><div class="g-i">\u26D4</div><div class="g-t g-e" id="gateDeniedMsg"></div><a href="/" class="g-b">\u0627\u0644\u0639\u0648\u062F\u0629 \u0644\u0644\u0631\u0626\u064A\u0633\u064A\u0629</a></div>
</div>
<script id="tzAdminGateConfig" type="application/json" nonce="${safeNonce}">${configJson}</script>
<script nonce="${safeNonce}">
  (function () {
    var node = document.getElementById("tzAdminGateConfig");
    try {
      window.__tzAdminGate = node ? JSON.parse(node.textContent || "{}") : {};
    } catch (parseError) {
      window.__tzAdminGate = {};
    }
    window.__tzAdminSupabaseLoaded = false;
    window.__tzAdminSupabaseLoadFailed = false;
  })();
</script>
<script src="${SUPABASE_CDN_URL}" defer nonce="${safeNonce}"></script>
<script src="${ADMIN_GATE_SCRIPT_PATH}" defer nonce="${safeNonce}"></script>
</body>
</html>`;
}

/**
 * Handles GET /admin.html by returning the hardened gate page.
 *
 * The response carries a per-request CSP nonce and a strict `script-src` so
 * the gate page cannot execute unexpected inline scripts even if an upstream
 * proxy injects them.
 *
 * @param {EventContext} context - Cloudflare Pages function context.
 * @returns {Response} HTML response for the admin gate page.
 */
export function onRequestGet(context) {
  const env = context?.env ?? {};
  const nonce = generateAdminGateNonce();
  const html = buildAdminGateHtml({
    nonce,
    supabaseAnonKey: getSupabaseAnonKey(env),
    supabaseUrl: getSupabaseUrl(env),
  });

  const responseHeaders = {
    ...NO_CACHE_HEADERS,
    "Content-Security-Policy": buildAdminGateCsp(nonce),
  };

  return withSecurityHeaders(
    new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        ...responseHeaders,
      },
    }),
    responseHeaders
  );
}

/**
 * Blocks unsupported methods on the admin gate route.
 *
 * @returns {Response} Not-found response.
 */
function buildNotFoundResponse() {
  return new Response("Not Found", { status: 404 });
}

export function onRequestPost() {
  return buildNotFoundResponse();
}

export function onRequestPut() {
  return buildNotFoundResponse();
}

export function onRequestDelete() {
  return buildNotFoundResponse();
}
