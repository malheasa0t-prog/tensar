import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPromoBannerSlides,
  DEFAULT_BANNER_ROTATION_INTERVAL_MS,
  getCircularBannerOffset,
  sanitizePromoBannerItems,
} from "./homePromoBanner.js";

test("sanitizePromoBannerItems should keep only complete image banners", () => {
  const banners = sanitizePromoBannerItems([
    {
      id: 1,
      image: "https://example.com/banner.jpg",
      title: "عرض خاص",
      subtitle: "خصومات قوية على أجهزة الألعاب",
      href: "/products",
    },
    {
      id: 2,
      image: "",
      title: "قصير",
      subtitle: "وصف كافٍ لكنه بلا صورة",
    },
  ]);

  assert.deepEqual(banners, [
    {
      id: "1",
      image: "https://example.com/banner.jpg",
      title: "عرض خاص",
      subtitle: "خصومات قوية على أجهزة الألعاب",
      href: "/products",
    },
  ]);
});

test("buildPromoBannerSlides should prefer client-managed banners over defaults", () => {
  const slides = buildPromoBannerSlides(
    [
      {
        image: "https://example.com/custom-banner.jpg",
        title: "بنر العميل",
        subtitle: "هذا البنر يجب أن يظهر وحده بدون صور افتراضية",
        href: "/services",
      },
    ],
    [
      {
        image: "https://example.com/default-banner.jpg",
        title: "بنر افتراضي",
        subtitle: "لن يظهر عند وجود بنرات خاصة بالعميل",
      },
    ]
  );

  assert.equal(slides.length, 1);
  assert.equal(slides[0].title, "بنر العميل");
  assert.equal(slides[0].href, "/services");
});

test("buildPromoBannerSlides should fall back to defaults when the client did not add banners", () => {
  const slides = buildPromoBannerSlides([], [
    {
      image: "https://example.com/default-banner.jpg",
      title: "بنر افتراضي",
      subtitle: "يظهر فقط عند عدم وجود بنرات مضافة",
    },
  ]);

  assert.equal(slides.length, 1);
  assert.equal(slides[0].title, "بنر افتراضي");
  assert.equal(DEFAULT_BANNER_ROTATION_INTERVAL_MS, 2000);
});

test("getCircularBannerOffset should wrap the last slide to the previous position", () => {
  assert.equal(getCircularBannerOffset(2, 0, 3), -1);
  assert.equal(getCircularBannerOffset(0, 2, 3), 1);
});

test("getCircularBannerOffset should reject indices outside the slide range", () => {
  assert.throws(
    () => getCircularBannerOffset(3, 0, 3),
    /Banner indices must exist within the slide collection/
  );
});
