/**
 * Tests for repair booking service account-prefill behavior.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  createRepairBooking,
  getRepairBookingAccountSnapshot,
} from "./repairBookingService.js";

const ORIGINAL_FETCH = globalThis.fetch;

test.afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});

/**
 * Creates a fake Supabase client for account snapshot tests.
 *
 * @param {{
 *   authError?: { message?: string, name?: string } | null,
 *   profile?: { full_name?: string, phone?: string } | null,
 *   profileError?: { message?: string } | null,
 *   user?: { id?: string } | null,
 * }} options
 * @returns {{ client: Record<string, unknown>, profileLookupCount: () => number }}
 */
function createRepairBookingClient({
  authError = null,
  profile = null,
  profileError = null,
  user = null,
} = {}) {
  let profileLookups = 0;

  return {
    client: {
      auth: {
        async getUser() {
          return { data: { user }, error: authError };
        },
      },
      from(table) {
        assert.equal(table, "user_profiles");
        profileLookups += 1;

        return {
          select(fields) {
            assert.equal(fields, "full_name, phone");
            return {
              eq(column, value) {
                assert.equal(column, "user_id");
                assert.equal(value, "user-1");

                return {
                  async maybeSingle() {
                    return { data: profile, error: profileError };
                  },
                };
              },
            };
          },
        };
      },
    },
    profileLookupCount() {
      return profileLookups;
    },
  };
}

/**
 * Creates a minimal booking-session client stub.
 *
 * @param {{ accessToken?: string }} [options={}] - Session options.
 * @returns {{ auth: { getSession: () => Promise<{ data: { session: { access_token: string } | null } }> } }}
 */
function createBookingSessionClient(options = {}) {
  const accessToken = String(options.accessToken || "");

  return {
    auth: {
      async getSession() {
        return {
          data: {
            session: accessToken ? { access_token: accessToken } : null,
          },
        };
      },
    },
  };
}

test("getRepairBookingAccountSnapshot should treat missing auth sessions as guests", async () => {
  const { client, profileLookupCount } = createRepairBookingClient({
    authError: {
      message: "Auth session missing!",
      name: "AuthSessionMissingError",
    },
  });

  const snapshot = await getRepairBookingAccountSnapshot(client);

  assert.deepEqual(snapshot, {
    userId: "",
    name: "",
    phone: "",
    isAccountPrefilled: false,
  });
  assert.equal(profileLookupCount(), 0);
});

test("getRepairBookingAccountSnapshot should prefill profile data for signed-in users", async () => {
  const { client } = createRepairBookingClient({
    profile: {
      full_name: "Ahmad",
      phone: "0790000000",
    },
    user: { id: "user-1" },
  });

  const snapshot = await getRepairBookingAccountSnapshot(client);

  assert.deepEqual(snapshot, {
    userId: "user-1",
    name: "Ahmad",
    phone: "0790000000",
    isAccountPrefilled: true,
  });
});

test("createRepairBooking should post the supplied idempotency key and auth token", async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "/api/repair-booking");
    assert.equal(options.method, "POST");
    assert.equal(options.headers.Authorization, "Bearer token-1");
    assert.equal(options.headers["Content-Type"], "application/json");
    assert.equal(options.headers["Idempotency-Key"], "repair-key-123");
    assert.deepEqual(JSON.parse(String(options.body)), {
      name: "Ahmad",
      phone: "0790000000",
      serviceId: "repair-1",
      description: "Broken fan",
      mode: "delivery",
      address: "Amman",
      preferredDate: "2026-06-01",
    });

    return Response.json({
      success: true,
      data: { id: "bk-1", display_number: 2001 },
    }, { status: 201 });
  };

  const result = await createRepairBooking({
    client: createBookingSessionClient({ accessToken: "token-1" }),
    form: {
      name: "Ahmad",
      phone: "0790000000",
      serviceId: "repair-1",
      description: "Broken fan",
      mode: "delivery",
      address: "Amman",
      preferredDate: "2026-06-01",
    },
    idempotencyKey: "repair-key-123",
  });

  assert.deepEqual(result, {
    data: { id: "bk-1", display_number: 2001 },
    error: null,
  });
});

test("createRepairBooking should generate an idempotency key when one is not supplied", async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "/api/repair-booking");
    assert.match(String(options.headers["Idempotency-Key"] || ""), /^[A-Za-z0-9_-]{8,128}$/u);

    return Response.json({
      success: false,
      error: "[RBK-301] Failed to save booking",
    }, { status: 500 });
  };

  const result = await createRepairBooking({
    client: createBookingSessionClient(),
    form: {
      name: "Sara",
      phone: "0780000000",
      serviceId: "repair-2",
      description: "No power",
      mode: "pickup",
    },
  });

  assert.deepEqual(result, {
    error: { message: "[RBK-301] Failed to save booking" },
  });
});
