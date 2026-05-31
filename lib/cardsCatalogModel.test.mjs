import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCardsRootCategories,
  countServicesBySubcategory,
  findCardsCategoryByRoute,
  getCardsServicesForSelection,
  getDirectChildCategories,
  resolveCardsCategoryRouteSegment,
  resolveCardsSubcategorySelection,
} from "./cardsCatalogModel.js";

const categories = [
  { id: "cards", name: "البطاقات", slug: "البطاقات", parent_id: null, sort_order: 2 },
  { id: "itunes", name: "آيتونز", slug: "آيتونز", parent_id: "cards", sort_order: 1 },
  { id: "google-play", name: "جوجل بلاي", slug: "جوجل-بلاي", parent_id: "cards", sort_order: 3 },
  { id: "unused", name: "أجهزة", slug: "أجهزة", parent_id: null, sort_order: 1 },
];

const services = [
  { id: "srv-1", name: "آيتونز 5$", category_id: "cards", subcategory_id: "itunes", sort_order: 2 },
  { id: "srv-2", name: "آيتونز 10$", category_id: "cards", subcategory_id: "itunes", sort_order: 1 },
  { id: "srv-3", name: "بطاقة عامة", category_id: "cards", subcategory_id: null, sort_order: 3 },
];

test("buildCardsRootCategories should keep only roots with active catalog services", () => {
  const roots = buildCardsRootCategories({ categories, services });

  assert.deepEqual(
    roots.map((category) => ({ id: category.id, count: category.serviceCount })),
    [{ id: "cards", count: 3 }]
  );
});

test("getDirectChildCategories should return ordered children for one root", () => {
  const children = getDirectChildCategories({ categories, parentId: "cards" });

  assert.deepEqual(children.map((category) => category.id), ["itunes", "google-play"]);
});

test("findCardsCategoryByRoute should match raw ids and Arabic slugs", () => {
  assert.equal(findCardsCategoryByRoute({ categories, routeValue: "cards" })?.id, "cards");
  assert.equal(findCardsCategoryByRoute({ categories, routeValue: "آيتونز" })?.id, "itunes");
});

test("resolveCardsCategoryRouteSegment should fall back to the slugified category name", () => {
  assert.equal(resolveCardsCategoryRouteSegment({ id: "cat-1", slug: "", name: "steam" }), "steam");
  assert.equal(resolveCardsCategoryRouteSegment({ id: "cat-2", slug: "", name: "بطاقات ستيم" }), "بطاقات-ستيم");
});

test("findCardsCategoryByRoute should match one slugified category name when slug is missing", () => {
  const sluglessCategories = [{ id: "cat-1", name: "steam", slug: null, parent_id: "cards" }];
  assert.equal(findCardsCategoryByRoute({ categories: sluglessCategories, routeValue: "steam" })?.id, "cat-1");
});

test("countServicesBySubcategory should count only services under the selected root", () => {
  assert.deepEqual(
    countServicesBySubcategory({
      rootId: "cards",
      services,
      subCategories: getDirectChildCategories({ categories, parentId: "cards" }),
    }),
    { itunes: 2, "google-play": 0 }
  );
});

test("getCardsServicesForSelection should keep the selected subcategory ordered by sort order", () => {
  const visibleServices = getCardsServicesForSelection({
    rootId: "cards",
    services,
    subCategoryId: "itunes",
  });

  assert.deepEqual(visibleServices.map((service) => service.id), ["srv-2", "srv-1"]);
});

test("resolveCardsSubcategorySelection should keep a valid selected subcategory or fall back to the first populated one", () => {
  assert.equal(
    resolveCardsSubcategorySelection({
      requestedSubId: "google-play",
      services,
      subCategories: getDirectChildCategories({ categories, parentId: "cards" }),
    }),
    "google-play"
  );

  assert.equal(
    resolveCardsSubcategorySelection({
      requestedSubId: "missing",
      services,
      subCategories: getDirectChildCategories({ categories, parentId: "cards" }),
    }),
    "itunes"
  );
});
