export const BANNED_ACCOUNT_MESSAGE = "حسابك محظور. تواصل مع الإدارة.";
const USER_ACCESS_LOOKUP_ERROR = "[UAS-301] تعذر التحقق من حالة المستخدم.";
const USER_ACCESS_CLIENTS_ERROR = "[UAS-302] Explicit server and admin clients, or a secure server-side loader, are required.";
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
 * Resolves the Supabase clients needed for user-access checks.
 *
 * @param {{
 *   serverClient?: { auth: { getUser: (token: string) => Promise<{ data?: { user?: { id?: string } | null } }> } },
 *   adminClient?: { from: (table: string) => { select: (fields: string) => { eq: (column: string, value: string) => { maybeSingle: () => Promise<{ data: { status?: string } | null, error: unknown }> } } } } },
 *   loadClients?: () => Promise<{ serverClient?: { auth: { getUser: (token: string) => Promise<{ data?: { user?: { id?: string } | null } }> } }, adminClient?: { from: (table: string) => { select: (fields: string) => { eq: (column: string, value: string) => { maybeSingle: () => Promise<{ data: { status?: string } | null, error: unknown }> } } } } }>,
 * }} input
 * @returns {Promise<{ serverClient: { auth: { getUser: (token: string) => Promise<{ data?: { user?: { id?: string } | null } }> } }, adminClient: { from: (table: string) => { select: (fields: string) => { eq: (column: string, value: string) => { maybeSingle: () => Promise<{ data: { status?: string } | null, error: unknown }> } } } } }>}
 * @throws {Error}
 */
async function resolveUserAccessClients({ serverClient, adminClient, loadClients }) {
  if (serverClient && adminClient) {
    return { serverClient, adminClient };
  }

  if (typeof loadClients !== "function") {
    throw new Error(USER_ACCESS_CLIENTS_ERROR);
  }

  const resolvedClients = await loadClients();
  if (!resolvedClients?.serverClient || !resolvedClients?.adminClient) {
    throw new Error(USER_ACCESS_CLIENTS_ERROR);
  }

  return {
    serverClient: resolvedClients.serverClient,
    adminClient: resolvedClients.adminClient,
  };
}

/**
 * Resolves the optional authenticated user and whether that account is banned.
 *
 * @param {{
 *   token: string,
 *   serverClient?: { auth: { getUser: (token: string) => Promise<{ data?: { user?: { id?: string } | null } }> } },
 *   adminClient?: { from: (table: string) => { select: (fields: string) => { eq: (column: string, value: string) => { maybeSingle: () => Promise<{ data: { status?: string } | null, error: unknown }> } } } } },
 *   loadClients?: () => Promise<{ serverClient?: { auth: { getUser: (token: string) => Promise<{ data?: { user?: { id?: string } | null } }> } }, adminClient?: { from: (table: string) => { select: (fields: string) => { eq: (column: string, value: string) => { maybeSingle: () => Promise<{ data: { status?: string } | null, error: unknown }> } } } } }>,
 * }} input
 * @returns {Promise<{ userId: string | null, isBanned: boolean }>}
 * @throws {Error}
 */
export async function getOptionalUserAccessState({
  token,
  serverClient,
  adminClient,
  loadClients,
}) {
  const normalizedToken = typeof token === "string" ? token.trim() : "";
  if (!normalizedToken) {
    return { userId: null, isBanned: false };
  }

  const resolvedClients = await resolveUserAccessClients({
    serverClient,
    adminClient,
    loadClients,
  });
  const activeServerClient = resolvedClients.serverClient;
  const activeAdminClient = resolvedClients.adminClient;
  const authResponse = await activeServerClient.auth.getUser(normalizedToken);
  const userId = authResponse?.data?.user?.id || null;
  if (!userId) {
    return { userId: null, isBanned: false };
  }

  const profileStatus = await loadUserProfileStatus({ userId, adminClient: activeAdminClient });
  return { userId, isBanned: isProfileBanned(profileStatus) };
}
