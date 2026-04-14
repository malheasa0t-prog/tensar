export const BANNED_ACCOUNT_MESSAGE = "حسابك محظور. تواصل مع الإدارة.";
const USER_ACCESS_LOOKUP_ERROR = "تعذر التحقق من حالة المستخدم.";
const BANNED_PROFILE_STATUS = "banned";

/**
 * Extracts a bearer token from an authorization header value.
 *
 * @param {unknown} authorizationHeader
 * @returns {string}
 */
export function extractBearerToken(authorizationHeader) {
  const header = typeof authorizationHeader === "string" ? authorizationHeader.trim() : "";
  return header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
}

/**
 * Determines whether the provided profile status represents a banned account.
 *
 * @param {unknown} status
 * @returns {boolean}
 */
export function isProfileBanned(status) {
  return typeof status === "string" && status.trim().toLowerCase() === BANNED_PROFILE_STATUS;
}

/**
 * Loads the current profile status for an authenticated user.
 *
 * @param {{ userId: string, adminClient: { from: (table: string) => { select: (fields: string) => { eq: (column: string, value: string) => { maybeSingle: () => Promise<{ data: { status?: string } | null, error: unknown }> } } } } }} input
 * @returns {Promise<string>}
 * @throws {Error}
 */
async function loadUserProfileStatus({ userId, adminClient }) {
  const response = await adminClient.from("user_profiles").select("status").eq("user_id", userId).maybeSingle();
  if (response?.error) {
    throw new Error(USER_ACCESS_LOOKUP_ERROR);
  }

  return typeof response?.data?.status === "string" ? response.data.status : "";
}

/**
 * Loads the default privileged/authenticated Supabase clients on demand.
 *
 * @returns {Promise<{ serverClient: { auth: { getUser: (token: string) => Promise<{ data?: { user?: { id?: string } | null } }> } }, adminClient: { from: (table: string) => { select: (fields: string) => { eq: (column: string, value: string) => { maybeSingle: () => Promise<{ data: { status?: string } | null, error: unknown }> } } } } }>}
 */
async function loadDefaultUserAccessClients() {
  const { supabaseAdmin, supabaseServer } = await import("../lib/supabaseServer.js");
  return { serverClient: supabaseServer, adminClient: supabaseAdmin };
}

/**
 * Resolves the optional authenticated user and whether that account is banned.
 *
 * @param {{ token: string, serverClient?: { auth: { getUser: (token: string) => Promise<{ data?: { user?: { id?: string } | null } }> } }, adminClient?: { from: (table: string) => { select: (fields: string) => { eq: (column: string, value: string) => { maybeSingle: () => Promise<{ data: { status?: string } | null, error: unknown }> } } } } }} input
 * @returns {Promise<{ userId: string | null, isBanned: boolean }>}
 * @throws {Error}
 */
export async function getOptionalUserAccessState({
  token,
  serverClient,
  adminClient,
}) {
  const normalizedToken = typeof token === "string" ? token.trim() : "";
  if (!normalizedToken) {
    return { userId: null, isBanned: false };
  }

  const defaultClients =
    serverClient && adminClient ? null : await loadDefaultUserAccessClients();
  const activeServerClient = serverClient || defaultClients.serverClient;
  const activeAdminClient = adminClient || defaultClients.adminClient;
  const authResponse = await activeServerClient.auth.getUser(normalizedToken);
  const userId = authResponse?.data?.user?.id || null;
  if (!userId) {
    return { userId: null, isBanned: false };
  }

  const profileStatus = await loadUserProfileStatus({ userId, adminClient: activeAdminClient });
  return { userId, isBanned: isProfileBanned(profileStatus) };
}
