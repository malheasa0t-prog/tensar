import test from "node:test";
import assert from "node:assert/strict";
import { normalizeDeliveryMethodList } from "./deliveryMethods.js";

test("normalizeDeliveryMethodList should preserve explicit fees from delivery method objects", () => {
  const deliveryMethods = normalizeDeliveryMethodList(
    [
      { value: "delivery", label: "توصيل", fee: 4.5 },
      { value: "pickup", label: "استلام", fee: 0 },
    ],
    []
  );

  assert.deepEqual(deliveryMethods, [
    { value: "delivery", label: "توصيل", fee: 4.5 },
    { value: "pickup", label: "استلام", fee: 0 },
  ]);
});

test("normalizeDeliveryMethodList should fall back to legacy shipping settings when fee is missing", () => {
  const deliveryMethods = normalizeDeliveryMethodList(
    [
      { id: "delivery", name: "توصيل" },
      { id: "pickup", name: "استلام من المحل" },
    ],
    [],
    { standardFee: 3.25 }
  );

  assert.deepEqual(deliveryMethods, [
    { value: "delivery", label: "توصيل", fee: 3.25 },
    { value: "pickup", label: "استلام من المحل", fee: 0 },
  ]);
});
