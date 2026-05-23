import test from "node:test";
import assert from "node:assert/strict";
import {
  fetchGlobalSearchSnapshot,
  loadGlobalSearchSnapshot,
  resetGlobalSearchSnapshotCache,
} from "./globalSearchService.js";

/**
 * Creates a small chainable Supabase query mock for one table.
 *
 * @param {{ data?: unknown, error?: unknown }} response - Query response.
 * @returns {Record<string, Function>} Chainable query mock.
 */
function createQueryMock(response) {
  const builder = {
    select() {
      return builder;
    },
    eq() {
      return builder;
    },
    in() {
      return Promise.resolve(response);
    },
    order() {
      return Promise.resolve(response);
    },
  };

  return builder;
}

/**
 * Creates a mock Supabase client keyed by table name.
 *
 * @param {Record<string, { data?: unknown, error?: unknown }>} responses - Mock responses.
 * @param {{ calls: Record<string, number> }} tracker - Call counter.
 * @returns {{ from: (table: string) => Record<string, Function> }} Mock Supabase client.
 */
function createClientMock(responses, tracker) {
  return {
    from(table) {
      tracker.calls[table] = (tracker.calls[table] || 0) + 1;
      return createQueryMock(responses[table] || { data: [], error: null });
    },
  };
}

test("loadGlobalSearchSnapshot should build a normalized snapshot from service sources", async () => {
  resetGlobalSearchSnapshotCache();
  const tracker = { calls: {} };
  const client = createClientMock(
    {
      repair_services: {
        data: [{ id: "svc-1", name: "صيانة لابتوب", category: "الصيانة", price: 15 }],
      },
      categories: {
        data: [{ id: "cat-1", name: "لابتوبات", slug: "laptops", parent_id: null }],
      },
    },
    tracker
  );

  const snapshot = await loadGlobalSearchSnapshot(client);

  assert.equal(snapshot.items.length, 2);
  assert.ok(snapshot.quickFilters.some((filter) => filter.label === "لابتوبات"));
  assert.ok(snapshot.popularSuggestions.includes("صيانة لابتوب"));
  assert.deepEqual(tracker.calls, { repair_services: 1, categories: 1 });
});

test("loadGlobalSearchSnapshot should return partial data when one source fails", async () => {
  resetGlobalSearchSnapshotCache();
  const tracker = { calls: {} };
  const client = createClientMock(
    {
      repair_services: {
        data: null,
        error: { message: "services unavailable" },
      },
      categories: {
        data: [{ id: "cat-1", name: "شاشات", slug: "monitors", parent_id: null }],
      },
    },
    tracker
  );

  const snapshot = await loadGlobalSearchSnapshot(client);

  assert.equal(snapshot.items.length, 1);
  assert.deepEqual(snapshot.sourceErrors, ["services unavailable"]);
});

test("loadGlobalSearchSnapshot should throw when all sources fail and no items are available", async () => {
  resetGlobalSearchSnapshotCache();
  const tracker = { calls: {} };
  const client = createClientMock(
    {
      repair_services: { data: null, error: { message: "services unavailable" } },
      categories: { data: null, error: { message: "categories unavailable" } },
    },
    tracker
  );

  await assert.rejects(() => loadGlobalSearchSnapshot(client), /تعذر تحميل بيانات البحث حالياً/);
});

test("fetchGlobalSearchSnapshot should cache the most recent successful snapshot", async () => {
  resetGlobalSearchSnapshotCache();
  const tracker = { calls: {} };
  const client = createClientMock(
    {
      repair_services: {
        data: [{ id: "svc-1", name: "تشخيص جهاز", category: "الصيانة", price: 20 }],
      },
      categories: {
        data: [{ id: "cat-1", name: "الصيانة", slug: "repair", parent_id: null }],
      },
    },
    tracker
  );

  const firstSnapshot = await fetchGlobalSearchSnapshot(client);
  const secondSnapshot = await fetchGlobalSearchSnapshot(client);

  assert.equal(firstSnapshot, secondSnapshot);
  assert.deepEqual(tracker.calls, { repair_services: 1, categories: 1 });
});
