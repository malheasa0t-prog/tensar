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
    category: "لابتوبات",
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
    name: "Steam Card",
    description: "بطاقة رقمية",
    category: "بطاقات",
    categoryId: "cat-cards",
    productType: "digital",
    badge: "Steam",
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
    category: "ملحقات",
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
    "شاشات"
  );

  assert.equal(mapped.category, "شاشات");
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
    searchQuery: "لابتوب",
    categoryName: "لابتوبات",
    productTypeLabel: getProductsExplorerTypeLabel("physical"),
    availabilityLabel: "متوفر",
    minPrice: 100,
    maxPrice: 300,
    sortOption: "best_selling",
    sortLabel: "الأكثر مبيعاً",
  });

  assert.deepEqual(labels, [
    "بحث: لابتوب",
    "الفئة: لابتوبات",
    "النوع: منتجات فعلية",
    "التوفر: متوفر",
    "السعر: من 100 إلى 300 د.أ",
    "الترتيب: الأكثر مبيعاً",
  ]);
});
