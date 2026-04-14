import assert from "node:assert/strict";
import test from "node:test";
import {
  buildHeaderCategoryLinks,
  fetchHeaderAuthSnapshot,
  fetchHeaderSnapshot,
  resolveHeaderUserLabel,
  subscribeToHeaderAuthChanges,
} from "./headerService.js";

function createHeaderClient({
  categories = [],
  profileFullName = "",
  settings = {},
  unreadNotifications = 0,
  user = null,
  walletBalance = 0,
} = {}) {
  return {
    from(table) {
      if (table === "settings") {
        return {
          select() {
            return {
              limit() {
                return {
                  maybeSingle: async () => ({ data: { data: settings } }),
                };
              },
            };
          },
        };
      }

      if (table === "categories") {
        return {
          select() {
            return {
              eq() {
                return {
                  is() {
                    return {
                      order: async () => ({ data: categories, error: null }),
                    };
                  },
                };
              },
            };
          },
        };
      }

      if (table === "user_profiles") {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({ data: profileFullName ? { full_name: profileFullName } : null }),
                };
              },
            };
          },
        };
      }

      if (table === "wallets") {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({ data: { balance: walletBalance } }),
                };
              },
            };
          },
        };
      }

      if (table === "notifications") {
        return {
          select() {
            return {
              eq() {
                return {
                  eq() {
                    return Promise.resolve({ count: unreadNotifications });
                  },
                };
              },
            };
          },
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
    auth: {
      async getUser() {
        return { data: { user } };
      },
      onAuthStateChange(callback) {
        return {
          data: {
            subscription: {
              unsubscribe() {
                callback = null;
              },
            },
          },
        };
      },
    },
  };
}

test("buildHeaderCategoryLinks should keep only visible active categories", () => {
  const links = buildHeaderCategoryLinks({
    categories: [
      { id: "laptops", name: "لابتوبات", slug: "laptops", status: "active" },
      { id: "hidden", name: "مخفي", status: "inactive" },
      { id: "blocked", name: "محجوب", status: "active", show_in_navbar: false },
    ],
    siteSettings: {
      categoryNavVisibility: {
        blocked: true,
      },
    },
  });

  assert.deepEqual(links, [
    {
      href: "/category/laptops",
      label: "لابتوبات",
      id: "laptops",
      image: "",
    },
  ]);
});

test("resolveHeaderUserLabel should prefer profile name over metadata and email", () => {
  const label = resolveHeaderUserLabel({
    user: {
      email: "ali@example.com",
      user_metadata: { full_name: "Ali Metadata" },
    },
    profileFullName: "Ali Profile",
  });

  assert.equal(label, "Ali Profile");
});

test("fetchHeaderSnapshot should return normalized settings and mapped category links", async () => {
  const snapshot = await fetchHeaderSnapshot(
    createHeaderClient({
      categories: [{ id: "gaming", name: "ألعاب", slug: "gaming", status: "active" }],
      settings: {
        navigation: {
          headerBefore: [],
          headerAfter: [],
          mobilePrimary: [],
        },
      },
    })
  );

  assert.equal(snapshot.siteSettings.company.name, "TechZone");
  assert.deepEqual(snapshot.dynamicLinks, [
    {
      href: "/category/gaming",
      label: "ألعاب",
      id: "gaming",
      image: "",
    },
  ]);
});

test("fetchHeaderAuthSnapshot should return the login label for guests", async () => {
  const snapshot = await fetchHeaderAuthSnapshot(createHeaderClient());

  assert.equal(snapshot.user, null);
  assert.equal(snapshot.userLabel, "تسجيل الدخول");
  assert.equal(snapshot.walletBalance, 0);
  assert.equal(snapshot.unreadNotifications, 0);
});

test("fetchHeaderAuthSnapshot should include wallet and notification stats for signed-in users", async () => {
  const snapshot = await fetchHeaderAuthSnapshot(
    createHeaderClient({
      profileFullName: "Ali Profile",
      unreadNotifications: 4,
      user: {
        id: "user-1",
        email: "ali@example.com",
        user_metadata: {},
      },
      walletBalance: 19.5,
    })
  );

  assert.equal(snapshot.userLabel, "Ali Profile");
  assert.equal(snapshot.walletBalance, 19.5);
  assert.equal(snapshot.unreadNotifications, 4);
});

test("fetchHeaderAuthSnapshot should skip the profile lookup when auth metadata already has a display name", async () => {
  let profileQueried = false;
  const client = createHeaderClient({
    unreadNotifications: 1,
    user: {
      id: "user-2",
      email: "mona@example.com",
      user_metadata: { full_name: "Mona Metadata" },
    },
    walletBalance: 7,
  });

  const originalFrom = client.from;
  client.from = (table) => {
    if (table === "user_profiles") {
      profileQueried = true;
    }

    return originalFrom(table);
  };

  const snapshot = await fetchHeaderAuthSnapshot(client);
  assert.equal(snapshot.userLabel, "Mona Metadata");
  assert.equal(profileQueried, false);
});

test("subscribeToHeaderAuthChanges should return a safe unsubscribe function", () => {
  const unsubscribe = subscribeToHeaderAuthChanges(() => {}, createHeaderClient());

  assert.equal(typeof unsubscribe, "function");
  assert.doesNotThrow(() => unsubscribe());
});
