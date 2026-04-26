/**
 * Shared request helpers for the secured admin DB proxy.
 */

const ADMIN_DB_ROUTE = "/api/admin/db";
const JSON_HEADERS = Object.freeze({
  "Content-Type": "application/json",
  accept: "application/json",
});

/**
 * Builds one normalized Supabase-like error payload.
 *
 * @param {unknown} message
 * @param {number} [status=400]
 * @returns {{ message: string, status: number }}
 */
function createDbError(message, status = 400) {
  return {
    message: String(message || "[ADB-500] تعذر تنفيذ عملية الإدارة الحالية."),
    status: Number(status) || 400,
  };
}

/**
 * Reads the current authenticated admin access token from the base client.
 *
 * @param {{ auth?: { getSession?: () => Promise<{ data?: { session?: { access_token?: string } | null } }> } }} baseClient
 * @returns {Promise<string>}
 */
async function getAdminAccessToken(baseClient) {
  const sessionResult = await baseClient?.auth?.getSession?.();
  return String(sessionResult?.data?.session?.access_token || "").trim();
}

/**
 * Posts one normalized admin DB operation to the secured server route.
 *
 * @param {{
 *   baseClient: { auth?: { getSession?: () => Promise<{ data?: { session?: { access_token?: string } | null } }> } },
 *   fetchImpl?: typeof fetch,
 *   operation: Record<string, unknown>,
 *   route?: string
 * }} options
 * @returns {Promise<{ count: number | null, data: unknown, error: { message: string, status: number } | null }>}
 */
export async function executeAdminDbOperation(options) {
  const accessToken = await getAdminAccessToken(options?.baseClient);
  if (!accessToken) {
    return {
      count: null,
      data: null,
      error: createDbError("[ADB-201] يجب تسجيل دخول الأدمن قبل تنفيذ العملية الآمنة.", 401),
    };
  }

  const fetchImpl = options?.fetchImpl || fetch;
  const route = String(options?.route || ADMIN_DB_ROUTE);
  let response;

  try {
    response = await fetchImpl(route, {
      method: "POST",
      headers: {
        ...JSON_HEADERS,
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(options?.operation || {}),
    });
  } catch (error) {
    return {
      count: null,
      data: null,
      error: createDbError(error?.message || "[ADB-502] تعذر الوصول إلى واجهة الأدمن الآمنة.", 503),
    };
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    void error;
  }

  if (!response.ok || payload?.success !== true) {
    return {
      count: null,
      data: null,
      error: createDbError(
        payload?.error || `[ADB-503] تعذر تنفيذ عملية الأدمن الآمنة (${response.status}).`,
        response.status,
      ),
    };
  }

  return {
    count: Number.isFinite(payload?.count) ? payload.count : null,
    data: payload?.data ?? null,
    error: null,
  };
}
