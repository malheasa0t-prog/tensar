import assert from "node:assert/strict";
import test from "node:test";

import { buildCheckoutRequestPayload } from "./checkoutRequestPayload.js";

test("buildCheckoutRequestPayload should only include the allow-listed checkout fields", () => {
  const payload = buildCheckoutRequestPayload({
    items: [{ id: "prd-1", qty: "2" }],
    form: {
      customer_name: "  Ali  ",
      customer_phone: " 0790000000 ",
      customer_email: " ali@example.com ",
      customer_contact_link: " @ali ",
      delivery_method: " pickup ",
      payment_method: " cod ",
      notes: " leave at door ",
      status: "completed",
      total: 0,
      user_id: "other-user-id",
    },
  });

  assert.deepEqual(payload, {
    items: [{ id: "prd-1", qty: 2 }],
    customer_name: "Ali",
    customer_phone: "0790000000",
    customer_email: "ali@example.com",
    customer_contact_link: "@ali",
    delivery_method: "pickup",
    payment_method: "cod",
    notes: "leave at door",
  });
  assert.equal(Object.hasOwn(payload, "status"), false);
  assert.equal(Object.hasOwn(payload, "total"), false);
  assert.equal(Object.hasOwn(payload, "user_id"), false);
});

test("buildCheckoutRequestPayload should fall back to safe defaults", () => {
  const payload = buildCheckoutRequestPayload({
    items: [{ id: "srv-1" }],
    form: {},
  });

  assert.deepEqual(payload, {
    items: [{ id: "srv-1", qty: 1 }],
    customer_name: "",
    customer_phone: "",
    customer_email: "",
    customer_contact_link: "",
    delivery_method: "delivery",
    payment_method: "cod",
    notes: "",
  });
});
