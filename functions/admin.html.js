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
 * The page checks whether a session exists, then validates it through the
 * secured admin endpoint before loading the protected shell.
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
<script>window.__tzAdminSupabaseLoaded=false;window.__tzAdminSupabaseLoadFailed=false;</script>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2" defer onload="window.__tzAdminSupabaseLoaded=true" onerror="window.__tzAdminSupabaseLoadFailed=true"></script>
<script>
(function(){
var U="${safeUrl}",K="${safeKey}",P="${safePanelPath}",S="${safeSessionRoute}";
var ADMIN_LIBRARY_TIMEOUT_MS=5000,ADMIN_LIBRARY_POLL_MS=100;
var statusNode=document.getElementById("gateStatus");
var loadingNode=document.getElementById("gateLoading");
var deniedNode=document.getElementById("gateDenied");
var deniedMsg=document.getElementById("gateDeniedMsg");
function setMessage(msg){if(statusNode){statusNode.textContent=msg;}}
function showDenied(msg){
  if(loadingNode){loadingNode.style.display="none";}
  if(deniedNode){deniedNode.style.display="block";}
  if(deniedMsg){deniedMsg.textContent=msg;}
}
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
  if(!token){showDenied("\u0644\u064A\u0633 \u0644\u062F\u064A\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 \u0627\u0644\u0648\u0635\u0648\u0644 \u0625\u0644\u0649 \u0644\u0648\u062D\u0629 \u0627\u0644\u0625\u062F\u0627\u0631\u0629.");return;}
  fetch(S,{
    method:"GET",
    credentials:"same-origin",
    headers:{
      "Accept":"application/json",
      "Authorization":"Bearer "+token
    }
  })
  .then(function(response){
    if(response.status===401){
      showDenied("\u062C\u0644\u0633\u062A\u0643 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629. \u0633\u062C\u0644 \u062F\u062E\u0648\u0644\u0643 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649.");
      return null;
    }
    if(response.status===403){
      showDenied("\u0644\u064A\u0633 \u0644\u062F\u064A\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 \u0627\u0644\u0648\u0635\u0648\u0644 \u0625\u0644\u0649 \u0644\u0648\u062D\u0629 \u0627\u0644\u0625\u062F\u0627\u0631\u0629.");
      return null;
    }
    if(!response.ok)throw new Error("session");
    return response.json();
  })
  .then(function(payload){
    if(payload===null){return;}
    if(!payload||payload.success!==true||!payload.user){
      showDenied("\u0644\u064A\u0633 \u0644\u062F\u064A\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 \u0627\u0644\u0648\u0635\u0648\u0644 \u0625\u0644\u0649 \u0644\u0648\u062D\u0629 \u0627\u0644\u0625\u062F\u0627\u0631\u0629.");
      return;
    }
    loadShell();
  })
  .catch(function(){
    setMessage("\u062A\u0639\u0630\u0631 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0644\u062C\u0644\u0633\u0629. \u0623\u0639\u062F \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629.");
  });
}
if(!U||!K){
  setMessage("\u062A\u0639\u0630\u0631 \u062A\u062D\u0645\u064A\u0644 \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0644\u0648\u062D\u0629 \u0627\u0644\u0625\u062F\u0627\u0631\u0629.");
  return;
}
function startAdminGate(){
  var client=window.supabase.createClient(U,K);
  client.auth.getSession()
    .then(function(result){
      var session=result&&result.data&&result.data.session;
      if(!session||!session.access_token){
        showDenied("\u0644\u064A\u0633 \u0644\u062F\u064A\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 \u0627\u0644\u0648\u0635\u0648\u0644 \u0625\u0644\u0649 \u0644\u0648\u062D\u0629 \u0627\u0644\u0625\u062F\u0627\u0631\u0629.");
        return;
      }
      validateAdminSession(session.access_token);
    })
    .catch(function(){showDenied("\u062A\u0639\u0630\u0631 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0644\u062C\u0644\u0633\u0629.");});
}
function waitForSupabaseLibrary(startedAt){
  if(window.supabase&&typeof window.supabase.createClient==="function"){
    startAdminGate();
    return;
  }
  if(window.__tzAdminSupabaseLoadFailed||Date.now()-startedAt>=ADMIN_LIBRARY_TIMEOUT_MS){
    showDenied("\u062A\u0639\u0630\u0631 \u062A\u062D\u0645\u064A\u0644 \u0645\u0643\u062A\u0628\u0629 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644. \u0623\u0639\u062F \u062A\u062D\u0645\u064A\u0644 \u0627\u0644\u0635\u0641\u062D\u0629.");
    return;
  }
  window.setTimeout(function(){waitForSupabaseLibrary(startedAt);},ADMIN_LIBRARY_POLL_MS);
}
waitForSupabaseLibrary(Date.now());
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
