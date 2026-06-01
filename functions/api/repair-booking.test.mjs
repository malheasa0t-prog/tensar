import assert from "node:assert/strict";
import test from "node:test";

import { mapRepairBookingError } from "./repair-booking.js";

const ORIGINAL_CONSOLE_ERROR = console.error;

test.afterEach(() => {
  console.error = ORIGINAL_CONSOLE_ERROR;
});

test("mapRepairBookingError should preserve coded insert failures", async () => {
  const response = mapRepairBookingError(
    new Error("[RBK-301] تعذر إرسال طلب الصيانة حاليا. حاول مرة أخرى.")
  );
  const payload = await response.json();

  assert.equal(response.status, 500);
  assert.equal(payload.code, "RBK-301");
  assert.match(payload.error, /^\[RBK-301\]/);
});

test("mapRepairBookingError should hide unexpected internal failures", async () => {
  console.error = () => {};
  const response = mapRepairBookingError(new Error("null value in column \"device\""));
  const payload = await response.json();

  assert.equal(response.status, 500);
  assert.equal(payload.code, "RBK-500");
  assert.match(payload.error, /^\[RBK-500\]/);
});
