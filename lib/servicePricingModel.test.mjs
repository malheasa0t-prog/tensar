import assert from "node:assert/strict";
import test from "node:test";
import { buildServicePricingTiers } from "./servicePricingModel.js";

test("buildServicePricingTiers should return three tiers with the middle tier marked popular", () => {
  const tiers = buildServicePricingTiers({
    duration: "24 ساعة",
    name: "صيانة لابتوب",
    price: 15,
  });

  assert.equal(tiers.length, 3);
  assert.equal(tiers[1].isPopular, true);
  assert.equal(tiers[0].price, 15);
  assert.equal(tiers[1].price, 23.25);
  assert.equal(tiers[2].price, 33);
});

test("buildServicePricingTiers should keep feature labels and booleans aligned", () => {
  const tiers = buildServicePricingTiers({ name: "ترقية", price: 10 });

  assert.equal(tiers[0].features[0].included, true);
  assert.equal(tiers[0].features[3].included, false);
  assert.equal(tiers[2].features[3].included, true);
});
