import assert from "node:assert/strict";
import test from "node:test";

import {
  createCheckoutOrderId,
  normalizeCheckoutItems,
  normalizeCheckoutPayload,
  validateCheckoutCustomer
} from "./checkout.mjs";

test("normalizeCheckoutPayload should trim and apply defaults", () => {
  const payload = normalizeCheckoutPayload({
    customer_email: "  user@example.com ",
    customer_name: "  User ",
    customer_phone: "  +962700000000 ",
    delivery_method: "",
    payment_method: ""
  });

  assert.equal(payload.customerEmail, "user@example.com");
  assert.equal(payload.deliveryMethod, "delivery");
  assert.equal(payload.paymentMethod, "cod");
});

test("normalizeCheckoutItems should aggregate valid entries only", () => {
  const items = normalizeCheckoutItems([
    { id: "a", qty: 1 },
    { id: "a", qty: 2 },
    { id: "", qty: 5 },
    { id: "b", qty: "x" }
  ]);

  assert.deepEqual(items, [{ id: "a", qty: 3 }]);
});

test("validateCheckoutCustomer should reject invalid phones", () => {
  assert.equal(
    validateCheckoutCustomer({ customerName: "Valid Name", customerPhone: "bad" }),
    "رقم الهاتف غير صالح"
  );
});

test("createCheckoutOrderId should use the provided sources", () => {
  assert.equal(createCheckoutOrderId(() => 123, () => 0.5), "ord-123-i");
});
