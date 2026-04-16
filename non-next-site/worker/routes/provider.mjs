import { requireAdminRequest } from "../lib/auth.mjs";
import { createProviderApi } from "../lib/provider.mjs";
import { errorResponse, jsonResponse } from "../lib/http.mjs";

/**
 * Returns the provider service catalog for authenticated admins.
 *
 * @param {Request} request
 * @param {Record<string, unknown>} env
 * @returns {Promise<Response>}
 */
export async function handleProviderServicesRequest(request, env) {
  const { errorResponse: authError } = await requireAdminRequest(request, env);

  if (authError) {
    return authError;
  }

  const result = await createProviderApi(env).getServices();
  return result.success
    ? jsonResponse({ success: true, count: Array.isArray(result.services) ? result.services.length : 0, services: result.services || [] })
    : errorResponse(result.error || "حدث خطأ أثناء جلب الخدمات", 502);
}

/**
 * Returns the provider wallet balance for authenticated admins.
 *
 * @param {Request} request
 * @param {Record<string, unknown>} env
 * @returns {Promise<Response>}
 */
export async function handleProviderBalanceRequest(request, env) {
  const { errorResponse: authError } = await requireAdminRequest(request, env);

  if (authError) {
    return authError;
  }

  const result = await createProviderApi(env).getBalance();
  return result.success
    ? jsonResponse({ success: true, balance: result.balance, currency: result.currency })
    : errorResponse(result.error || "حدث خطأ أثناء جلب الرصيد", 502);
}
