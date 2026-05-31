import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { buildAdminGateHtml, onRequestGet } from "./admin.html.js";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_ROOTS = Object.freeze(["app", "components", "functions", "lib", "public/js/admin"]);
const TEXT_EXTENSIONS = new Set([".css", ".html", ".js", ".jsx", ".mjs"]);
const IGNORED_DIRECTORIES = new Set([".git", ".sixth", ".wrangler", "dist", "node_modules"]);
const MOJIBAKE_TRIGGER_PATTERN = /[\u00D8\u00D9\u00C3\u00C2\u00E2\u00F0\u00D0\u00C5\u00C6\u00CB\u00CA]/;

/**
 * Collects source text files under the provided project subtree.
 *
 * @param {string} relativeRoot
 * @returns {string[]}
 */
function listSourceTextFiles(relativeRoot) {
  const absoluteRoot = path.join(PROJECT_ROOT, relativeRoot);
  const entries = fs.readdirSync(absoluteRoot, { withFileTypes: true });

  return entries.flatMap((entry) => {
    const entryRelativePath = path.join(relativeRoot, entry.name);
    if (entry.isDirectory()) {
      return IGNORED_DIRECTORIES.has(entry.name) ? [] : listSourceTextFiles(entryRelativePath);
    }

    return TEXT_EXTENSIONS.has(path.extname(entry.name)) ? [entryRelativePath] : [];
  });
}

/**
 * Finds source files that still include mojibake trigger characters.
 *
 * @returns {string[]}
 */
function findMojibakeSourceFiles() {
  return SOURCE_ROOTS.flatMap((relativeRoot) => listSourceTextFiles(relativeRoot))
    .filter((relativePath) => {
      const absolutePath = path.join(PROJECT_ROOT, relativePath);
      const content = fs.readFileSync(absolutePath, "utf8").replace(/^\uFEFF/u, "");
      return MOJIBAKE_TRIGGER_PATTERN.test(content);
    })
    .sort();
}

test("buildAdminGateHtml should embed config as JSON and load gate script externally", () => {
  const html = buildAdminGateHtml({
    nonce: "test-nonce-12345",
    supabaseUrl: "https://example.supabase.co",
    supabaseAnonKey: "anon-key",
  });

  assert.match(html, /\u062C\u0627\u0631\u064A \u0627\u0644\u062A\u062D\u0642\u0642/);
  // Supabase library loads from the CDN with the nonce.
  assert.match(html, /<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@2" defer nonce="test-nonce-12345"><\/script>/);
  // External gate bootstrap is loaded \u2014 no inline business logic.
  assert.match(html, /<script src="\/js\/admin-gate\.js\?v=[^"]+" defer nonce="test-nonce-12345"><\/script>/);
  // Config blob is embedded as application/json.
  assert.match(html, /<script id="tzAdminGateConfig" type="application\/json" nonce="test-nonce-12345">/);
  assert.match(html, /\\u003cscript|panelPath|sessionRoute|supabaseAnonKey/);
  assert.match(html, /"panelPath":"\/tz-panel\.html\?v=20260531-2"/);
  assert.doesNotMatch(html, MOJIBAKE_TRIGGER_PATTERN);
  assert.doesNotMatch(html, /user_profiles/);
  assert.doesNotMatch(html, /app_users/);
});

test("buildAdminGateHtml should escape closing script tags inside the JSON config", () => {
  const html = buildAdminGateHtml({
    nonce: "abc",
    supabaseUrl: "https://example.supabase.co/</script><script>alert(1)</script>",
    supabaseAnonKey: "anon-key",
  });

  // The raw `</script>` must never appear inside the JSON blob \u2014 that would
  // break the parser and execute attacker-controlled HTML.
  assert.doesNotMatch(html, /<\/script><script>alert\(1\)<\/script>/);
  assert.match(html, /\\u003c\/script\\u003e\\u003cscript\\u003e/);
});

test("onRequestGet should return the hardened admin gate page", async () => {
  const response = await onRequestGet({
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    },
  });

  const html = await response.text();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store, max-age=0");
  assert.equal(response.headers.get("X-Robots-Tag"), "noindex, nofollow, noarchive");
  const csp = response.headers.get("Content-Security-Policy") || "";
  assert.ok(csp.includes("script-src 'self' 'nonce-"), `CSP missing nonce script-src: ${csp}`);
  assert.ok(!csp.includes("'unsafe-inline'") || !csp.match(/script-src[^;]*'unsafe-inline'/), "script-src must not include unsafe-inline");
  assert.match(html, /supabase-js@2/);
});

test("source files should not contain mojibake trigger sequences", () => {
  assert.deepEqual(findMojibakeSourceFiles(), []);
});

