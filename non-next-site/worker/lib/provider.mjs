const SERVA_ERROR_MESSAGES = {
  ACCOUNT_BANNED: "الحساب محظور من استخدام API.",
  ACTIVE_ORDER_EXISTS: "يوجد طلب نشط لنفس الرابط.",
  API_ACCESS_NOT_ALLOWED: "حسابك غير مفعل لاستخدام API.",
  API_KEY_REVOKED: "مفتاح API تم إلغاؤه.",
  DUPLICATE_ORDER: "طلب مكرر.",
  INSUFFICIENT_BALANCE: "رصيد المزود غير كافٍ.",
  INVALID_API_KEY: "مفتاح API غير صالح.",
  SERVICE_NOT_FOUND: "الخدمة غير موجودة عند المزود."
};

/**
 * Converts provider errors into localized messages.
 *
 * @param {string} errorText
 * @returns {string}
 */
export function translateProviderError(errorText) {
  const normalized = String(errorText || "").trim();
  const errorCode = normalized.toUpperCase().replace(/[\s-]+/g, "_");
  return SERVA_ERROR_MESSAGES[errorCode] || normalized || "خطأ غير معروف من المزود";
}

/**
 * Creates the provider API helper bound to one worker environment.
 *
 * @param {Record<string, unknown>} env
 * @returns {{
 *   checkOrderStatus: (orderId: string) => Promise<{ success: boolean, error?: string, status?: string, startCount?: unknown, remains?: unknown, charge?: unknown }>,
 *   createOrder: (serviceId: string, link: string | null, quantity: number, fields?: Record<string, unknown>) => Promise<{ success: boolean, error?: string, orderId?: string }>,
 *   getBalance: () => Promise<{ success: boolean, error?: string, balance?: string, currency?: string }>,
 *   getServices: () => Promise<{ success: boolean, error?: string, services?: Array<Record<string, unknown>> }>
 * }}
 */
export function createProviderApi(env) {
  const baseUrl = String(env?.PROVIDER_API_BASE_URL || "").trim();
  const apiKey = String(env?.PROVIDER_API_KEY || "").trim();
  const timeoutMs = Number(env?.PROVIDER_API_TIMEOUT_MS || 15000);

  /**
   * Sends one POST action to the provider.
   *
   * @param {Record<string, string | number>} payload
   * @returns {Promise<{ success: boolean, error?: string, data?: unknown }>}
   */
  async function postAction(payload) {
    if (!baseUrl || !apiKey) {
      return {
        success: false,
        error: "Provider API is not configured. Set PROVIDER_API_BASE_URL and PROVIDER_API_KEY."
      };
    }

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const body = new URLSearchParams({ key: apiKey });
      Object.entries(payload).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          body.append(key, String(value));
        }
      });

      const response = await fetch(baseUrl, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "x-api-key": apiKey
        },
        body: body.toString(),
        cache: "no-store",
        signal: controller.signal
      });

      if (!response.ok) {
        return { success: false, error: `Provider API responded with status ${response.status}` };
      }

      const data = await response.json();
      if (data?.error) {
        return { success: false, error: translateProviderError(data.error) };
      }

      return { success: true, data };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return { success: false, error: "انتهت مهلة الاتصال بالمزود." };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : "Provider request failed"
      };
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  return {
    async checkOrderStatus(orderId) {
      const result = await postAction({ action: "status", order: orderId });
      return result.success
        ? {
            success: true,
            status: result.data.status,
            startCount: result.data.start_count,
            remains: result.data.remains,
            charge: result.data.charge
          }
        : result;
    },
    async createOrder(serviceId, link, quantity, fields = {}) {
      const payload = { action: "add", service: serviceId, quantity };

      if (link) {
        payload.link = link;
      }
      if (fields && typeof fields === "object" && Object.keys(fields).length > 0) {
        payload.fields = JSON.stringify(fields);
      }

      const result = await postAction(payload);
      if (!result.success) {
        return result;
      }

      if (result.data?.order) {
        return { success: true, orderId: String(result.data.order) };
      }

      return { success: false, error: result.data?.error || "Unknown provider error" };
    },
    async getBalance() {
      const result = await postAction({ action: "balance" });
      return result.success
        ? { success: true, balance: result.data.balance, currency: result.data.currency }
        : result;
    },
    async getServices() {
      const result = await postAction({ action: "services" });
      return result.success ? { success: true, services: result.data } : result;
    }
  };
}
