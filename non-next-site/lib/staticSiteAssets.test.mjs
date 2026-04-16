import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAdminConfigContent,
  buildRedirectsContent,
  buildRobotsContent,
  buildSitemapContent,
  getStaticSitemapEntries
} from "./staticSiteAssets.mjs";

test("getStaticSitemapEntries should build the main public routes", () => {
  const entries = getStaticSitemapEntries("https://tensr.systems");

  assert.equal(entries[0].url, "https://tensr.systems/");
  assert.equal(entries.some((entry) => entry.url.endsWith("/products")), true);
  assert.equal(entries.some((entry) => entry.url.endsWith("/services")), true);
});

test("buildRobotsContent should include disallow rules and sitemap", () => {
  const content = buildRobotsContent("https://tensr.systems/");

  assert.match(content, /User-agent: \*/);
  assert.match(content, /Disallow: \/admin/);
  assert.match(content, /Sitemap: https:\/\/tensr\.systems\/sitemap\.xml/);
});

test("buildSitemapContent should serialize optional metadata fields", () => {
  const content = buildSitemapContent([
    {
      changeFrequency: "daily",
      lastModified: "2026-04-16T00:00:00.000Z",
      priority: 1,
      url: "https://tensr.systems/products/1"
    }
  ]);

  assert.match(content, /<loc>https:\/\/tensr\.systems\/products\/1<\/loc>/);
  assert.match(content, /<lastmod>2026-04-16T00:00:00.000Z<\/lastmod>/);
  assert.match(content, /<priority>1.0<\/priority>/);
});

test("buildAdminConfigContent should serialize the public Supabase config", () => {
  const content = buildAdminConfigContent({
    supabaseAnonKey: "sb_publishable_demo",
    supabaseUrl: "https://demo.supabase.co",
    writeEnabled: true
  });

  assert.match(content, /window\.__TZ_SUPABASE_URL = "https:\/\/demo\.supabase\.co";/);
  assert.match(content, /window\.__TZ_SUPABASE_ANON_KEY = "sb_publishable_demo";/);
  assert.match(content, /window\.__TZ_LEGACY_ADMIN_WRITE_ENABLED = true;/);
});

test("buildRedirectsContent should keep admin static and rewrite app routes", () => {
  const content = buildRedirectsContent();

  assert.match(content, /\/admin \/admin\.html 200/);
  assert.match(content, /\/\* \/index\.html 200/);
});
