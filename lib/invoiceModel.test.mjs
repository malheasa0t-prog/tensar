import assert from "node:assert/strict";
import test from "node:test";

import { buildInvoiceModel, formatInvoiceNumber } from "./invoiceModel.js";

test("formatInvoiceNumber prefers display number, falls back to id", () => {
  assert.equal(formatInvoiceNumber({ display_number: 2024 }), "#2024");
  assert.equal(formatInvoiceNumber({ id: "ord-abc" }), "ord-abc");
  assert.equal(formatInvoiceNumber({}), "-");
});

test("buildInvoiceModel computes line totals and uses stored totals", () => {
  const invoice = buildInvoiceModel({
    order: {
      display_number: 12,
      created_at: "2026-05-30T10:00:00Z",
      customer_name: "Sara",
      customer_phone: "0790000000",
      subtotal: 100,
      shipping_fee: 2,
      discount_amount: 10,
      coupon_code: "SAVE10",
      total: 92,
      status: "processing",
    },
    items: [
      { product_name: "Cable", qty: 2, price: 25 },
      { product_name: "Charger", qty: 1, price: 50 },
    ],
    settings: { company: { name: "TechZone", phone: "0791111111" } },
  });

  assert.equal(invoice.number, "#12");
  assert.equal(invoice.lines.length, 2);
  assert.equal(invoice.lines[0].lineTotal, 50);
  assert.equal(invoice.subtotal, 100);
  assert.equal(invoice.discount, 10);
  assert.equal(invoice.total, 92);
  assert.equal(invoice.couponCode, "SAVE10");
  assert.equal(invoice.company.name, "TechZone");
});

test("buildInvoiceModel derives totals when not stored", () => {
  const invoice = buildInvoiceModel({
    order: { id: "ord-x" },
    items: [{ name: "Item", qty: 3, price: 10 }],
  });
  assert.equal(invoice.subtotal, 30);
  assert.equal(invoice.total, 30);
  assert.equal(invoice.company.name, "TechZone");
});
