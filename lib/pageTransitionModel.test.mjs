import assert from "node:assert/strict";
import test from "node:test";

import {
  PAGE_TRANSITION_ENTER_MS,
  PAGE_TRANSITION_EXIT_MS,
  buildRouteKey,
  resolveRouteTransition,
} from "./pageTransitionModel.js";

test("buildRouteKey should normalize pathname and search values", () => {
  assert.equal(buildRouteKey({ pathname: "/products", search: "category=pc" }), "/products?category=pc");
  assert.equal(buildRouteKey({ pathname: "/products", search: "?category=pc" }), "/products?category=pc");
  assert.equal(buildRouteKey({ pathname: "", search: "" }), "/");
});

test("resolveRouteTransition should intercept a plain same-origin route click", () => {
  const result = resolveRouteTransition({
    anchorAttributes: { href: "/products/laptops" },
    clickDetails: { button: 0 },
    currentRoute: "/",
    origin: "https://techzone.local",
  });

  assert.deepEqual(result, {
    shouldIntercept: true,
    destination: "/products/laptops",
  });
});

test("resolveRouteTransition should skip hash links on the current page", () => {
  const result = resolveRouteTransition({
    anchorAttributes: { href: "/products#filters" },
    clickDetails: { button: 0 },
    currentRoute: "/products",
    origin: "https://techzone.local",
  });

  assert.deepEqual(result, {
    shouldIntercept: false,
    destination: "",
  });

  assert.deepEqual(
    resolveRouteTransition({
      anchorAttributes: { href: "#filters" },
      clickDetails: { button: 0 },
      currentRoute: "/products",
      origin: "https://techzone.local",
    }),
    { shouldIntercept: false, destination: "" }
  );
});

test("resolveRouteTransition should ignore modified or external clicks", () => {
  assert.deepEqual(
    resolveRouteTransition({
      anchorAttributes: { href: "https://example.com" },
      clickDetails: { button: 0 },
      currentRoute: "/",
      origin: "https://techzone.local",
    }),
    { shouldIntercept: false, destination: "" }
  );

  assert.deepEqual(
    resolveRouteTransition({
      anchorAttributes: { href: "/contact" },
      clickDetails: { button: 0, ctrlKey: true },
      currentRoute: "/",
      origin: "https://techzone.local",
    }),
    { shouldIntercept: false, destination: "" }
  );
});

test("page transition constants should keep the expected motion timings", () => {
  assert.equal(PAGE_TRANSITION_EXIT_MS, 0);
  assert.equal(PAGE_TRANSITION_ENTER_MS, 0);
});
