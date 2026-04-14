import test from "node:test";
import assert from "node:assert/strict";
import {
  buildProductCardSnapshot,
  PRODUCT_CARD_DEFAULT_RATING,
  PRODUCT_CARD_DEFAULT_REVIEW_COUNT,
  PRODUCT_CARD_LOW_STOCK_THRESHOLD,
  PRODUCT_CARD_TOTAL_STARS,
  resolveProductCardPricing,
  resolveProductCardRating,
  resolveProductCardUrgency,
} from "./productCardModel.js";

test("resolveProductCardPricing should calculate discount percentage from original and sale price", () => {
  assert.deepEqual(
    resolveProductCardPricing({
      price: 100,
      discount_price: 75,
    }),
    {
      finalPrice: 75,
      originalPrice: 100,
      hasDiscount: true,
      discountPercentage: 25,
    }
  );
});

test("resolveProductCardRating should clamp invalid ratings and use fallback review counts", () => {
  const rating = resolveProductCardRating({
    rating: 9,
    review_count: 0,
  });

  assert.equal(rating.ratingValue, PRODUCT_CARD_TOTAL_STARS);
  assert.equal(rating.reviewCount, PRODUCT_CARD_DEFAULT_REVIEW_COUNT);
  assert.equal(rating.filledStars, PRODUCT_CARD_TOTAL_STARS);
});

test("resolveProductCardUrgency should show an urgency label for low stock quantities", () => {
  assert.deepEqual(
    resolveProductCardUrgency({
      quantity: PRODUCT_CARD_LOW_STOCK_THRESHOLD,
    }),
    {
      availableQuantity: PRODUCT_CARD_LOW_STOCK_THRESHOLD,
      urgencyLabel: `متبقي ${PRODUCT_CARD_LOW_STOCK_THRESHOLD} قطع فقط`,
    }
  );
});

test("resolveProductCardUrgency should hide the urgency label when stock is comfortably available", () => {
  assert.deepEqual(
    resolveProductCardUrgency({
      quantity: PRODUCT_CARD_LOW_STOCK_THRESHOLD + 3,
    }),
    {
      availableQuantity: PRODUCT_CARD_LOW_STOCK_THRESHOLD + 3,
      urgencyLabel: null,
    }
  );
});

test("buildProductCardSnapshot should compose the default product-card view model", () => {
  const snapshot = buildProductCardSnapshot({
    category: "لابتوبات",
    badge: "ASUS",
  });

  assert.equal(snapshot.description, "");
  assert.equal(snapshot.previewDescription, "شاهد السعر والتوفر بسرعة قبل فتح صفحة المنتج الكاملة.");
  assert.deepEqual(snapshot.previewHighlights, ["ASUS", "لابتوبات"]);
  assert.equal(snapshot.finalPrice, 0);
  assert.equal(snapshot.hasDiscount, false);
  assert.equal(snapshot.discountPercentage, null);
  assert.equal(snapshot.ratingValue, PRODUCT_CARD_DEFAULT_RATING);
  assert.equal(snapshot.reviewCount, PRODUCT_CARD_DEFAULT_REVIEW_COUNT);
  assert.equal(snapshot.urgencyLabel, null);
});
