import assert from 'node:assert/strict';
import test from 'node:test';

import { createCheckoutHandler, onRequestOptions } from './checkout.js';

/**
 * Creates a mock request context for the checkout endpoint.
 *
 * @param {Record<string, unknown>} body
 * @param {{ env?: Record<string, string>, headers?: Record<string, string> }} [options]
 * @returns {{ env: Record<string, string>, request: Request }}
 */
function createContext(body, { env = {}, headers = {} } = {}) {
  return {
    env,
    request: new Request('https://tensr.systems/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    }),
  };
}

/**
 * Creates a minimal Supabase admin client mock for checkout tests.
 *
 * @param {{
 *   orderId?: string,
 *   products?: Array<Record<string, unknown>>,
 *   services?: Array<Record<string, unknown>>,
 * }} [options]
 * @returns {{ calls: { orderDeletes: Array<{ column: string, value: string }>, orderInserts: Array<Array<Record<string, unknown>>>, orderItemInserts: Array<Array<Record<string, unknown>>> }, client: { from: (table: string) => any } }}
 */
function createCheckoutAdminClient({ orderId = 'ord-1', products = [], services = [] } = {}) {
  const calls = {
    orderDeletes: [],
    orderInserts: [],
    orderItemInserts: [],
  };

  return {
    calls,
    client: {
      from(table) {
        if (table === 'products') {
          return {
            select(fields) {
              assert.ok(fields.includes('quantity'));
              return {
                in(column, values) {
                  assert.equal(column, 'id');
                  assert.deepEqual([...values].sort(), products.map((product) => product.id).sort());
                  return {
                    eq(statusColumn, statusValue) {
                      assert.equal(statusColumn, 'status');
                      assert.equal(statusValue, 'active');
                      return {
                        async or(expression) {
                          assert.ok(expression.includes('product_type'));
                          return { data: products, error: null };
                        },
                      };
                    },
                  };
                },
              };
            },
          };
        }

        if (table === 'settings') {
          return {
            select(fields) {
              assert.equal(fields, 'data');
              return {
                limit(value) {
                  assert.equal(value, 1);
                  return {
                    async maybeSingle() {
                      return {
                        data: {
                          data: {
                            deliveryMethods: [
                              { value: 'delivery', fee: 2 },
                              { value: 'pickup', fee: 0 },
                            ],
                          },
                        },
                      };
                    },
                  };
                },
              };
            },
          };
        }

        if (table === 'services') {
          return {
            select(fields) {
              assert.ok(fields.includes('provider_service_id'));
              return {
                in(column, values) {
                  assert.equal(column, 'id');
                  assert.deepEqual([...values].sort(), services.map((service) => service.id).sort());
                  return {
                    async eq(statusColumn, statusValue) {
                      assert.equal(statusColumn, 'status');
                      assert.equal(statusValue, 'active');
                      return { data: services, error: null };
                    },
                  };
                },
              };
            },
          };
        }

        if (table === 'orders') {
          return {
            insert(rows) {
              calls.orderInserts.push(rows);
              return {
                select(fields) {
                  assert.equal(fields, 'id');
                  return {
                    async single() {
                      return { data: { id: orderId }, error: null };
                    },
                  };
                },
              };
            },
            delete() {
              return {
                async eq(column, value) {
                  calls.orderDeletes.push({ column, value });
                  return { error: null };
                },
              };
            },
          };
        }

        if (table === 'order_items') {
          return {
            async insert(rows) {
              calls.orderItemInserts.push(rows);
              return { error: null };
            },
          };
        }

        if (table === 'notifications') {
          return {
            async insert() {
              return { error: null };
            },
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      },
    },
  };
}

test('createCheckoutHandler should use optimistic inventory updates for physical products', async () => {
  const products = [
    {
      id: 'prd-1',
      name: 'Gaming PC',
      price: 1200,
      discount_price: null,
      quantity: 5,
      sold: 1,
      status: 'active',
      category_id: 'cat-1',
      product_type: 'physical',
      brand: 'TechZone',
      images: [],
    },
  ];
  const adjustment = {
    productId: 'prd-1',
    previousQuantity: 5,
    nextQuantity: 4,
    previousSold: 1,
    nextSold: 2,
    previousStatus: 'active',
    nextStatus: 'active',
  };
  const applyCalls = [];
  const { client, calls } = createCheckoutAdminClient({ products });
  const handler = createCheckoutHandler({
    createSupabaseAdmin: () => client,
    resolveCheckoutUserId: async () => null,
    buildInventoryAdjustments: () => [adjustment],
    applyInventoryAdjustments: async ({ adjustments }) => {
      applyCalls.push(adjustments);
      return adjustments;
    },
    rollbackCheckoutState: async () => {
      throw new Error('rollback should not run');
    },
  });

  const response = await handler(createContext({
    customer_name: 'Ali',
    customer_phone: '+962790000000',
    delivery_method: 'delivery',
    payment_method: 'cod',
    items: [{ id: 'prd-1', qty: 1 }],
  }));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.equal(payload.data.order_id, 'ord-1');
  assert.equal(applyCalls.length, 1);
  assert.equal(applyCalls[0][0].productId, 'prd-1');
  assert.equal(calls.orderInserts.length, 1);
  assert.equal(calls.orderItemInserts.length, 1);
});

test('createCheckoutHandler should stop before order creation when optimistic inventory updates conflict', async () => {
  const products = [
    {
      id: 'prd-1',
      name: 'Gaming PC',
      price: 1200,
      discount_price: null,
      quantity: 5,
      sold: 1,
      status: 'active',
      category_id: 'cat-1',
      product_type: 'physical',
      brand: 'TechZone',
      images: [],
    },
    {
      id: 'prd-2',
      name: 'Mechanical Keyboard',
      price: 80,
      discount_price: null,
      quantity: 3,
      sold: 4,
      status: 'active',
      category_id: 'cat-2',
      product_type: 'physical',
      brand: 'TechZone',
      images: [],
    },
  ];
  const firstAdjustment = {
    productId: 'prd-1',
    previousQuantity: 5,
    nextQuantity: 4,
    previousSold: 1,
    nextSold: 2,
    previousStatus: 'active',
    nextStatus: 'active',
  };
  const secondAdjustment = {
    productId: 'prd-2',
    previousQuantity: 3,
    nextQuantity: 2,
    previousSold: 4,
    nextSold: 5,
    previousStatus: 'active',
    nextStatus: 'active',
  };
  const rollbackCalls = [];
  let applyAttempt = 0;
  const { client } = createCheckoutAdminClient({ products });
  const handler = createCheckoutHandler({
    createSupabaseAdmin: () => client,
    resolveCheckoutUserId: async () => null,
    buildInventoryAdjustments: () => [firstAdjustment, secondAdjustment],
    applyInventoryAdjustments: async ({ adjustments }) => {
      applyAttempt += 1;
      if (applyAttempt === 1) {
        return adjustments;
      }

      throw new Error('[CKP-302] Inventory conflict');
    },
    rollbackCheckoutState: async (input) => {
      rollbackCalls.push(input);
      return { ok: true, failedInventoryProductIds: [], orderDeleteFailed: false };
    },
  });

  const response = await handler(createContext({
    customer_name: 'Ali',
    customer_phone: '+962790000000',
    delivery_method: 'delivery',
    payment_method: 'cod',
    items: [
      { id: 'prd-1', qty: 1 },
      { id: 'prd-2', qty: 1 },
    ],
  }));
  const payload = await response.json();

  assert.equal(response.status, 409);
  assert.equal(payload.code, 'CKP-302');
  assert.equal(rollbackCalls.length, 0);
});

test('createCheckoutHandler should roll back the order when a later provider step fails', async () => {
  const products = [
    {
      id: 'prd-1',
      name: 'Gaming PC',
      price: 1200,
      discount_price: null,
      quantity: 5,
      sold: 1,
      status: 'active',
      category_id: 'cat-1',
      product_type: 'physical',
      brand: 'TechZone',
      images: [],
    },
  ];
  const services = [
    {
      id: 'srv-1',
      name: 'Followers Pack',
      price: 25,
      min_qty: 1,
      max_qty: 9999,
      image: null,
      category_id: 'cat-9',
      status: 'active',
      provider_service_id: 'provider-77',
      metadata: {},
    },
  ];
  const adjustment = {
    productId: 'prd-1',
    previousQuantity: 5,
    nextQuantity: 4,
    previousSold: 1,
    nextSold: 2,
    previousStatus: 'active',
    nextStatus: 'active',
  };
  const rollbackCalls = [];
  const { client } = createCheckoutAdminClient({ products, services });
  const handler = createCheckoutHandler({
    createSupabaseAdmin: () => client,
    resolveCheckoutUserId: async () => null,
    buildInventoryAdjustments: () => [adjustment],
    applyInventoryAdjustments: async ({ adjustments }) => adjustments,
    createProviderOrder: async () => {
      throw new Error('[CHK-115] Provider request crashed');
    },
    rollbackCheckoutState: async (input) => {
      rollbackCalls.push(input);
      return { ok: true, failedInventoryProductIds: [], orderDeleteFailed: false };
    },
  });

  const response = await handler(createContext({
    customer_name: 'Ali',
    customer_phone: '+962790000000',
    customer_contact_link: 'https://example.com/profile',
    delivery_method: 'delivery',
    payment_method: 'cod',
    items: [
      { id: 'prd-1', qty: 1 },
      { id: 'srv-1', qty: 1 },
    ],
  }));
  const payload = await response.json();

  assert.equal(response.status, 500);
  assert.equal(payload.code, 'CHK-500');
  assert.equal(rollbackCalls.length, 1);
  assert.equal(rollbackCalls[0].orderId, 'ord-1');
  assert.deepEqual(rollbackCalls[0].appliedInventoryAdjustments, [adjustment]);
});

test("createCheckoutHandler should require a dedicated digital contact when provider fields need it", async () => {
  const services = [
    {
      id: "srv-1",
      name: "Followers Pack",
      price: 25,
      min_qty: 1,
      max_qty: 9999,
      image: null,
      category_id: "cat-9",
      status: "active",
      provider_service_id: "provider-77",
      metadata: {
        provider_fields: [{ key: "whatsapp_number" }],
      },
    },
  ];
  const { client } = createCheckoutAdminClient({ services });
  const handler = createCheckoutHandler({
    createSupabaseAdmin: () => client,
    resolveCheckoutUserId: async () => null,
  });

  const response = await handler(createContext({
    customer_name: "Ali",
    customer_phone: "+962790000000",
    delivery_method: "delivery",
    payment_method: "cod",
    items: [{ id: "srv-1", qty: 1 }],
  }));
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.code, "CHK-112");
});

test("createCheckoutHandler should block guest checkout requests when the guest limiter rejects them", async () => {
  const guardCalls = [];
  const handler = createCheckoutHandler({
    guardGuestCheckoutRateLimit: async (input) => {
      guardCalls.push(input);
      return Response.json(
        {
          success: false,
          error: "[CHK-116] Guest checkout rate limit reached",
          code: "CHK-116",
        },
        {
          status: 429,
          headers: { "Retry-After": "30" },
        }
      );
    },
  });

  const response = await handler(createContext({
    customer_name: "Ali",
    customer_phone: "+962790000000",
    delivery_method: "delivery",
    payment_method: "cod",
    items: [{ id: "prd-1", qty: 1 }],
  }));
  const payload = await response.json();

  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Retry-After"), "30");
  assert.equal(payload.code, "CHK-116");
  assert.equal(guardCalls.length, 1);
});

test("checkout should restrict CORS headers to allow-listed origins", async () => {
  const allowedPreflight = onRequestOptions({
    request: new Request("https://tensr.systems/api/checkout", {
      headers: { Origin: "https://tensr.systems" },
      method: "OPTIONS",
    }),
  });
  const blockedPreflight = onRequestOptions({
    request: new Request("https://tensr.systems/api/checkout", {
      headers: { Origin: "https://evil.example" },
      method: "OPTIONS",
    }),
  });
  const handler = createCheckoutHandler({
    guardGuestCheckoutRateLimit: async () =>
      Response.json(
        {
          success: false,
          error: "[CHK-116] Guest checkout rate limit reached",
          code: "CHK-116",
        },
        { status: 429 }
      ),
  });
  const postResponse = await handler(createContext(
    {
      customer_name: "Ali",
      customer_phone: "+962790000000",
      delivery_method: "delivery",
      payment_method: "cod",
      items: [{ id: "prd-1", qty: 1 }],
    },
    {
      headers: { Origin: "https://tensr.systems" },
    }
  ));

  assert.equal(allowedPreflight.headers.get("Access-Control-Allow-Origin"), "https://tensr.systems");
  assert.equal(blockedPreflight.headers.get("Access-Control-Allow-Origin"), "");
  assert.equal(postResponse.headers.get("Access-Control-Allow-Origin"), "https://tensr.systems");
});

test("createCheckoutHandler should create one request-scoped auth client per request", async () => {
  const products = [
    {
      id: "prd-1",
      name: "Gaming PC",
      price: 1200,
      discount_price: null,
      quantity: 5,
      sold: 1,
      status: "active",
      category_id: "cat-1",
      product_type: "physical",
      brand: "TechZone",
      images: [],
    },
  ];
  const requestClient = {
    auth: {
      async getUser() {
        return { data: { user: { id: "user-1" } } };
      },
    },
  };
  const requestClientCalls = [];
  const resolveCalls = [];
  const { client } = createCheckoutAdminClient({ products });
  const handler = createCheckoutHandler({
    createCheckoutRequestClient({ env, request }) {
      requestClientCalls.push({
        authHeader: request.headers.get("authorization"),
        env,
      });
      return requestClient;
    },
    createSupabaseAdmin: () => client,
    resolveCheckoutUserId: async (input) => {
      resolveCalls.push(input);
      return "user-1";
    },
    buildInventoryAdjustments: () => [],
    applyInventoryAdjustments: async () => [],
  });

  const response = await handler(createContext(
    {
      customer_name: "Ali",
      customer_phone: "+962790000000",
      delivery_method: "delivery",
      payment_method: "cod",
      items: [{ id: "prd-1", qty: 1 }],
    },
    {
      env: {
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      },
      headers: { Authorization: "Bearer token-123" },
    }
  ));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.equal(requestClientCalls.length, 1);
  assert.equal(requestClientCalls[0].authHeader, "Bearer token-123");
  assert.equal(resolveCalls.length, 1);
  assert.equal(resolveCalls[0].requestClient, requestClient);
});
