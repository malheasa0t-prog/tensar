// ===== Provider API Module =====
// وحدة الاتصال بمزود الخدمات الخارجي
// يمكن تخصيصها لأي مزود (smmstone, smmworld, etc.)

const PROVIDER_CONFIG = {
  baseUrl: process.env.PROVIDER_API_BASE_URL || '',
  apiKey: process.env.PROVIDER_API_KEY || '',
  timeoutMs: Number(process.env.PROVIDER_API_TIMEOUT_MS || 10000),
};

function ensureProviderConfig() {
  if (!PROVIDER_CONFIG.baseUrl || !PROVIDER_CONFIG.apiKey) {
    return {
      success: false,
      error: 'Provider API is not configured. Set PROVIDER_API_BASE_URL and PROVIDER_API_KEY.',
    };
  }

  return null;
}

async function postProviderAction(payload) {
  const configError = ensureProviderConfig();
  if (configError) {
    return configError;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_CONFIG.timeoutMs);

  try {
    const response = await fetch(PROVIDER_CONFIG.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: PROVIDER_CONFIG.apiKey,
        ...payload,
      }),
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
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message || 'Provider request failed' };
  } finally {
    clearTimeout(timeout);
  }
}

// إنشاء طلب عند المزود
export async function createProviderOrder(serviceId, link, quantity) {
  const result = await postProviderAction({
    action: 'add',
    service: serviceId,
    link,
    quantity,
  });

  if (!result.success) {
    return result;
  }

  if (result.data?.order) {
    return { success: true, orderId: String(result.data.order) };
  }

  return { success: false, error: result.data?.error || 'Unknown provider error' };
}

// التحقق من حالة طلب عند المزود
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

// التحقق من رصيد المزود
export async function getProviderBalance() {
  const result = await postProviderAction({ action: 'balance' });

  if (!result.success) {
    return result;
  }

  return { success: true, balance: result.data.balance, currency: result.data.currency };
}

// جلب قائمة خدمات المزود
export async function getProviderServices() {
  const result = await postProviderAction({ action: 'services' });

  if (!result.success) {
    return result;
  }

  return { success: true, services: result.data };
}
