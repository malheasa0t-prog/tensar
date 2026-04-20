import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDocumentTitle,
  getDefaultSiteDescription,
  getRouteSeoDefaults,
  mergeSeoMetadata,
} from "./seoRuntimeModel.js";

test("buildDocumentTitle should combine the brand name and page title", () => {
  assert.equal(
    buildDocumentTitle({ brandName: "TechZone", pageTitle: "المنتجات" }),
    "TechZone | المنتجات"
  );
});

test("getDefaultSiteDescription should prefer the hero description", () => {
  const description = getDefaultSiteDescription({
    hero: { description: "وصف الهيرو" },
    company: { slogan: "شعار بديل" },
  });

  assert.equal(description, "وصف الهيرو");
});

test("getRouteSeoDefaults should mark auth routes as noindex", () => {
  const metadata = getRouteSeoDefaults({ pathname: "/auth/login" });

  assert.equal(metadata.title, "تسجيل الدخول");
  assert.equal(metadata.robots, "noindex, nofollow");
});

test("getRouteSeoDefaults should include breadcrumb items for the contact page", () => {
  const metadata = getRouteSeoDefaults({ pathname: "/contact" });

  assert.deepEqual(metadata.breadcrumbItems, [
    { href: "/", label: "الرئيسية" },
    { label: "اتصل بنا" },
  ]);
});

test("mergeSeoMetadata should prefer page overrides without dropping structured data", () => {
  const metadata = mergeSeoMetadata({
    routeMetadata: {
      title: "المنتجات",
      description: "وصف الكتالوج",
      robots: "index, follow",
    },
    pageMetadata: {
      title: "Laptop Pro",
      structuredData: [{ "@type": "Product" }],
    },
  });

  assert.equal(metadata.title, "Laptop Pro");
  assert.equal(metadata.description, "وصف الكتالوج");
  assert.deepEqual(metadata.structuredData, [{ "@type": "Product" }]);
});
