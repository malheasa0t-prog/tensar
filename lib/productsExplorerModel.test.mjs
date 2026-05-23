import test from "node:test";
import assert from "node:assert/strict";
import {
  PRODUCTS_EXPLORER_DEFAULT_SORT,
  buildProductsExplorerActiveFilters,
  filterProductsExplorerProducts,
  getProductsExplorerAvailability,
  getProductsExplorerTypeLabel,
  mapProductsExplorerProduct,
  sortProductsExplorerProducts,
} from "./productsExplorerModel.js";

const baseProducts = [
  {
    id: "p-1",
    name: "Gaming Laptop",
    description: "RTX laptop",
    category: "\u0644\u0627\u0628\u062a\u0648\u0628\u0627\u062a",
    categoryId: "cat-laptops",
    productType: "physical",
    badge: "ASUS",
    price: 1200,
    discountPrice: 1100,
    quantity: 8,
    sold: 4,
    createdAt: "2026-03-01T12:00:00.000Z",
    status: "active",
  },
  {
    id: "p-2",
    name: "Repair Consultation",
    description: "Quick diagnostics service",
    category: "\u0627\u0644\u0635\u064a\u0627\u0646\u0629",
    categoryId: "cat-repair",
    productType: "service",
    badge: "TechZone",
    price: 20,
    quantity: 0,
    sold: 21,
    createdAt: "2026-04-01T12:00:00.000Z",
    status: "active",
  },
  {
    id: "p-3",
    name: "Mechanical Keyboard",
    description: "RGB keyboard",
    category: "\u0645\u0644\u062d\u0642\u0627\u062a",
    categoryId: "cat-accessories",
    productType: "physical",
    badge: "Redragon",
    price: 45,
    quantity: 2,
    sold: 10,
    createdAt: "2026-02-01T12:00:00.000Z",
    status: "active",
  },
];

test("mapProductsExplorerProduct should expose the card contract used by the products page", () => {
  const mapped = mapProductsExplorerProduct(
    {
      id: "p-9",
      name: "Monitor",
      category_id: "cat-monitors",
      product_type: "physical",
      price: 150,
      discount_price: 130,
      quantity: 5,
      description: "27 inch",
      brand: "LG",
      rating: 4.7,
      sold: 12,
      review_count: 3,
      images: ["https://example.com/monitor.png"],
      status: "active",
      created_at: "2026-01-10T12:00:00.000Z",
    },
    "\u0634\u0627\u0634\u0627\u062a"
  );

  assert.equal(mapped.category, "\u0634\u0627\u0634\u0627\u062a");
  assert.equal(mapped.categoryId, "cat-monitors");
  assert.equal(mapped.productType, "physical");
  assert.equal(mapped.discountPrice, 130);
  assert.equal(mapped.badge, "LG");
  assert.equal(mapped.link, "/products/p-9");
});

test("getProductsExplorerAvailability should detect on-demand and low-stock products correctly", () => {
  assert.equal(getProductsExplorerAvailability(baseProducts[0]), "in_stock");
  assert.equal(getProductsExplorerAvailability(baseProducts[1]), "in_stock");
  assert.equal(getProductsExplorerAvailability(baseProducts[2]), "low_stock");
  assert.equal(
    getProductsExplorerAvailability({ productType: "physical", quantity: 0, status: "out_of_stock" }),
    "out_of_stock"
  );
});

test("filterProductsExplorerProducts should apply search, category, type, availability, and price together", () => {
  const filtered = filterProductsExplorerProducts({
    products: baseProducts,
    searchQuery: "keyboard",
    categoryId: "cat-accessories",
    productType: "physical",
    availability: "low_stock",
    minPrice: 40,
    maxPrice: 50,
  });

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, "p-3");
});

test("sortProductsExplorerProducts should support newest, lowest price, and best selling", () => {
  const newest = sortProductsExplorerProducts({
    products: baseProducts,
    sortOption: PRODUCTS_EXPLORER_DEFAULT_SORT,
  });
  const lowestPrice = sortProductsExplorerProducts({ products: baseProducts, sortOption: "price_asc" });
  const bestSelling = sortProductsExplorerProducts({ products: baseProducts, sortOption: "best_selling" });

  assert.equal(newest[0].id, "p-2");
  assert.equal(lowestPrice[0].id, "p-2");
  assert.equal(bestSelling[0].id, "p-2");
});

test("buildProductsExplorerActiveFilters should return user-facing Arabic labels", () => {
  const labels = buildProductsExplorerActiveFilters({
    searchQuery: "\u0644\u0627\u0628\u062a\u0648\u0628",
    categoryName: "\u0644\u0627\u0628\u062a\u0648\u0628\u0627\u062a",
    productTypeLabel: getProductsExplorerTypeLabel("physical"),
    availabilityLabel: "\u0645\u062a\u0648\u0641\u0631",
    minPrice: 100,
    maxPrice: 300,
    sortOption: "best_selling",
    sortLabel: "\u0627\u0644\u0623\u0643\u062b\u0631 \u0645\u0628\u064a\u0639\u0627\u064b",
  });

  assert.deepEqual(labels, [
    "\u0628\u062d\u062b: \u0644\u0627\u0628\u062a\u0648\u0628",
    "\u0627\u0644\u0641\u0626\u0629: \u0644\u0627\u0628\u062a\u0648\u0628\u0627\u062a",
    "\u0627\u0644\u0646\u0648\u0639: \u0645\u0646\u062a\u062c\u0627\u062a \u0641\u0639\u0644\u064a\u0629",
    "\u0627\u0644\u062a\u0648\u0641\u0631: \u0645\u062a\u0648\u0641\u0631",
    "\u0627\u0644\u0633\u0639\u0631: \u0645\u0646 100 \u0625\u0644\u0649 300 \u062f.\u0623",
    "\u0627\u0644\u062a\u0631\u062a\u064a\u0628: \u0627\u0644\u0623\u0643\u062b\u0631 \u0645\u0628\u064a\u0639\u0627\u064b",
  ]);
});

test("getProductsExplorerTypeLabel should expose labels for all public product types", () => {
  assert.equal(getProductsExplorerTypeLabel("accessory"), "\u0645\u0644\u062d\u0642\u0627\u062a");
  assert.equal(getProductsExplorerTypeLabel("digital"), "\u0645\u0646\u062a\u062c\u0627\u062a \u0631\u0642\u0645\u064a\u0629");
  assert.equal(getProductsExplorerTypeLabel("subscription"), "\u0627\u0634\u062a\u0631\u0627\u0643\u0627\u062a");
});
