import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeSuspensePathname,
  resolveRouteSuspenseFallback,
} from "./routeSuspenseModel.js";

test("normalizeSuspensePathname should normalize empty and relative values", () => {
  assert.equal(normalizeSuspensePathname(""), "/");
  assert.equal(normalizeSuspensePathname("products"), "/products");
  assert.equal(normalizeSuspensePathname("/products/"), "/products");
});

test("resolveRouteSuspenseFallback should map the home page to the home skeleton", () => {
  assert.deepEqual(resolveRouteSuspenseFallback("/"), {
    kind: "home",
  });
});

test("resolveRouteSuspenseFallback should map dashboard routes to the dashboard skeleton", () => {
  assert.deepEqual(resolveRouteSuspenseFallback("/dashboard/orders"), {
    kind: "dashboard",
  });
});

test("resolveRouteSuspenseFallback should map catalog-like routes with matching counts", () => {
  assert.deepEqual(resolveRouteSuspenseFallback("/category/laptops"), {
    categoryCount: 4,
    kind: "catalog",
    productCount: 6,
    showCategories: true,
  });

  assert.deepEqual(resolveRouteSuspenseFallback("/services"), {
    kind: "catalog",
    productCount: 6,
  });

  assert.equal(resolveRouteSuspenseFallback("/products").kind, "screen");
  assert.equal(resolveRouteSuspenseFallback("/products/prd-1").kind, "screen");
});

test("resolveRouteSuspenseFallback should map auth routes to a compact loading screen", () => {
  assert.deepEqual(resolveRouteSuspenseFallback("/auth/login"), {
    compact: true,
    description: "يتم الآن تجهيز صفحة الحساب والتحقق من تدفق الدخول أو الاستعادة.",
    eyebrow: "الحساب",
    kind: "screen",
    title: "نجهز بوابة الدخول",
  });
});

test("resolveRouteSuspenseFallback should return the default screen for unknown routes", () => {
  assert.deepEqual(resolveRouteSuspenseFallback("/unknown-path"), {
    compact: true,
    description: "يتم تحميل الواجهة التالية مع الحفاظ على السياق البصري للمستخدم.",
    eyebrow: "جاري التحميل",
    kind: "screen",
    title: "نجهز الصفحة التالية",
  });
});
