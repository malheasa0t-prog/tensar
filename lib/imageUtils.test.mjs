import assert from "node:assert/strict";
import test from "node:test";
import { buildImageSrcSet, isOptimizableImageSrc, optimizeImageSrc } from "./imageUtils.js";

test("isOptimizableImageSrc should accept local assets and allowed remote hosts", () => {
  assert.equal(isOptimizableImageSrc("/banners/hero.webp"), true);
  assert.equal(
    isOptimizableImageSrc("https://images.unsplash.com/photo-1498049794561-7780e7231661?q=80&w=2670"),
    true
  );
});

test("isOptimizableImageSrc should reject unsupported protocols", () => {
  assert.equal(isOptimizableImageSrc("data:image/png;base64,abc"), false);
  assert.equal(isOptimizableImageSrc("blob:https://example.com/file"), false);
});

test("isOptimizableImageSrc should reject unsupported remote image hosts", () => {
  assert.equal(isOptimizableImageSrc("https://cdn.simpleicons.org/garena/EE4723"), false);
});

test("optimizeImageSrc should clamp Unsplash requests to storefront-friendly dimensions", () => {
  const optimized = new URL(
    optimizeImageSrc({
      quality: 80,
      src: "https://images.unsplash.com/photo-1498049794561-7780e7231661?q=90&w=2670",
      width: 1200,
    })
  );

  assert.equal(optimized.hostname, "images.unsplash.com");
  assert.equal(optimized.searchParams.get("w"), "1200");
  assert.equal(optimized.searchParams.get("q"), "80");
  assert.equal(optimized.searchParams.get("auto"), "format");
  assert.equal(optimized.searchParams.get("fit"), "crop");
  assert.equal(optimized.searchParams.get("fm"), "webp");
});

test("optimizeImageSrc should leave local and unsupported sources unchanged", () => {
  assert.equal(optimizeImageSrc({ src: "/hero.webp" }), "/hero.webp");
  assert.equal(
    optimizeImageSrc({ src: "https://example.com/banner.jpg" }),
    "https://example.com/banner.jpg"
  );
});

test("buildImageSrcSet returns responsive variants for Unsplash", () => {
  const srcSet = buildImageSrcSet({ src: "https://images.unsplash.com/photo-1" });
  assert.match(srcSet, /320w/);
  assert.match(srcSet, /1600w/);
  assert.match(srcSet, /fm=webp/);
});

test("buildImageSrcSet returns empty for non-transformable sources", () => {
  assert.equal(buildImageSrcSet({ src: "/local/banner.webp" }), "");
  assert.equal(buildImageSrcSet({ src: "https://example.com/x.jpg" }), "");
});
