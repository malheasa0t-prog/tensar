import { normalizeSiteSettings } from '@/lib/contactChannels';
import { buildCheckoutRequestPayload } from '@/lib/checkoutRequestPayload';
import { loadSupabaseClient } from '@/lib/loadSupabaseClient';
import { loadSiteSettingsClient } from '@/lib/siteSettingsClient';

const DEFAULT_SITE_SETTINGS = normalizeSiteSettings();

/**
 * Returns the fallback checkout option sets used before dynamic settings load.
 *
 * @returns {{ paymentMethods: Array<{ value: string, label: string }>, deliveryMethods: Array<{ value: string, label: string, fee?: number }>, walletTransferNumber: string }}
 */
export function getDefaultCheckoutOptions() {
  return {
    paymentMethods: DEFAULT_SITE_SETTINGS.paymentMethods,
    deliveryMethods: DEFAULT_SITE_SETTINGS.deliveryMethods,
    walletTransferNumber: DEFAULT_SITE_SETTINGS.walletTransferNumber || '',
  };
}

/**
 * Loads payment and delivery options from site settings with a safe fallback.
 *
 * @returns {Promise<{ paymentMethods: Array<{ value: string, label: string }>, deliveryMethods: Array<{ value: string, label: string, fee?: number }>, walletTransferNumber: string }>}
 */
export async function fetchCheckoutOptions() {
  try {
    const siteSettings = await loadSiteSettingsClient();

    return {
      paymentMethods: siteSettings.paymentMethods,
      deliveryMethods: siteSettings.deliveryMethods,
      walletTransferNumber: siteSettings.walletTransferNumber || '',
    };
  } catch (error) {
    console.error("[CKS-301] Failed to load checkout options:", error);
    return getDefaultCheckoutOptions();
  }
}

/**
 * Submits the checkout request to the API, forwarding the auth token when available.
 *
 * @param {{ items: Array<{ id: string, qty: number }>, form: Record<string, string> }} params
 * @returns {Promise<Record<string, unknown>>}
 */
export async function submitCheckoutOrder({ items, form }) {
  const supabase = await loadSupabaseClient();
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;

  if (!token) {
    throw new Error('[CKP-201] يجب تسجيل الدخول أولاً لإتمام الطلب.');
  }

  const response = await fetch('/api/checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(buildCheckoutRequestPayload({ items, form })),
  });

  const json = await response.json();
  if (!response.ok || !json?.success) {
    throw new Error(json?.error || '[CKP-304] تعذر إتمام الطلب حالياً');
  }

  return json?.data || {};
}
