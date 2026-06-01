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
const ADMIN_SHELL_VERSION = "20260531-2";
const ADMIN_GATE_VERSION = "20260601-1";
const PANEL_FETCH_PATH = `/tz-panel.html?v=${ADMIN_SHELL_VERSION}`;
const ADMIN_GATE_SCRIPT_PATH = `/js/admin-gate.js?v=${ADMIN_GATE_VERSION}`;
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
body{margin:0;padding:24px;font-family:system-ui,sans-serif;background:radial-gradient(circle at top,#172554 0%,#0f172a 45%,#020617 100%);color:#cbd5e1;display:flex;align-items:center;justify-content:center;min-height:100vh;box-sizing:border-box}
.g-l{text-align:center;width:min(100%,420px)}
.g-c{background:rgba(15,23,42,.9);border:1px solid rgba(148,163,184,.2);border-radius:20px;padding:28px;box-shadow:0 24px 80px rgba(15,23,42,.45);backdrop-filter:blur(14px)}
.g-s{width:36px;height:36px;border:3px solid #1e293b;border-top-color:#6366f1;border-radius:50%;animation:r .8s linear infinite;margin:0 auto 16px}
@keyframes r{to{transform:rotate(360deg)}}
.g-t{font-size:14px;line-height:1.8;opacity:.88}
.g-d{display:none}
.g-i{font-size:48px;margin-bottom:16px}
.g-h{font-size:26px;font-weight:700;color:#f8fafc;margin-bottom:8px}
.g-f{display:grid;gap:14px;margin-top:20px;text-align:right}
.g-fl{display:block;font-size:13px;font-weight:600;color:#e2e8f0;margin-bottom:8px}
.g-in{width:100%;box-sizing:border-box;border:1px solid rgba(148,163,184,.25);border-radius:12px;background:#0f172a;color:#f8fafc;padding:13px 14px;font-size:14px;outline:none;transition:border-color .2s,box-shadow .2s}
.g-in:focus{border-color:#6366f1;box-shadow:0 0 0 3px rgba(99,102,241,.2)}
.g-in::placeholder{color:#64748b}
.g-r{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:4px}
.g-k{font-size:12px;color:#93c5fd;text-decoration:none}
.g-k:hover{text-decoration:underline}
.g-b{display:inline-flex;align-items:center;justify-content:center;gap:8px;margin-top:16px;padding:12px 20px;background:#2563eb;color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;text-decoration:none;transition:background .2s,transform .2s;width:100%}
.g-b:hover{background:#1d4ed8;transform:translateY(-1px)}
.g-b:disabled{opacity:.7;cursor:wait;transform:none}
.g-b2{background:transparent;border:1px solid rgba(148,163,184,.22);color:#e2e8f0}
.g-b2:hover{background:rgba(148,163,184,.08)}
.g-ae{margin-top:16px;padding:12px 14px;border-radius:12px;background:rgba(127,29,29,.18);border:1px solid rgba(248,113,113,.28);color:#fecaca;font-size:13px;line-height:1.8;text-align:right}
.g-e{color:#f87171}
</style>
</head>
<body>
<div class="g-l">
<div id="gateLoading" class="g-c"><div class="g-s"></div><div class="g-t" id="gateStatus">\u062C\u0627\u0631\u064A \u0627\u0644\u062A\u062D\u0642\u0642...</div></div>
<div id="gateAuth" class="g-d g-c">
<div class="g-h">\u062F\u062E\u0648\u0644 \u0644\u0648\u062D\u0629 \u0627\u0644\u062A\u062D\u0643\u0645</div>
<div class="g-t" id="gateAuthMsg">\u0633\u062C\u0651\u0644 \u062F\u062E\u0648\u0644\u0643 \u0628\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0648\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0644\u0644\u0648\u0635\u0648\u0644 \u0625\u0644\u0649 \u0627\u0644\u0644\u0648\u062D\u0629.</div>
<div id="gateAuthError" class="g-ae g-d" role="alert"></div>
<form id="gateAuthForm" class="g-f" novalidate>
<div>
<label class="g-fl" for="gateEmail">\u0627\u0644\u0628\u0631\u064A\u062F \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A</label>
<input id="gateEmail" class="g-in" name="email" type="email" dir="ltr" inputmode="email" autocomplete="username email" placeholder="admin@example.com" required>
</div>
<div>
<label class="g-fl" for="gatePassword">\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631</label>
<input id="gatePassword" class="g-in" name="password" type="password" dir="ltr" autocomplete="current-password" placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" required>
</div>
<div class="g-r">
<a href="/auth/recover" class="g-k">\u0646\u0633\u064A\u062A \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631\u061F</a>
<a href="/auth/register" class="g-k">\u0625\u0646\u0634\u0627\u0621 \u062D\u0633\u0627\u0628 \u062C\u062F\u064A\u062F</a>
</div>
<button id="gateSubmit" class="g-b" type="submit">\u062F\u062E\u0648\u0644 \u0625\u0644\u0649 \u0627\u0644\u0644\u0648\u062D\u0629</button>
</form>
</div>
<div id="gateDenied" class="g-d g-c"><div class="g-i">\u26D4</div><div class="g-t g-e" id="gateDeniedMsg"></div><a href="/" class="g-b g-b2">\u0627\u0644\u0639\u0648\u062F\u0629 \u0644\u0644\u0631\u0626\u064A\u0633\u064A\u0629</a></div>
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

