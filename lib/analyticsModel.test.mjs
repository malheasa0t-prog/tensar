import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAddToCartPayload,
  buildAnalyticsItem,
  buildAnalyticsPath,
  buildPurchasePayload,
  getPublicAnalyticsConfig,
  normalizeAnalyticsIdentifier,
  normalizeHotjarVersion,
  trackAddToCart,
  trackPageView,
  trackPurchase,
} from "./analyticsModel.js";

test("normalizeAnalyticsIdentifier should trim valid ids safely", () => {
  assert.equal(normalizeAnalyticsIdentifier("  G-123  "), "G-123");
  assert.equal(normalizeAnalyticsIdentifier(null), "");
});

test("normalizeHotjarVersion should keep a fallback when the env value is missing", () => {
  assert.equal(normalizeHotjarVersion(""), "6");
  assert.equal(normalizeHotjarVersion("  8 "), "8");
});

test("getPublicAnalyticsConfig should expose only enabled public providers", () => {
  assert.deepEqual(
    getPublicAnalyticsConfig({
      NEXT_PUBLIC_FACEBOOK_PIXEL_ID: " 12345 ",
      NEXT_PUBLIC_GA_MEASUREMENT_ID: " G-TEST ",
      NEXT_PUBLIC_HOTJAR_ID: "",
    }),
    {
      facebookPixelId: "12345",
      gaMeasurementId: "G-TEST",
      hasAnyProvider: true,
      hotjarId: "",
      hotjarVersion: "6",
    }
  );
});

test("buildAnalyticsPath should keep the query string when present", () => {
  assert.equal(buildAnalyticsPath({ pathname: "/products", search: "q=laptop" }), "/products?q=laptop");
  assert.equal(buildAnalyticsPath({ pathname: "/products", search: "?q=laptop" }), "/products?q=laptop");
});

test("buildAnalyticsItem should normalize pricing, quantity, and discount", () => {
  assert.deepEqual(
    buildAnalyticsItem({
      category: "Laptops",
      id: "p-1",
      name: "Laptop",
      originalPrice: 120,
      price: 90,
      qty: 2,
    }),
    {
      discount: 30,
      item_category: "Laptops",
      item_id: "p-1",
      item_name: "Laptop",
      price: 90,
      quantity: 2,
    }
  );
});

test("buildAddToCartPayload should calculate one normalized cart event payload", () => {
  assert.deepEqual(
    buildAddToCartPayload({
      product: { id: "p-9", name: "Mouse", price: 15.5, qty: 1 },
    }),
    {
      currency: "JOD",
      items: [
        {
          discount: 0,
          item_category: "المنتجات",
          item_id: "p-9",
          item_name: "Mouse",
          price: 15.5,
          quantity: 1,
        },
      ],
      value: 15.5,
    }
  );
});

test("buildPurchasePayload should fall back to derived totals when no explicit total is passed", () => {
  const payload = buildPurchasePayload({
    items: [
      { id: "p-1", name: "Laptop", price: 100, qty: 1 },
      { id: "p-2", name: "Mouse", price: 20, qty: 2 },
    ],
    orderId: "ord-1",
    shippingFee: 4,
  });

  assert.equal(payload.transaction_id, "ord-1");
  assert.equal(payload.value, 140);
  assert.equal(payload.shipping, 4);
  assert.equal(payload.items.length, 2);
});

test("trackPageView should fan out to the enabled browser providers", () => {
  const calls = [];
  const previousWindow = globalThis.window;

  globalThis.window = {
    document: { title: "TechZone" },
    location: { href: "https://example.com/products?q=laptop" },
    fbq: (...args) => calls.push(["fbq", ...args]),
    gtag: (...args) => calls.push(["gtag", ...args]),
    hj: (...args) => calls.push(["hj", ...args]),
  };

  try {
    const tracked = trackPageView({
      config: {
        facebookPixelId: "pixel",
        gaMeasurementId: "ga",
        hasAnyProvider: true,
        hotjarId: "hotjar",
        hotjarVersion: "6",
      },
      pathname: "/products",
      search: "q=laptop",
    });

    assert.equal(tracked, true);
    assert.equal(calls.length, 3);
    assert.deepEqual(calls[0], [
      "gtag",
      "event",
      "page_view",
      {
        page_location: "https://example.com/products?q=laptop",
        page_path: "/products?q=laptop",
        page_title: "TechZone",
      },
    ]);
    assert.deepEqual(calls[1], ["fbq", "track", "PageView"]);
    assert.deepEqual(calls[2], ["hj", "stateChange", "/products?q=laptop"]);
  } finally {
    globalThis.window = previousWindow;
  }
});

test("trackAddToCart and trackPurchase should send conversion events when providers exist", () => {
  const calls = [];
  const previousWindow = globalThis.window;

  globalThis.window = {
    fbq: (...args) => calls.push(["fbq", ...args]),
    gtag: (...args) => calls.push(["gtag", ...args]),
    hj: (...args) => calls.push(["hj", ...args]),
  };

  try {
    const config = {
      facebookPixelId: "pixel",
      gaMeasurementId: "ga",
      hasAnyProvider: true,
      hotjarId: "hotjar",
      hotjarVersion: "6",
    };

    assert.equal(
      trackAddToCart({
        config,
        product: { category: "Accessories", id: "mouse-1", name: "Gaming Mouse", price: 25, qty: 1 },
      }),
      true
    );

    assert.equal(
      trackPurchase({
        config,
        items: [{ id: "mouse-1", name: "Gaming Mouse", price: 25, qty: 2 }],
        orderId: "ord-55",
        shippingFee: 3,
        total: 53,
      }),
      true
    );

    assert.equal(calls.length, 6);
    assert.equal(calls[0][0], "gtag");
    assert.equal(calls[1][0], "fbq");
    assert.equal(calls[2][0], "hj");
    assert.equal(calls[3][0], "gtag");
    assert.equal(calls[4][0], "fbq");
    assert.equal(calls[5][0], "hj");
  } finally {
    globalThis.window = previousWindow;
  }
});
