import test from "node:test";
import assert from "node:assert/strict";
import { mergeCartItemsWithServerProducts } from "./cartSyncModel.js";

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
