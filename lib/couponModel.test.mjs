import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateCoupon,
  normalizeCouponCode,
  COUPON_EXPIRED,
  COUPON_EXHAUSTED,
  COUPON_INACTIVE,
  COUPON_MIN_ORDER,
} from "./couponModel.js";

const NOW = new Date("2026-05-30T00:00:00.000Z").getTime();

test("normalizeCouponCode trims and uppercases", () => {
  assert.equal(normalizeCouponCode("  save10 "), "SAVE10");
  assert.equal(normalizeCouponCode(null), "");
});

test("percentage coupon computes discount and respects max_discount cap", () => {
  const result = evaluateCoupon({
    coupon: { code: "p20", type: "percentage", value: 20, max_discount: 5, status: "active", used_count: 0 },
    subtotal: 100,
    now: NOW,
  });
  assert.equal(result.valid, true);
  assert.equal(result.discount, 5); // 20% of 100 = 20, capped at 5
  assert.equal(result.code, "P20");
});

test("fixed coupon discount cannot exceed subtotal", () => {
  const result = evaluateCoupon({
    coupon: { code: "FLAT50", type: "fixed", value: 50, status: "active", used_count: 0 },
    subtotal: 30,
    now: NOW,
  });
  assert.equal(result.valid, true);
  assert.equal(result.discount, 30);
});

test("rejects inactive, expired, exhausted, and below-min-order coupons", () => {
  assert.equal(
    evaluateCoupon({ coupon: { type: "fixed", value: 5, status: "disabled" }, subtotal: 100, now: NOW }).reason,
    COUPON_INACTIVE
  );
  assert.equal(
    evaluateCoupon({ coupon: { type: "fixed", value: 5, status: "active", expires_at: "2020-01-01T00:00:00Z" }, subtotal: 100, now: NOW }).reason,
    COUPON_EXPIRED
  );
  assert.equal(
    evaluateCoupon({ coupon: { type: "fixed", value: 5, status: "active", max_uses: 10, used_count: 10 }, subtotal: 100, now: NOW }).reason,
    COUPON_EXHAUSTED
  );
  assert.equal(
    evaluateCoupon({ coupon: { type: "fixed", value: 5, status: "active", min_order: 200 }, subtotal: 100, now: NOW }).reason,
    COUPON_MIN_ORDER
  );
});

test("null coupon or non-positive subtotal is invalid", () => {
  assert.equal(evaluateCoupon({ coupon: null, subtotal: 100, now: NOW }).valid, false);
  assert.equal(evaluateCoupon({ coupon: { type: "fixed", value: 5, status: "active" }, subtotal: 0, now: NOW }).valid, false);
});
