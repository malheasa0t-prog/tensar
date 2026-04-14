import test from "node:test";
import assert from "node:assert/strict";
import {
  BANNED_ACCOUNT_MESSAGE,
  extractBearerToken,
  getOptionalUserAccessState,
  isProfileBanned,
} from "./userAccessService.js";

/**
 * Creates a minimal auth/profile client pair for user access tests.
 *
 * @param {{
 *   userId?: string | null,
 *   profileStatus?: string,
 *   profileError?: Record<string, unknown> | null,
 *   onProfileLookup?: (userId: string) => void,
 * }} [options]
 * @returns {{ serverClient: { auth: { getUser: (token: string) => Promise<{ data: { user: { id: string } | null } }> } }, adminClient: { from: (table: string) => { select: (fields: string) => { eq: (column: string, userId: string) => { maybeSingle: () => Promise<{ data: { status: string } | null, error: Record<string, unknown> | null }> } } } } }}
 */
function createUserAccessClients({
  userId = null,
  profileStatus = "",
  profileError = null,
  onProfileLookup = () => {},
} = {}) {
  return {
    serverClient: {
      auth: {
        async getUser(token) {
          assert.equal(token, "token-123");
          return { data: { user: userId ? { id: userId } : null } };
        },
      },
    },
    adminClient: {
      from(table) {
        assert.equal(table, "user_profiles");
        return {
          select(fields) {
            assert.equal(fields, "status");
            return {
              eq(column, currentUserId) {
                assert.equal(column, "user_id");
                onProfileLookup(currentUserId);
                return {
                  async maybeSingle() {
                    return {
                      data: profileStatus ? { status: profileStatus } : null,
                      error: profileError,
                    };
                  },
                };
              },
            };
          },
        };
      },
    },
  };
}

test("extractBearerToken should return the bearer token from the authorization header", () => {
  assert.equal(extractBearerToken("Bearer token-123"), "token-123");
});

test("extractBearerToken should ignore malformed authorization headers", () => {
  assert.equal(extractBearerToken("Basic token-123"), "");
  assert.equal(extractBearerToken(null), "");
});

test("isProfileBanned should detect banned status values case-insensitively", () => {
  assert.equal(isProfileBanned(" banned "), true);
  assert.equal(isProfileBanned("active"), false);
});

test("getOptionalUserAccessState should return guest access when there is no token", async () => {
  const result = await getOptionalUserAccessState({ token: "" });

  assert.deepEqual(result, { userId: null, isBanned: false });
});

test("getOptionalUserAccessState should return banned access for banned authenticated users", async () => {
  const lookedUpUserIds = [];
  const { serverClient, adminClient } = createUserAccessClients({
    userId: "user-1",
    profileStatus: "banned",
    onProfileLookup(userId) {
      lookedUpUserIds.push(userId);
    },
  });

  const result = await getOptionalUserAccessState({
    token: "token-123",
    serverClient,
    adminClient,
  });

  assert.deepEqual(result, { userId: "user-1", isBanned: true });
  assert.deepEqual(lookedUpUserIds, ["user-1"]);
});

test("getOptionalUserAccessState should throw a user-friendly error when profile lookup fails", async () => {
  const { serverClient, adminClient } = createUserAccessClients({
    userId: "user-1",
    profileError: { message: "db failed" },
  });

  await assert.rejects(
    () => getOptionalUserAccessState({ token: "token-123", serverClient, adminClient }),
    /تعذر التحقق من حالة المستخدم\./
  );
});

test("BANNED_ACCOUNT_MESSAGE should expose the public banned account copy", () => {
  assert.equal(BANNED_ACCOUNT_MESSAGE, "حسابك محظور. تواصل مع الإدارة.");
});
