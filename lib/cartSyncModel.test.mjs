import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCartRevalidationNotice,
  mergeCartItemsWithServerProducts,
  revalidateCartAgainstServer,
  shouldResetCartForAuthTransition,
} from "./cartSyncModel.js";

test("mergeCartItemsWithServerProducts should update the cart price and availability from the server", () => {
  const cartItems = [
    {
      id: "p-1",
      name: "Old Name",
      price: 50,
      qty: 2,
      images: ["old-image.png"],
      status: "active",
      category: "Laptops",
      icon: "package",
      quantity: 4,
    },
  ];
  const serverProducts = [
    {
      id: "p-1",
      name: "New Name",
      price: 60,
      discount_price: 45,
      images: ["new-image.png"],
      status: "inactive",
      quantity: 1,
      category: "Gaming",
      icon: "monitor",
    },
  ];

  const result = mergeCartItemsWithServerProducts({ cartItems, serverProducts });

  assert.deepEqual(result, [
    {
      id: "p-1",
      name: "New Name",
      originalPrice: 60,
      price: 45,
      qty: 2,
      images: ["new-image.png"],
      status: "inactive",
      category: "Gaming",
      icon: "monitor",
      quantity: 1,
      stock: undefined,
      inventory_quantity: undefined,
      available_quantity: undefined,
    },
  ]);
});

test("mergeCartItemsWithServerProducts should preserve the local item when the product is missing on the server", () => {
  const cartItems = [{ id: "p-2", name: "Laptop", price: 70, qty: 1, images: [] }];
  const result = mergeCartItemsWithServerProducts({ cartItems, serverProducts: [] });

  assert.equal(result, cartItems);
});

test("mergeCartItemsWithServerProducts should keep the local price when the server payload has no usable price", () => {
  const cartItems = [{ id: "p-3", name: "Keyboard", originalPrice: 35, price: 35, qty: 1, images: [] }];
  const serverProducts = [{ id: "p-3", name: "Keyboard Pro", price: null, discount_price: 0, images: [] }];

  const result = mergeCartItemsWithServerProducts({ cartItems, serverProducts });

  assert.equal(result[0].price, 35);
  assert.equal(result[0].originalPrice, 35);
  assert.equal(result[0].name, "Keyboard Pro");
});

test("mergeCartItemsWithServerProducts should return an empty array for invalid cart input", () => {
  const result = mergeCartItemsWithServerProducts({ cartItems: null, serverProducts: [{ id: "p-4", price: 20 }] });

  assert.deepEqual(result, []);
});

test("revalidateCartAgainstServer should drop deleted and inactive products", () => {
  const result = revalidateCartAgainstServer({
    cartItems: [
      { id: "p-keep", name: "Keep", price: 10, qty: 1 },
      { id: "p-gone", name: "Gone", price: 10, qty: 1 },
      { id: "p-disabled", name: "Disabled", price: 10, qty: 1 },
    ],
    serverProducts: [
      { id: "p-keep", name: "Keep", price: 10, status: "active", quantity: 5 },
      { id: "p-disabled", name: "Disabled", price: 10, status: "draft", quantity: 5 },
    ],
  });

  assert.deepEqual(result.removedIds.sort(), ["p-disabled", "p-gone"]);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].id, "p-keep");
  assert.deepEqual(result.clampedItems, []);
});

test("revalidateCartAgainstServer should clamp quantities to the available stock", () => {
  const result = revalidateCartAgainstServer({
    cartItems: [
      { id: "p-1", name: "Mouse", price: 10, qty: 5 },
    ],
    serverProducts: [
      { id: "p-1", name: "Mouse", price: 10, status: "active", quantity: 2 },
    ],
  });

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].qty, 2);
  assert.deepEqual(result.clampedItems, [
    { id: "p-1", name: "Mouse", requestedQty: 5, availableQty: 2 },
  ]);
});

test("revalidateCartAgainstServer should drop items whose stock fell to zero", () => {
  const result = revalidateCartAgainstServer({
    cartItems: [{ id: "p-zero", name: "Sold out", price: 10, qty: 1 }],
    serverProducts: [{ id: "p-zero", name: "Sold out", price: 10, status: "active", quantity: 0 }],
  });

  assert.deepEqual(result.removedIds, ["p-zero"]);
  assert.deepEqual(result.items, []);
});

test("buildCartRevalidationNotice should summarize removed and clamped cart items", () => {
  const message = buildCartRevalidationNotice({
    removedIds: ["p-gone", "p-disabled"],
    clampedItems: [{ id: "p-1" }],
  });

  assert.match(message, /أزلنا 2 عناصر لم تعد متاحة/);
  assert.match(message, /عدّلنا كمية 1 عنصر/);
});

test("buildCartRevalidationNotice should return an empty message when nothing changed", () => {
  assert.equal(buildCartRevalidationNotice({ removedIds: [], clampedItems: [] }), "");
});

test("shouldResetCartForAuthTransition should reset on sign out and user switches", () => {
  assert.equal(shouldResetCartForAuthTransition({ event: "SIGNED_OUT" }), true);
  assert.equal(
    shouldResetCartForAuthTransition({ event: "SIGNED_IN", previousUserId: "u-1", nextUserId: "u-2" }),
    true
  );
  assert.equal(
    shouldResetCartForAuthTransition({ event: "TOKEN_REFRESHED", previousUserId: "u-1", nextUserId: "u-1" }),
    false
  );
});
