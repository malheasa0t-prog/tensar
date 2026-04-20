import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAbsoluteUrl,
  buildOrganizationStructuredData,
  buildProductStructuredData,
  buildServiceStructuredData,
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

test("normalizeSiteOrigin should default to the Vite local origin when missing", () => {
  assert.equal(normalizeSiteOrigin(""), "http://localhost:5173");
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
    "https://techzone.example.com/opengraph-image.svg",
  ]);

  restoreSiteUrl(previousSiteUrl);
});

test("buildProductStructuredData should return Product schema with absolute URLs", () => {
  const previousSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  process.env.NEXT_PUBLIC_SITE_URL = "https://techzone.example.com";

  const schema = buildProductStructuredData({
    pathname: "/products/p-1",
    categoryName: "Laptops",
    product: {
      id: "p-1",
      name: "Laptop Pro",
      description: "Powerful laptop for business and gaming",
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
    "https://techzone.example.com/opengraph-image.svg",
  ]);

  restoreSiteUrl(previousSiteUrl);
});

test("buildServiceStructuredData should return Service schema with pricing details", () => {
  const previousSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  process.env.NEXT_PUBLIC_SITE_URL = "https://techzone.example.com";

  const schema = buildServiceStructuredData({
    pathname: "/services/repair-1",
    service: {
      name: "Laptop Repair",
      description: "Full hardware and software diagnostics",
      category: "Repair",
      image: "/uploads/service.png",
      price: 25,
    },
  });

  assert.equal(schema["@type"], "Service");
  assert.equal(schema.offers.url, "https://techzone.example.com/services/repair-1");
  assert.equal(schema.provider.name, "TechZone");
  assert.deepEqual(schema.image, [
    "https://techzone.example.com/uploads/service.png",
    "https://techzone.example.com/opengraph-image.svg",
  ]);

  restoreSiteUrl(previousSiteUrl);
});

test("buildOrganizationStructuredData should include contact details and sameAs links", () => {
  const previousSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  process.env.NEXT_PUBLIC_SITE_URL = "https://techzone.example.com";

  const schema = buildOrganizationStructuredData({
    siteSettings: {
      company: {
        name: "TechZone",
        email: "hello@techzone.example.com",
        phone: "+962700000000",
        address: "Amman, Jordan",
      },
      hero: {
        description: "Trusted repair and retail experience.",
      },
    },
    sameAs: ["https://facebook.com/techzone", "not-a-url"],
  });

  assert.equal(schema["@type"], "Organization");
  assert.equal(schema.url, "https://techzone.example.com/");
  assert.equal(schema.logo, "https://techzone.example.com/opengraph-image.svg");
  assert.deepEqual(schema.sameAs, ["https://facebook.com/techzone"]);

  restoreSiteUrl(previousSiteUrl);
});
