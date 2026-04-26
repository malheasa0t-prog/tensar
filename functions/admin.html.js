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
const ADMIN_SHELL_VERSION = "20260426-5";
const PANEL_FETCH_PATH = `/__tz-panel.html?v=${ADMIN_SHELL_VERSION}`;

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
 * Escapes one string for safe inline JavaScript embedding.
 *
 * @param {string} value - Raw string value.
 * @returns {string} Escaped string literal content.
 */
function escapeJsString(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/</g, "\\x3c")
    .replace(/>/g, "\\x3e");
}

/**
 * Builds the temporary admin gate page.
 *
 * The page checks whether a session exists. When it does, it validates the
 * session through the secured admin endpoint. When it does not, it still loads
 * the protected shell so the admin login overlay can be shown.
 *
 * @param {{ supabaseUrl: string, supabaseAnonKey: string }} config - Runtime config.
 * @returns {string} Complete HTML gate document.
 */
export function buildAdminGateHtml({ supabaseUrl, supabaseAnonKey }) {
  const safeUrl = escapeJsString(supabaseUrl);
  const safeKey = escapeJsString(supabaseAnonKey);
  const safePanelPath = escapeJsString(PANEL_FETCH_PATH);
  const safeSessionRoute = escapeJsString(ADMIN_SESSION_ROUTE);

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="robots" content="noindex,nofollow,noarchive">
<title>TechZone</title>
<style>
body{margin:0;padding:0;font-family:system-ui,sans-serif;background:#0f172a;color:#94a3b8;display:flex;align-items:center;justify-content:center;min-height:100vh}
.g-l{text-align:center}
.g-s{width:36px;height:36px;border:3px solid #1e293b;border-top-color:#6366f1;border-radius:50%;animation:r .8s linear infinite;margin:0 auto 16px}
@keyframes r{to{transform:rotate(360deg)}}
.g-t{font-size:14px;opacity:.8}
</style>
</head>
<body>
<div class="g-l"><div class="g-s"></div><div class="g-t" id="gateStatus">\u062C\u0627\u0631\u064A \u0627\u0644\u062A\u062D\u0642\u0642...</div></div>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script>
(function(){
var U="${safeUrl}",K="${safeKey}",P="${safePanelPath}",S="${safeSessionRoute}";
var statusNode=document.getElementById("gateStatus");
function setMessage(message){if(statusNode){statusNode.textContent=message;}}
function clearAdminShellCaches(){
  if(!("caches" in window)){return Promise.resolve();}
  return window.caches.keys()
    .then(function(keys){
      var cacheKeys=keys.filter(function(key){return String(key||"").indexOf("tz-admin-shell-")===0;});
      return Promise.all(cacheKeys.map(function(key){return window.caches.delete(key);}));
    })
    .catch(function(){return null;});
}
function unregisterAdminServiceWorkers(){
  if(!("serviceWorker" in navigator) || typeof navigator.serviceWorker.getRegistrations!=="function"){
    return Promise.resolve();
  }
  return navigator.serviceWorker.getRegistrations()
    .then(function(registrations){
      var adminRegistrations=registrations.filter(function(registration){
        var url = String(registration?.active?.scriptURL || registration?.waiting?.scriptURL || registration?.installing?.scriptURL || "");
        return url.indexOf("admin-sw.js") !== -1;
      });
      return Promise.all(adminRegistrations.map(function(registration){return registration.unregister();}));
    })
    .catch(function(){return null;});
}
function resetLegacyAdminShellState(){
  return Promise.all([clearAdminShellCaches(), unregisterAdminServiceWorkers()]).then(function(){return null;});
}
function loadShell(){
  resetLegacyAdminShellState()
    .then(function(){
      return fetch(P+window.location.search,{credentials:"same-origin"});
    })
    .then(function(response){if(!response.ok)throw new Error("panel");return response.text();})
    .then(function(html){document.open();document.write(html);document.close();})
    .catch(function(){
      setMessage("\u062A\u0639\u0630\u0631 \u062A\u062D\u0645\u064A\u0644 \u0644\u0648\u062D\u0629 \u0627\u0644\u0625\u062F\u0627\u0631\u0629. \u0623\u0639\u062F \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629.");
    });
}
function validateAdminSession(token){
  if(!token){loadShell();return;}
  fetch(S,{
    method:"GET",
    credentials:"same-origin",
    headers:{
      "Accept":"application/json",
      "Authorization":"Bearer "+token
    }
  })
  .then(function(response){
    if(response.status===401||response.status===403){loadShell();return null;}
    if(!response.ok)throw new Error("session");
    return response.json();
  })
  .then(function(payload){
    if(payload===null){return;}
    if(!payload||payload.success!==true||!payload.user){loadShell();return;}
    loadShell();
  })
  .catch(function(){loadShell();});
}
if(!U||!K){
  setMessage("\u062A\u0639\u0630\u0631 \u062A\u062D\u0645\u064A\u0644 \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0644\u0648\u062D\u0629 \u0627\u0644\u0625\u062F\u0627\u0631\u0629.");
  return;
}
if(!window.supabase||typeof window.supabase.createClient!=="function"){
  setMessage("\u062A\u0639\u0630\u0631 \u062A\u062D\u0645\u064A\u0644 \u0645\u0643\u062A\u0628\u0629 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644.");
  return;
}
var client=window.supabase.createClient(U,K);
client.auth.getSession()
  .then(function(result){
    var session=result&&result.data&&result.data.session;
    validateAdminSession(session&&session.access_token?session.access_token:"");
  })
  .catch(function(){loadShell();});
})();
</script>
</body>
</html>`;
}

/**
 * Handles GET /admin.html by returning the hardened gate page.
 *
 * @param {EventContext} context - Cloudflare Pages function context.
 * @returns {Response} HTML response for the admin gate page.
 */
export function onRequestGet(context) {
  const env = context?.env ?? {};
  const html = buildAdminGateHtml({
    supabaseAnonKey: getSupabaseAnonKey(env),
    supabaseUrl: getSupabaseUrl(env),
  });

  return withSecurityHeaders(
    new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        ...NO_CACHE_HEADERS,
      },
    }),
    NO_CACHE_HEADERS
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
