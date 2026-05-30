/**
 * Shared admin session lookup for the legacy admin shell.
 */

const ADMIN_SESSION_ROUTE = "/api/admin/session";
const ADMIN_SESSION_UNAVAILABLE_MESSAGE =
  "[ADS-201] \u062A\u0639\u0630\u0631 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u062C\u0644\u0633\u0629 \u0627\u0644\u0623\u062F\u0645\u0646 \u0627\u0644\u062D\u0627\u0644\u064A\u0629.";

/**
 * Reads the current authenticated access token from the base Supabase client.
 *
 * @param {{ auth?: { getSession?: () => Promise<{ data?: { session?: { access_token?: string } | null } }> } }} baseClient - Supabase browser client.
 * @returns {Promise<string>} Current access token or an empty string.
 */
async function getAdminSessionAccessToken(baseClient) {
  const sessionResult = await baseClient?.auth?.getSession?.();
  return String(sessionResult?.data?.session?.access_token || "").trim();
}

/**
 * Resolves the current admin session through the secured server endpoint.
 *
 * @param {{
 *   baseClient: { auth?: { getSession?: () => Promise<{ data?: { session?: { access_token?: string } | null } }> } },
 *   fetchImpl?: typeof fetch,
 *   route?: string
 * }} [options] - Session lookup options.
 * @returns {Promise<{ error: string | null, user: Record<string, unknown> | null }>} Normalized admin session lookup result.
 */
export async function getAdminSessionUser(options = {}) {
  const accessToken = await getAdminSessionAccessToken(options?.baseClient);
  if (!accessToken) {
    return { error: null, user: null };
  }

  const fetchImpl = options?.fetchImpl || fetch;
  const route = String(options?.route || ADMIN_SESSION_ROUTE);
  let response;

  try {
    response = await fetchImpl(route, {
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      method: "GET",
    });
  } catch (error) {
    return {
      error: String(error?.message || ADMIN_SESSION_UNAVAILABLE_MESSAGE),
      user: null,
    };
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    void error;
  }

  if (response.status === 401 || response.status === 403) {
    return { error: null, user: null };
  }

  if (!response.ok || payload?.success !== true || !payload?.user) {
    return {
      error: String(payload?.error || `${ADMIN_SESSION_UNAVAILABLE_MESSAGE} (${response.status})`),
      user: null,
    };
  }

  return {
    error: null,
    user: payload.user,
    isFullAdmin: payload.isFullAdmin === true,
    permissions: payload.permissions && typeof payload.permissions === "object" ? payload.permissions : {},
    sections: Array.isArray(payload.sections) ? payload.sections : [],
  };
}
