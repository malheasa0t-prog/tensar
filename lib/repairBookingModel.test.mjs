import test from "node:test";
import assert from "node:assert/strict";

import {
  buildRepairBookingPayload,
  createRepairBookingFormState,
  getRepairModeHelper,
  resolveRepairBookingServiceId,
  resolveRepairDeliveryOptions,
  validateRepairBookingForm,
} from "./repairBookingModel.mjs";

test("resolveRepairDeliveryOptions should append remote mode when missing from stored settings", () => {
  const options = resolveRepairDeliveryOptions([
    { value: "delivery", label: "توصيل" },
    { value: "pickup", label: "استلام من المحل" },
  ]);

  assert.deepEqual(
    options.map((option) => option.value),
    ["delivery", "pickup", "remote"]
  );
});

test("createRepairBookingFormState should preserve trusted values and use first valid defaults", () => {
  const state = createRepairBookingFormState({
    services: [{ id: "service-1" }, { id: "service-2" }],
    deliveryOptions: [{ value: "pickup" }, { value: "remote" }],
    preservedValues: { name: "محمد", phone: "079", mode: "remote" },
  });

  assert.deepEqual(state, {
    name: "محمد",
    phone: "079",
    serviceId: "service-1",
    description: "",
    mode: "remote",
    address: "",
  });
});

test("resolveRepairBookingServiceId should prefer a valid requested service id", () => {
  assert.equal(
    resolveRepairBookingServiceId({
      services: [{ id: "service-1" }, { id: "service-2" }],
      requestedServiceId: "service-2",
      currentServiceId: "service-1",
    }),
    "service-2"
  );
});

test("resolveRepairBookingServiceId should keep the current service when request is invalid", () => {
  assert.equal(
    resolveRepairBookingServiceId({
      services: [{ id: "service-1" }, { id: "service-2" }],
      requestedServiceId: "missing-service",
      currentServiceId: "service-1",
    }),
    "service-1"
  );
});

test("resolveRepairBookingServiceId should fall back to the first service when needed", () => {
  assert.equal(
    resolveRepairBookingServiceId({
      services: [{ id: "service-1" }],
      requestedServiceId: "",
      currentServiceId: "",
    }),
    "service-1"
  );

  assert.equal(resolveRepairBookingServiceId({ services: [] }), "");
});

test("validateRepairBookingForm should return RBK-101 for missing required fields", () => {
  const result = validateRepairBookingForm({
    name: "",
    phone: "0777777777",
    serviceId: "svc",
    mode: "delivery",
    address: "عمان",
  });

  assert.match(result, /^\[RBK-101\]/);
});

test("validateRepairBookingForm should require address only for delivery mode", () => {
  const deliveryResult = validateRepairBookingForm({
    name: "أحمد",
    phone: "0777777777",
    serviceId: "svc",
    mode: "delivery",
    address: "",
  });
  const remoteResult = validateRepairBookingForm({
    name: "أحمد",
    phone: "0777777777",
    serviceId: "svc",
    mode: "remote",
    address: "",
  });

  assert.match(deliveryResult, /^\[RBK-102\]/);
  assert.equal(remoteResult, "");
});

test("buildRepairBookingPayload should keep legacy required fields non-null when repair is remote", () => {
  const description = " تثبيت برامج ";
  const payload = buildRepairBookingPayload({
    bookingId: "bk-123",
    form: {
      name: "  أحمد  ",
      phone: " 0777777777 ",
      serviceId: "svc-1",
      description,
      mode: "remote",
      address: "عمّان",
    },
    selectedService: { name: "تنصيب وبرمجة" },
  });

  assert.equal(payload.id, "bk-123");
  assert.equal(payload.name, "أحمد");
  assert.equal(payload.phone, "0777777777");
  assert.equal(payload.service_name, "تنصيب وبرمجة");
  assert.equal(payload.address, null);
  assert.equal(payload.description, description.trim());
  assert.equal(typeof payload.device, "string");
  assert.notEqual(payload.device.trim(), "");
  assert.equal(payload.email, undefined);
});

test("buildRepairBookingPayload should preserve a provided device value", () => {
  const payload = buildRepairBookingPayload({
    bookingId: "bk-456",
    form: {
      name: "سارة",
      phone: "0790000000",
      serviceId: "svc-1",
      device: "Laptop Dell XPS",
      description: "",
      mode: "pickup",
      address: "",
    },
    selectedService: { name: "صيانة حاسوب" },
  });

  assert.equal(payload.device, "Laptop Dell XPS");
  assert.equal(payload.description, "");
});

test("getRepairModeHelper should explain remote maintenance clearly", () => {
  assert.match(getRepairModeHelper("remote"), /عن بعد/);
});

test("validateRepairBookingForm should reject malformed phone numbers", () => {
  const result = validateRepairBookingForm({
    name: "أحمد",
    phone: "077",
    serviceId: "svc",
    mode: "remote",
    address: "",
  });

  assert.match(result, /^\[RBK-103\]/);
});

test("validateRepairBookingForm should reject past preferred dates", () => {
  const result = validateRepairBookingForm({
    name: "أحمد",
    phone: "0777777777",
    serviceId: "svc",
    mode: "remote",
    address: "",
    preferredDate: "2020-01-01",
  });

  assert.match(result, /^\[RBK-104\]/);
});

test("validateRepairBookingForm should reject unsupported repair modes", () => {
  const result = validateRepairBookingForm({
    name: "أحمد",
    phone: "0777777777",
    serviceId: "svc",
    mode: "teleport",
    address: "",
  });

  assert.match(result, /^\[RBK-105\]/);
});

test("buildRepairBookingPayload should throw when the form fails validation", () => {
  assert.throws(
    () =>
      buildRepairBookingPayload({
        bookingId: "bk-fail",
        form: {
          name: "أحمد",
          phone: "invalid",
          serviceId: "svc-1",
          description: "",
          mode: "remote",
          address: "",
        },
        selectedService: { name: "خدمة" },
      }),
    /\[RBK-103\]/
  );
});
