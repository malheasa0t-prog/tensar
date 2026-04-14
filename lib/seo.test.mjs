import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAbsoluteUrl,
  buildProductStructuredData,
  normalizeSiteOrigin,
  resolveMetadataImageUrls,
} from "./seo.js";

function restoreSiteUrl(previousSiteUrl) {
  if (previousSiteUrl === undefined) {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    return;
  }

  process.env.NEXT_PUBLIC_SITE_URL = previousSiteUrl;
}

test("normalizeSiteOrigin should default to https for bare domains", () => {
  assert.equal(normalizeSiteOrigin("techzone.example.com/"), "https://techzone.example.com");
});

test("buildAbsoluteUrl should combine paths with the configured site origin", () => {
  const previousSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  process.env.NEXT_PUBLIC_SITE_URL = "https://techzone.example.com";

  assert.equal(buildAbsoluteUrl("/products/123"), "https://techzone.example.com/products/123");

  restoreSiteUrl(previousSiteUrl);
});

test("resolveMetadataImageUrls should ignore data URLs and keep a fallback image", () => {
  const previousSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  process.env.NEXT_PUBLIC_SITE_URL = "https://techzone.example.com";

  assert.deepEqual(resolveMetadataImageUrls(["data:image/png;base64,abc"]), [
    "https://techzone.example.com/opengraph-image",
  ]);

  restoreSiteUrl(previousSiteUrl);
});

test("buildProductStructuredData should return Product schema with absolute URLs", () => {
  const previousSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  process.env.NEXT_PUBLIC_SITE_URL = "https://techzone.example.com";

  const schema = buildProductStructuredData({
    pathname: "/products/p-1",
    categoryName: "لابتوبات",
    product: {
      id: "p-1",
      name: "Laptop Pro",
      description: "جهاز قوي للأعمال والألعاب",
      brand: "TechZone",
      images: ["/uploads/laptop.png"],
      price: 999.99,
      quantity: 3,
    },
  });

  assert.equal(schema["@type"], "Product");
  assert.equal(schema.offers.url, "https://techzone.example.com/products/p-1");
  assert.equal(schema.offers.availability, "https://schema.org/InStock");
  assert.deepEqual(schema.image, [
    "https://techzone.example.com/uploads/laptop.png",
    "https://techzone.example.com/opengraph-image",
  ]);

  restoreSiteUrl(previousSiteUrl);
});
