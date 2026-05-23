/**
 * Serva-S provider helpers for Cloudflare Pages Functions.
 */

const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_SERVA_BASE_URL = "https://serva-s.com/api/v1";
const PROVIDER_MISSING_CONFIG_STATUS = 500;
const PROVIDER_INVALID_PAYLOAD_STATUS = 400;
const PROVIDER_UPSTREAM_FAILURE_STATUS = 502;

const SERVA_ERROR_MESSAGES = Object.freeze({
  INVALID_API_KEY: "مفتاح API غير صالح.",
  API_KEY_REVOKED: "مفتاح API تم إلغاؤه.",
  API_KEY_INACTIVE: "مفتاح API غير نشط.",
  API_ACCESS_NOT_ALLOWED: "الحساب غير مفعّل لاستخدام API.",
  ACCOUNT_BANNED: "الحساب محظور من استخدام API.",
  SERVICE_NOT_FOUND: "الخدمة غير موجودة عند المزود.",
  SERVICE_NOT_FOUND_OR_INACTIVE: "الخدمة غير موجودة أو غير مفعّلة عند المزود.",
  INSUFFICIENT_BALANCE: "رصيد المزود غير كافٍ.",
  DUPLICATE_ORDER: "الطلب مكرر وتم رفضه من المزود.",
  DUPLICATE_ORDER_COOLDOWN: "تم رفض الطلب لأنه مكرر خلال فترة قصيرة.",
  ACTIVE_ORDER_EXISTS: "يوجد طلب نشط لنفس الرابط.",
  ACTIVE_TARGET_ORDER_EXISTS: "يوجد طلب نشط لنفس الهدف عند المزود.",
});

/**
 * Reads the provider configuration from environment bindings.
 *
 * @param {Record<string, string | undefined> | undefined} env - Environment bindings.
 * @returns {{ apiKey: string, baseUrl: string, timeoutMs: number }} Provider config.
 */
export function readProviderConfig(env) {
  const configuredBaseUrl = String(env?.PROVIDER_API_BASE_URL ?? "").trim();

  return {
    apiKey: String(env?.PROVIDER_API_KEY ?? env?.SERVAS_API_KEY ?? "").trim(),
    baseUrl: configuredBaseUrl || DEFAULT_SERVA_BASE_URL,
    timeoutMs: Number(env?.PROVIDER_API_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS,
  };
}

/**
 * Maps raw provider errors into localized operator-facing messages.
 *
 * @param {string} errorText - Raw upstream error text.
 * @returns {string} Localized error message.
 */
export function translateProviderError(errorText) {
  const normalized = String(errorText ?? "").trim();
  const errorCode = normalized.toUpperCase().replace(/[\s-]+/g, "_");

  return SERVA_ERROR_MESSAGES[errorCode] || normalized || "خطأ غير معروف من المزود";
}

/**
 * Parses an upstream JSON response without throwing opaque syntax errors.
 *
 * @param {Response} response - Upstream fetch response.
 * @returns {Promise<{ data: unknown, rawBody: string }>} Parsed data and raw text.
 * @throws {Error} When the upstream body is not valid JSON.
 */
export async function parseProviderJson(response) {
  const rawBody = await response.text();

  try {
    return { data: JSON.parse(rawBody), rawBody };
  } catch (error) {
    throw new Error(`استجابة غير صالحة من المزود: ${rawBody.slice(0, 120)}`);
  }
}

/**
 * Executes a Serva-S action using form-urlencoded POST.
 *
 * @param {Record<string, string | undefined>} env - Environment bindings.
 * @param {Record<string, string | number>} payload - Provider action payload.
 * @param {{ fetchImpl?: typeof fetch }} [options={}] - Optional dependencies for tests.
 * @returns {Promise<{ success: boolean, data?: unknown, error?: string, status?: number }>} Provider result.
 */
export async function postProviderAction(env, payload, options = {}) {
  const config = readProviderConfig(env);
  if (!config.baseUrl || !config.apiKey) {
    return {
      success: false,
      error: "Provider API is not configured. Set PROVIDER_API_KEY.",
      status: PROVIDER_MISSING_CONFIG_STATUS,
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);
  const fetchImpl = options.fetchImpl ?? fetch;
  const body = new URLSearchParams({ key: config.apiKey });

  Object.entries(payload).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      body.set(key, String(value));
    }
  });

  try {
    const response = await fetchImpl(config.baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "x-api-key": config.apiKey,
      },
      body: body.toString(),
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Provider API responded with status ${response.status}`,
        status: PROVIDER_UPSTREAM_FAILURE_STATUS,
      };
    }

    const { data } = await parseProviderJson(response);
    if (data && typeof data === "object" && "error" in data && data.error) {
      return {
        success: false,
        error: translateProviderError(String(data.error)),
        status: PROVIDER_UPSTREAM_FAILURE_STATUS,
      };
    }

    return { success: true, data };
  } catch (error) {
    const isAbort = error instanceof Error && error.name === "AbortError";
    return {
      success: false,
      error: isAbort ? "انتهت مهلة الاتصال بالمزوّد." : String(error?.message ?? "Provider request failed"),
      status: PROVIDER_UPSTREAM_FAILURE_STATUS,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Retrieves the Serva-S account balance.
 *
 * @param {Record<string, string | undefined>} env - Environment bindings.
 * @param {{ fetchImpl?: typeof fetch }} [options={}] - Optional dependencies for tests.
 * @returns {Promise<{ success: boolean, balance?: string, currency?: string, error?: string, status?: number }>} Balance result.
 */
export async function getProviderBalance(env, options = {}) {
  const result = await postProviderAction(env, { action: "balance" }, options);
  if (!result.success) {
    return result;
  }

  const data = /** @type {{ balance?: string, currency?: string }} */ (result.data ?? {});
  return { success: true, balance: data.balance, currency: data.currency };
}

/**
 * Retrieves the full Serva-S services catalog.
 *
 * @param {Record<string, string | undefined>} env - Environment bindings.
 * @param {{ fetchImpl?: typeof fetch }} [options={}] - Optional dependencies for tests.
 * @returns {Promise<{ success: boolean, services?: Array<Record<string, unknown>>, error?: string, status?: number }>} Services result.
 */
export async function getProviderServices(env, options = {}) {
  const result = await postProviderAction(env, { action: "services" }, options);
  if (!result.success) {
    return result;
  }

  return { success: true, services: Array.isArray(result.data) ? result.data : [] };
}

/**
 * Creates a Serva-S order using the shared provider transport.
 *
 * @param {Record<string, string | undefined>} env - Environment bindings.
 * @param {{ serviceId: string | number, quantity: number, link?: string | null, fields?: Record<string, unknown> | null }} payload - Provider order payload.
 * @param {{ fetchImpl?: typeof fetch }} [options={}] - Optional dependencies for tests.
 * @returns {Promise<{ success: boolean, orderId?: string, error?: string, status?: number }>} Order result.
 */
export async function createProviderOrder(env, payload, options = {}) {
  const serviceId = String(payload?.serviceId ?? "").trim();
  const quantity = Number(payload?.quantity);
  const link = typeof payload?.link === "string" ? payload.link.trim() : "";
  const fields = payload?.fields;

  if (!serviceId || !Number.isFinite(quantity) || quantity <= 0) {
    return {
      success: false,
      error: "Provider order payload is invalid.",
      status: PROVIDER_INVALID_PAYLOAD_STATUS,
    };
  }

  const providerPayload = {
    action: "add",
    service: serviceId,
    quantity,
  };

  if (link) {
    providerPayload.link = link;
  }

  if (fields && typeof fields === "object" && Object.keys(fields).length > 0) {
    providerPayload.fields = JSON.stringify(fields);
  }

  const result = await postProviderAction(env, providerPayload, options);
  if (!result.success) {
    return result;
  }

  const data = /** @type {{ order?: string | number }} */ (result.data ?? {});
  if (!data.order) {
    return {
      success: false,
      error: "Provider order response did not include an order id.",
      status: PROVIDER_UPSTREAM_FAILURE_STATUS,
    };
  }

  return { success: true, orderId: String(data.order) };
}

/**
 * Checks the status of a Serva-S order.
 *
 * @param {Record<string, string | undefined>} env - Environment bindings.
 * @param {string} orderId - External Serva-S order ID.
 * @param {{ fetchImpl?: typeof fetch }} [options={}] - Optional dependencies for tests.
 * @returns {Promise<{ success: boolean, status?: string, startCount?: number | null, remains?: number | null, charge?: string, error?: string }>} Status result.
 */
export async function checkProviderOrderStatus(env, orderId, options = {}) {
  if (!orderId) {
    return { success: false, error: "Order ID is required.", status: PROVIDER_INVALID_PAYLOAD_STATUS };
  }

  const result = await postProviderAction(env, { action: "status", order: orderId }, options);
  if (!result.success) {
    return result;
  }

  const data = /** @type {{ status?: string, start_count?: unknown, remains?: unknown, charge?: string }} */ (result.data ?? {});
  return {
    success: true,
    status: String(data.status || "unknown").toLowerCase(),
    startCount: Number.isFinite(Number(data.start_count)) ? Number(data.start_count) : null,
    remains: Number.isFinite(Number(data.remains)) ? Number(data.remains) : null,
    charge: data.charge || "0",
  };
}
