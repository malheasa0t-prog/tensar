import assert from "node:assert/strict";
import test from "node:test";

import {
  buildBreadcrumbStructuredData,
  buildRouteBreadcrumbItems,
  normalizeBreadcrumbItems,
} from "./breadcrumbModel.js";

test("normalizeBreadcrumbItems should keep only labeled breadcrumb entries", () => {
  assert.deepEqual(
    normalizeBreadcrumbItems([
      { href: "/", label: "الرئيسية" },
      { href: "/services", label: "  " },
      null,
      { label: "خدمات الصيانة" },
    ]),
    [
      { href: "/", label: "الرئيسية" },
      { href: undefined, label: "خدمات الصيانة" },
    ]
  );
});

test("buildRouteBreadcrumbItems should build smart trails for service catalog routes", () => {
  assert.deepEqual(buildRouteBreadcrumbItems({ pathname: "/products" }), [
    { href: "/", label: "الرئيسية" },
    { href: "/services", label: "خدمات الصيانة" },
  ]);

  assert.deepEqual(
    buildRouteBreadcrumbItems({ pathname: "/category/gaming-laptops", currentLabel: "صيانة لابتوبات الألعاب" }),
    [
      { href: "/", label: "الرئيسية" },
      { href: "/services", label: "خدمات الصيانة" },
      { href: undefined, label: "صيانة لابتوبات الألعاب" },
    ]
  );

  assert.deepEqual(buildRouteBreadcrumbItems({ pathname: "/services/remote-support" }), [
    { href: "/", label: "الرئيسية" },
    { href: "/services", label: "خدمات الصيانة" },
    { href: undefined, label: "remote support" },
  ]);
});

test("buildRouteBreadcrumbItems should cover checkout and compare routes", () => {
  assert.deepEqual(buildRouteBreadcrumbItems({ pathname: "/checkout" }), [
    { href: "/", label: "الرئيسية" },
    { href: "/services", label: "خدمات الصيانة" },
    { href: undefined, label: "إتمام الطلب" },
  ]);

  assert.deepEqual(buildRouteBreadcrumbItems({ pathname: "/compare" }), [
    { href: "/", label: "الرئيسية" },
    { href: "/services", label: "خدمات الصيانة" },
    { href: undefined, label: "المقارنة" },
  ]);
});

test("buildBreadcrumbStructuredData should convert breadcrumbs into BreadcrumbList schema", () => {
  const previousSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  process.env.NEXT_PUBLIC_SITE_URL = "https://techzone.example.com";

  const schema = buildBreadcrumbStructuredData({
    items: [
      { href: "/", label: "الرئيسية" },
      { href: "/services", label: "خدمات الصيانة" },
      { label: "إتمام الطلب" },
    ],
    currentPath: "/checkout",
  });

  assert.equal(schema["@type"], "BreadcrumbList");
  assert.equal(schema.itemListElement[0].item, "https://techzone.example.com/");
  assert.equal(schema.itemListElement[2].item, "https://techzone.example.com/checkout");

  if (previousSiteUrl === undefined) {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  } else {
    process.env.NEXT_PUBLIC_SITE_URL = previousSiteUrl;
  }
});
