import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDeliveryLookupResult,
  buildRepairLookupResult,
  inferLookupType,
  lookupPublicOrderByNumber,
  normalizeLookupType,
  normalizeOrderNumber,
  resolveLookupStatus,
} from "./orderLookupService.js";

/**
 * Creates a minimal admin client stub for order lookup tests.
 *
 * @param {{
 *   orders?: Array<Record<string, unknown>>,
 *   repairBookings?: Array<Record<string, unknown>>,
 * }} input
 * @returns {{ from: (table: string) => { select: () => { eq: (column: string, value: string) => { eq: (column: string, value: string) => { maybeSingle: () => Promise<{ data: Record<string, unknown> | null }> }, maybeSingle: () => Promise<{ data: Record<string, unknown> | null }> } } } }}
 */
function createAdminClientStub({ orders = [], repairBookings = [] } = {}) {
  const tables = { orders, repair_bookings: repairBookings };

  return {
    from(table) {
      return {
        select() {
          const filters = [];

          function runQuery() {
            const rows = tables[table] || [];
            const found = rows.find((row) => filters.every(([column, value]) => String(row[column] || "") === String(value)));
            return Promise.resolve({ data: found || null });
          }

          return {
            eq(column, value) {
              filters.push([column, value]);
              return {
                eq(nextColumn, nextValue) {
                  filters.push([nextColumn, nextValue]);
                  return { maybeSingle: runQuery };
                },
                maybeSingle: runQuery,
              };
            },
          };
        },
      };
    },
  };
}

test("normalizeLookupType should fallback to all for unsupported values", () => {
  assert.equal(normalizeLookupType("unknown"), "all");
  assert.equal(normalizeLookupType("repair"), "repair");
});

test("normalizeOrderNumber should trim and normalize valid order numbers", () => {
  assert.equal(normalizeOrderNumber("  BK-12345 "), "bk-12345");
  assert.equal(normalizeOrderNumber(" 2000 "), "#2000");
  assert.equal(normalizeOrderNumber(" #2001 "), "#2001");
});

test("normalizeOrderNumber should reject invalid order numbers", () => {
  assert.throws(() => normalizeOrderNumber("not-real"), /رقم طلب صحيح/);
});

test("inferLookupType should prioritize the booking prefix", () => {
  assert.equal(inferLookupType({ lookupType: "all", orderNumber: "bk-123" }), "repair");
  assert.equal(inferLookupType({ lookupType: "all", orderNumber: "ord-123" }), "delivery");
  assert.equal(inferLookupType({ lookupType: "repair", orderNumber: "#2000" }), "repair");
});

test("resolveLookupStatus should return mapped labels", () => {
  const repairStatus = resolveLookupStatus({ requestType: "repair", status: "ready" });
  const deliveryStatus = resolveLookupStatus({ requestType: "delivery", status: "shipped" });

  assert.equal(repairStatus.label, "جاهز للاستلام");
  assert.equal(deliveryStatus.label, "تم الشحن");
});

test("buildRepairLookupResult should produce public-safe repair details", () => {
  const result = buildRepairLookupResult({
    id: "bk-101",
    display_number: 2000,
    service_name: "صيانة لابتوب",
    mode: "delivery",
    status: "diagnosing",
    created_at: "2026-04-08T01:00:00.000Z",
    updated_at: "2026-04-08T02:00:00.000Z",
  });

  assert.equal(result.requestType, "repair");
  assert.equal(result.title, "صيانة لابتوب");
  assert.equal(result.orderNumber, "#2000");
  assert.equal(result.details[1].value, "استلام وتوصيل");
});

test("buildDeliveryLookupResult should produce delivery details", () => {
  const result = buildDeliveryLookupResult({
    id: "ord-301",
    display_number: 2001,
    delivery_method: "delivery",
    status: "processing",
    created_at: "2026-04-08T01:00:00.000Z",
    updated_at: "2026-04-08T02:00:00.000Z",
  });

  assert.equal(result.requestType, "delivery");
  assert.equal(result.orderNumber, "#2001");
  assert.equal(result.status.label, "قيد التجهيز");
  assert.equal(result.details[1].value, "توصيل");
});

test("lookupPublicOrderByNumber should resolve repair bookings", async () => {
  const adminClient = createAdminClientStub({
    repairBookings: [
      {
        id: "bk-200",
        display_number: 2002,
        service_name: "فحص جهاز",
        mode: "pickup",
        status: "pending",
        created_at: "2026-04-08T01:00:00.000Z",
        updated_at: "2026-04-08T02:00:00.000Z",
      },
    ],
  });

  const result = await lookupPublicOrderByNumber({
    adminClient,
    lookupType: "all",
    orderNumber: "bk-200",
  });

  assert.equal(result?.requestType, "repair");
  assert.equal(result?.orderNumber, "#2002");
});

test("lookupPublicOrderByNumber should resolve display numbers", async () => {
  const adminClient = createAdminClientStub({
    repairBookings: [
      {
        id: "bk-201",
        display_number: 2003,
        service_name: "فحص جهاز",
        mode: "pickup",
        status: "pending",
        created_at: "2026-04-08T01:00:00.000Z",
      },
    ],
  });

  const result = await lookupPublicOrderByNumber({
    adminClient,
    lookupType: "repair",
    orderNumber: "#2003",
  });

  assert.equal(result?.requestType, "repair");
  assert.equal(result?.orderNumber, "#2003");
});

test("lookupPublicOrderByNumber should resolve delivery orders", async () => {
  const adminClient = createAdminClientStub({
    orders: [
      {
        id: "ord-200",
        delivery_method: "delivery",
        status: "delivered",
        created_at: "2026-04-08T01:00:00.000Z",
        updated_at: "2026-04-08T02:00:00.000Z",
      },
    ],
  });

  const result = await lookupPublicOrderByNumber({
    adminClient,
    lookupType: "delivery",
    orderNumber: "ord-200",
  });

  assert.equal(result?.requestType, "delivery");
  assert.equal(result?.status.label, "تم التسليم");
});

test("lookupPublicOrderByNumber should return null when nothing matches", async () => {
  const adminClient = createAdminClientStub();
  const result = await lookupPublicOrderByNumber({
    adminClient,
    lookupType: "all",
    orderNumber: "ord-999",
  });

  assert.equal(result, null);
});
