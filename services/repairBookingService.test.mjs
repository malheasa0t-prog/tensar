/**
 * Tests for repair booking service account-prefill behavior.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { getRepairBookingAccountSnapshot } from "./repairBookingService.js";

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
