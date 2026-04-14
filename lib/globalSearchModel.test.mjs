import test from "node:test";
import assert from "node:assert/strict";
import {
  buildGlobalSearchItems,
  buildGlobalSearchPopularSuggestions,
  buildGlobalSearchQuickFilters,
  filterGlobalSearchItems,
  getGlobalSearchTypeLabel,
  slugifySearchPathSegment,
} from "./globalSearchModel.js";

/**
 * Builds one representative global search fixture used by the tests.
 *
 * @returns {{
 *   categories: Array<Record<string, unknown>>,
 *   products: Array<Record<string, unknown>>,
 *   services: Array<Record<string, unknown>>,
 * }}
 */
function createSearchFixture() {
  return {
    categories: [
      { id: "cat-1", name: "لابتوبات", slug: "laptops", parent_id: null },
      { id: "cat-2", name: "شاشات", slug: "monitors", parent_id: null },
    ],
    products: [
      {
        id: "prod-1",
        name: "لابتوب ألعاب RTX",
        description: "أداء قوي للألعاب والعمل",
        sold: 35,
        price: 1250,
        discount_price: 1150,
        category_id: "cat-1",
      },
      {
        id: "prod-2",
        name: "شاشة 27 بوصة",
        description: "دقة عالية وتجربة سلسة",
        sold: 11,
        price: 230,
        category_id: "cat-2",
      },
    ],
    services: [
      {
        id: "svc-1",
        name: "صيانة لابتوب",
        description: "تشخيص شامل واستبدال القطع التالفة",
        category: "خدمات اللابتوب",
        price: 15,
      },
    ],
  };
}

test("buildGlobalSearchItems should map products, services, and categories into search items", () => {
  const items = buildGlobalSearchItems(createSearchFixture());

  assert.equal(items.length, 5);
  assert.deepEqual(
    items.map((item) => item.href),
    ["/products/prod-1", "/products/prod-2", "/services/svc-1", "/category/laptops", "/category/monitors"]
  );
  assert.equal(items[0].categoryLabel, "لابتوبات");
  assert.equal(items[2].metaLabel, "يبدأ من 15.00 د.أ");
});

test("buildGlobalSearchQuickFilters should merge repeated category labels and keep the most used first", () => {
  const items = buildGlobalSearchItems(createSearchFixture());
  const filters = buildGlobalSearchQuickFilters(items);
  const laptopsFilter = filters.find((filter) => filter.label === "لابتوبات");

  assert.equal(laptopsFilter?.count, 2);
  assert.ok(filters.some((filter) => filter.label === "خدمات اللابتوب"));
});

test("buildGlobalSearchPopularSuggestions should prioritize top items and keep unique fallback labels", () => {
  const items = buildGlobalSearchItems(createSearchFixture());
  const suggestions = buildGlobalSearchPopularSuggestions({
    items,
    limit: 6,
    fallbackSuggestions: ["بطاقات", "لابتوبات", "إكسسوارات"],
  });

  assert.equal(suggestions[0], "لابتوب ألعاب RTX");
  assert.ok(suggestions.includes("صيانة لابتوب"));
  assert.equal(new Set(suggestions).size, suggestions.length);
});

test("filterGlobalSearchItems should rank matching titles and apply quick category filtering", () => {
  const items = buildGlobalSearchItems(createSearchFixture());
  const laptopResults = filterGlobalSearchItems({ items, query: "لابتوب" });
  const serviceResults = filterGlobalSearchItems({
    items,
    query: "",
    categoryFilter: "خدمات-اللابتوب",
  });

  assert.equal(laptopResults[0].title, "لابتوب ألعاب RTX");
  assert.deepEqual(serviceResults.map((item) => item.type), ["service"]);
});

test("slugifySearchPathSegment and getGlobalSearchTypeLabel should return stable public values", () => {
  assert.equal(slugifySearchPathSegment("صيانة لابتوب متقدمة"), "صيانة-لابتوب-متقدمة");
  assert.equal(getGlobalSearchTypeLabel("product"), "منتج");
  assert.equal(getGlobalSearchTypeLabel("unknown"), "عنصر");
});
