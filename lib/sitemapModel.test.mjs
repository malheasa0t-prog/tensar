import test from "node:test";
import assert from "node:assert/strict";
import { buildSitemapEntry, renderSitemapXml } from "./sitemapModel.js";

test("buildSitemapEntry should resolve absolute URLs", () => {
  const entry = buildSitemapEntry({
    origin: "https://techzone.example.com",
    pathname: "/products/p-1",
    lastModified: "2026-04-17T00:00:00.000Z",
    priority: 0.8,
  });

  assert.equal(entry.loc, "https://techzone.example.com/products/p-1");
  assert.equal(entry.priority, "0.8");
  assert.equal(entry.changefreq, "weekly");
});

test("renderSitemapXml should output valid XML with escaped values", () => {
  const xml = renderSitemapXml([
    {
      loc: "https://techzone.example.com/products/p-1?ref=promo&lang=ar",
      lastmod: "2026-04-17T00:00:00.000Z",
      changefreq: "weekly",
      priority: "0.7",
    },
  ]);

  assert.match(xml, /<urlset/);
  assert.match(xml, /https:\/\/techzone\.example\.com\/products\/p-1\?ref=promo&amp;lang=ar/);
  assert.match(xml, /<priority>0.7<\/priority>/);
});
