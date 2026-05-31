import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCatalogServiceCartItem,
  resolveCatalogServiceCategoryLabel,
} from "./catalogServiceCartModel.js";

test("resolveCatalogServiceCategoryLabel should prefer the active subcategory label", () => {
  assert.equal(
    resolveCatalogServiceCategoryLabel({
      rootCategoryLabel: "البطاقات",
      subCategoryLabel: "Steam",
    }),
    "Steam"
  );
});

test("resolveCatalogServiceCategoryLabel should fall back to the root label or default text", () => {
  assert.equal(
    resolveCatalogServiceCategoryLabel({
      rootCategoryLabel: "البطاقات",
      subCategoryLabel: "",
    }),
    "البطاقات"
  );
  assert.equal(resolveCatalogServiceCategoryLabel({}), "خدمة رقمية");
});

test("buildCatalogServiceCartItem should normalize one services-table row for the cart", () => {
  const item = buildCatalogServiceCartItem({
    categoryLabel: "آيتونز",
    service: {
      id: "srv-55",
      name: "آيتونز 5$",
      price: "5.5",
      image: "https://example.com/itunes.jpg",
      max_qty: 4,
      status: "active",
      metadata: {
        link_required: true,
        provider_fields: [{ key: "email" }],
      },
    },
  });

  assert.deepEqual(item, {
    id: "srv-55",
    name: "آيتونز 5$",
    originalPrice: 5.5,
    price: 5.5,
    category: "آيتونز",
    description: "",
    icon: "wrench",
    images: ["https://example.com/itunes.jpg"],
    quantity: 4,
    status: "active",
    product_type: "digital",
    provider_fields: [{ key: "email" }],
    link_required: true,
  });
});
