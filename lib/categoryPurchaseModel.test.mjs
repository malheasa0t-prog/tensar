import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildCategoryChildCountMap,
  buildCategoryPurchaseService,
  extractCategoryPurchasePrice,
  isCategoryPurchaseable,
} from './categoryPurchaseModel.js';

test('extractCategoryPurchasePrice should parse the visible price from the category name', () => {
  assert.equal(
    extractCategoryPurchasePrice({
      name: 'steam 5$',
      metadata: {},
    }),
    5,
  );
});

test('extractCategoryPurchasePrice should ignore blank metadata price values', () => {
  assert.equal(
    extractCategoryPurchasePrice({
      name: 'steam 5$',
      metadata: { price: '' },
    }),
    5,
  );
});

test('extractCategoryPurchasePrice should prefer explicit metadata price values', () => {
  assert.equal(
    extractCategoryPurchasePrice({
      name: 'steam 5$',
      metadata: { price: '7.50' },
    }),
    7.5,
  );
});

test('buildCategoryChildCountMap should count direct children only', () => {
  assert.deepEqual(
    buildCategoryChildCountMap([
      { id: 'root', parent_id: null },
      { id: 'child-1', parent_id: 'root' },
      { id: 'child-2', parent_id: 'root' },
      { id: 'leaf', parent_id: 'child-1' },
    ]),
    { root: 2, 'child-1': 1 },
  );
});

test('isCategoryPurchaseable should require an active leaf with a visible price', () => {
  assert.equal(
    isCategoryPurchaseable({
      category: { id: 'cat-1', name: 'steam 5$', status: 'active', metadata: {} },
      childCountById: {},
    }),
    true,
  );
  assert.equal(
    isCategoryPurchaseable({
      category: { id: 'cat-2', name: 'steam', status: 'active', metadata: {} },
      childCountById: { 'cat-2': 1 },
    }),
    false,
  );
});

test('buildCategoryPurchaseService should return a service-shaped item for buyable leaf categories', () => {
  const service = buildCategoryPurchaseService({
    category: {
      id: 'cat-1',
      parent_id: 'cat-parent',
      name: 'steam 5$',
      slug: '',
      icon: '',
      image: 'https://example.com/steam.png',
      description: 'رقمية',
      status: 'active',
      sort_order: 3,
      metadata: { link_required: true, provider_fields: [{ key: 'handle' }] },
    },
    categoryLabel: 'steam',
    categorySlug: 'steam-5',
    childCountById: {},
  });

  assert.deepEqual(service, {
    id: 'cat-1',
    name: 'steam 5$',
    slug: '',
    category: 'steam',
    category_id: 'cat-parent',
    subcategory_id: 'cat-1',
    provider_service_id: null,
    price: 5,
    cost_price: 5,
    min_qty: 1,
    max_qty: 9999,
    description: 'رقمية',
    image: 'https://example.com/steam.png',
    icon: 'gift',
    status: 'active',
    sort_order: 3,
    metadata: {
      link_required: true,
      provider_fields: [{ key: 'handle' }],
      source_category_id: 'cat-1',
      source_type: 'category-leaf',
      price_source: 'name',
    },
    product_type: 'digital',
    sourceType: 'catalog-service',
    catalog_source: 'category',
    categoryLabel: 'steam',
    categorySlug: 'steam-5',
    images: ['https://example.com/steam.png'],
    quantity: 9999,
    brand: null,
    rating: 0,
    sold: 0,
    discount_price: null,
  });
});
