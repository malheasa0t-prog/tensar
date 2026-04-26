import test from "node:test";
import assert from "node:assert/strict";

import {
  fetchDashboardProfile,
  fetchDashboardSessionUser,
  fetchDashboardWalletSnapshot,
  fetchUnreadNotificationsCount,
  subscribeToDashboardAuthChanges,
} from "./dashboardShellService.js";

function createDashboardShellClient({
  authError = null,
  notificationCount = 0,
  profile = null,
  user = null,
  wallet = null,
} = {}) {
  const authSubscribers = [];

  return {
    auth: {
      async getUser() {
        return { data: { user }, error: authError };
      },
      onAuthStateChange(callback) {
        authSubscribers.push(callback);
        return {
          data: {
            subscription: {
              unsubscribe() {
                authSubscribers.length = 0;
              },
            },
          },
        };
      },
    },
    emitAuthChange(event, session) {
      authSubscribers.forEach((callback) => callback(event, session));
    },
    from(table) {
      if (table === "notifications") {
        return {
          select(fields, options) {
            assert.equal(fields, "id");
            assert.deepEqual(options, { count: "exact", head: true });
            return {
              eq(column, value) {
                assert.equal(column, "user_id");
                assert.equal(value, "user-1");
                return {
                  async eq(nextColumn, nextValue) {
                    assert.equal(nextColumn, "is_read");
                    assert.equal(nextValue, false);
                    return { count: notificationCount };
                  },
                };
              },
            };
          },
        };
      }

      if (table === "user_profiles" || table === "wallets") {
        return {
          select(fields) {
            assert.equal(fields, "*");
            return {
              eq(column, value) {
                assert.equal(column, "user_id");
                assert.equal(value, "user-1");
                return {
                  async single() {
                    return { data: table === "user_profiles" ? profile : wallet };
                  },
                };
              },
            };
          },
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  };
}

test("fetchDashboardSessionUser should return the authenticated user", async () => {
  const result = await fetchDashboardSessionUser({
    client: createDashboardShellClient({ user: { id: "user-1" } }),
  });

  assert.deepEqual(result, { id: "user-1" });
});

test("fetchDashboardSessionUser should throw a stable error when auth lookup fails", async () => {
  await assert.rejects(
    fetchDashboardSessionUser({
      client: createDashboardShellClient({
        authError: { message: "JWT expired" },
      }),
    }),
    /\[DSH-306\]/
  );
});

test("fetchDashboardProfile should return the profile snapshot when it exists", async () => {
  const result = await fetchDashboardProfile({
    client: createDashboardShellClient({ profile: { full_name: "Ali" } }),
    userId: "user-1",
  });

  assert.deepEqual(result, { full_name: "Ali" });
});

test("fetchUnreadNotificationsCount should normalize the exact count", async () => {
  const result = await fetchUnreadNotificationsCount({
    client: createDashboardShellClient({ notificationCount: 7 }),
    userId: "user-1",
  });

  assert.equal(result, 7);
});

test("fetchDashboardWalletSnapshot should return the wallet row when available", async () => {
  const result = await fetchDashboardWalletSnapshot({
    client: createDashboardShellClient({ wallet: { balance: 12.5 } }),
    userId: "user-1",
  });

  assert.deepEqual(result, { balance: 12.5 });
});

test("subscribeToDashboardAuthChanges should proxy auth events and unsubscribe safely", () => {
  const events = [];
  const client = createDashboardShellClient();
  const unsubscribe = subscribeToDashboardAuthChanges({
    client,
    onAuthChange(input) {
      events.push(input);
    },
  });

  client.emitAuthChange("SIGNED_OUT", null);
  unsubscribe();
  client.emitAuthChange("SIGNED_IN", { user: { id: "user-2" } });

  assert.deepEqual(events, [{ event: "SIGNED_OUT", session: null }]);
});
