import { loadSupabaseClient } from "../lib/loadSupabaseClient.js";
import { normalizeStockAlertProductId } from "../lib/stockAlertModel.js";

const INVALID_SESSION_MESSAGE = "سجل الدخول أولاً لتفعيل تنبيه التوفر.";
const STOCK_ALERT_ERROR_MESSAGE = "تعذر تفعيل تنبيه التوفر حالياً.";

/**
 * Resolves the browser client used by stock-alert requests.
 *
 * @param {Record<string, unknown> | null | undefined} client
 * @returns {Promise<Record<string, unknown>>}
 */
async function resolveStockAlertClient(client) {
  return client || loadSupabaseClient();
}

/**
 * Requests a back-in-stock alert for the current authenticated user.
 *
 * @param {{ client?: Record<string, unknown>, productId: unknown }} input
 * @returns {Promise<{ alreadySubscribed: boolean, productName: string, subscribed: boolean }>}
 * @throws {Error}
 */
export async function requestStockAlert({ client, productId }) {
  const normalizedProductId = normalizeStockAlertProductId(productId);
  if (!normalizedProductId) {
    throw new Error(STOCK_ALERT_ERROR_MESSAGE);
  }

  const resolvedClient = await resolveStockAlertClient(client);
  const sessionResponse = await resolvedClient.auth.getSession();
  const accessToken = String(sessionResponse?.data?.session?.access_token || "").trim();
  if (!accessToken) {
    throw new Error(INVALID_SESSION_MESSAGE);
  }

  const response = await fetch("/api/stock-alerts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ productId: normalizedProductId }),
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok || payload?.success === false) {
    throw new Error(payload?.error || STOCK_ALERT_ERROR_MESSAGE);
  }

  return {
    alreadySubscribed: payload?.alreadySubscribed === true,
    productName: String(payload?.productName || "").trim(),
    subscribed: true,
  };
}
