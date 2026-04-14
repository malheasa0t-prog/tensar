import test from "node:test";
import assert from "node:assert/strict";
import {
  SCROLL_REVEAL_DEFAULT_VARIANT,
  buildRevealClassName,
  getStaggeredRevealDelay,
  normalizeRevealVariant,
  resolveRevealDelay,
} from "./scrollRevealModel.js";

test("normalizeRevealVariant should keep supported variants only", () => {
  assert.equal(normalizeRevealVariant("slide-in-right"), "slide-in-right");
  assert.equal(normalizeRevealVariant("unknown"), SCROLL_REVEAL_DEFAULT_VARIANT);
});

test("resolveRevealDelay should sanitize invalid values", () => {
  assert.equal(resolveRevealDelay(180), "180ms");
  assert.equal(resolveRevealDelay(-12), "0ms");
  assert.equal(resolveRevealDelay("bad"), "0ms");
});

test("getStaggeredRevealDelay should build a stable stepped delay", () => {
  assert.equal(getStaggeredRevealDelay(3, 80, 40), 280);
  assert.equal(getStaggeredRevealDelay(-1, 80, -10), 0);
});

test("buildRevealClassName should compose variant and visible state classes", () => {
  assert.equal(
    buildRevealClassName("card", "zoom-in", true),
    "card scroll-reveal scroll-reveal--zoom-in is-visible"
  );
  assert.equal(
    buildRevealClassName("", "bad-variant", false),
    `scroll-reveal scroll-reveal--${SCROLL_REVEAL_DEFAULT_VARIANT}`
  );
});
