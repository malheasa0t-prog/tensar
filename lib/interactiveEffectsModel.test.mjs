import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMagneticOffset,
  buildParallaxOffset,
  buildPointerGlowPosition,
  clampInteractiveValue,
} from "./interactiveEffectsModel.js";

test("clampInteractiveValue should constrain values within the provided range", () => {
  assert.equal(clampInteractiveValue(20, -8, 8), 8);
  assert.equal(clampInteractiveValue(-20, -8, 8), -8);
});

test("buildMagneticOffset should stay inside the configured max offset", () => {
  const result = buildMagneticOffset({
    clientX: 210,
    clientY: 20,
    rect: { left: 100, top: 0, width: 120, height: 40 },
    maxOffset: 10,
  });

  assert.ok(result.x > 0);
  assert.ok(result.x <= 10);
  assert.equal(result.y, 0);
});

test("buildPointerGlowPosition should return pixel values", () => {
  assert.deepEqual(
    buildPointerGlowPosition({
      clientX: 150,
      clientY: 90,
      rect: { left: 100, top: 40 },
    }),
    { x: "50px", y: "50px" }
  );
});

test("buildParallaxOffset should multiply the scroll amount safely", () => {
  assert.equal(buildParallaxOffset({ scrollY: 200, multiplier: 0.08 }), 16);
});
