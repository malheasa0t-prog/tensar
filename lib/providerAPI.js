// ===== Serva-S Provider API Module =====
// وحدة الاتصال بمزود Serva-S للخدمات الرقمية
// Endpoint: https://serva-s.com/api/v1
// Auth: key field + x-api-key header
// Format: application/x-www-form-urlencoded (POST)

/**
 * Serva-S provider configuration loaded from environment variables.
 *
 * @type {{ baseUrl: string, apiKey: string, timeoutMs: number }}
 */
const PROVIDER_CONFIG = {
  baseUrl: process.env.PROVIDER_API_BASE_URL || '',
  apiKey: process.env.PROVIDER_API_KEY || '',
  timeoutMs: Number(process.env.PROVIDER_API_TIMEOUT_MS || 15000),
};

/**
 * Serva-S error codes mapped to user-friendly Arabic messages.
 *
 * @type {Record<string, string>}
 */
const SERVA_ERROR_MESSAGES = {
  INVALID_API_KEY: 'مفتاح API غير صالح.',
  API_KEY_REVOKED: 'مفتاح API تم إلغاؤه.',
  API_ACCESS_NOT_ALLOWED: 'حسابك غير مفعل لاستخدام API.',
  ACCOUNT_BANNED: 'الحساب محظور من استخدام API.',
  SERVICE_NOT_FOUND: 'الخدمة غير موجودة عند المزود.',
  INSUFFICIENT_BALANCE: 'رصيد المزود غير كافٍ.',
  DUPLICATE_ORDER: 'طلب مكرر — تم حظره من قبل المزود.',
  ACTIVE_ORDER_EXISTS: 'يوجد طلب نشط لنفس الرابط.',
};

/**
 * Validates that required provider configuration is present.
 *
 * @returns {{ success: false, error: string } | null} Error object or null if valid
 */
function ensureProviderConfig() {
  if (!PROVIDER_CONFIG.baseUrl || !PROVIDER_CONFIG.apiKey) {
    return {
      success: false,
      error: 'Provider API is not configured. Set PROVIDER_API_BASE_URL and PROVIDER_API_KEY.',
    };
  }

  return null;
}

/**
 * Translates a Serva-S error string into a localized message.
 *
 * @param {string} errorText - Raw error text from Serva-S response
 * @returns {string} Localized error message
 */
function translateServaError(errorText) {
  const normalized = String(errorText || '').trim();
  const errorCode = normalized.toUpperCase().replace(/[\s-]+/g, '_');

  return SERVA_ERROR_MESSAGES[errorCode] || normalized || 'خطأ غير معروف من المزود';
}

/**
 * Sends a POST request to Serva-S API with form-urlencoded body.
 *
 * @param {Record<string, string | number>} payload - Action parameters
 * @returns {Promise<{ success: true, data: unknown } | { success: false, error: string }>}
 */
async function postProviderAction(payload) {
  const configError = ensureProviderConfig();
  if (configError) {
    return configError;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_CONFIG.timeoutMs);

  try {
    const params = new URLSearchParams();
    params.append('key', PROVIDER_CONFIG.apiKey);

    for (const [key, value] of Object.entries(payload)) {
      if (value !== null && value !== undefined) {
        params.append(key, String(value));
      }
    }

    const response = await fetch(PROVIDER_CONFIG.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'x-api-key': PROVIDER_CONFIG.apiKey,
      },
      body: params.toString(),
      signal: controller.signal,
      cache: 'no-store',
    });

    if (!response.ok) {
      return {
        success: false,
        error: `Provider API responded with status ${response.status}`,
      };
    }

    const data = await response.json();

    if (data?.error) {
      return {
        success: false,
        error: translateServaError(data.error),
        errorCode: data.error_code || null,
      };
    }

    return { success: true, data };
  } catch (err) {
    if (err.name === 'AbortError') {
      return { success: false, error: 'انتهت مهلة الاتصال بالمزود (timeout)' };
    }
    return { success: false, error: err.message || 'Provider request failed' };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Creates an order at Serva-S provider.
 *
 * @param {string} serviceId - Serva-S service ID
 * @param {string} link - Target URL/link for the service
 * @param {number} quantity - Order quantity
 * @param {Record<string, string>} [fields] - Optional manual fields (e.g. player_id)
 * @returns {Promise<{ success: true, orderId: string } | { success: false, error: string }>}
 */
export async function createProviderOrder(serviceId, link, quantity, fields) {
  const payload = {
    action: 'add',
    service: serviceId,
    quantity,
  };

  if (link) {
    payload.link = link;
  }

  if (fields && typeof fields === 'object' && Object.keys(fields).length > 0) {
    payload.fields = JSON.stringify(fields);
  }

  const result = await postProviderAction(payload);

  if (!result.success) {
    return result;
  }

  if (result.data?.order) {
    return { success: true, orderId: String(result.data.order) };
  }

  return { success: false, error: result.data?.error || 'Unknown provider error' };
}

/**
 * Checks the status of an order at Serva-S provider.
 *
 * @param {string} orderId - Serva-S order ID (e.g. "ORD-100023")
 * @returns {Promise<{ success: true, status: string, startCount: unknown, remains: unknown, charge: string } | { success: false, error: string }>}
 */
export async function checkProviderOrderStatus(orderId) {
  const result = await postProviderAction({
    action: 'status',
    order: orderId,
  });

  if (!result.success) {
    return result;
  }

  return {
    success: true,
    status: result.data.status,
    startCount: result.data.start_count,
    remains: result.data.remains,
    charge: result.data.charge,
  };
}

/**
 * Retrieves Serva-S account balance.
 *
 * @returns {Promise<{ success: true, balance: string, currency: string } | { success: false, error: string }>}
 */
export async function getProviderBalance() {
  const result = await postProviderAction({ action: 'balance' });

  if (!result.success) {
    return result;
  }

  return { success: true, balance: result.data.balance, currency: result.data.currency };
}

/**
 * Fetches the full service catalog from Serva-S.
 *
 * @returns {Promise<{ success: true, services: Array<Record<string, unknown>> } | { success: false, error: string }>}
 */
export async function getProviderServices() {
  const result = await postProviderAction({ action: 'services' });

  if (!result.success) {
    return result;
  }

  return { success: true, services: result.data };
}
