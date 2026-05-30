import { createIdempotencyKey } from "../lib/idempotencyKey.js";
import { loadSupabaseClient } from "../lib/loadSupabaseClient.js";
import { isMissingAuthSessionError } from "../lib/supabaseAuthError.js";

const REPAIR_BOOKING_SAVE_ERROR = "[RBK-301] تعذر إرسال طلب الصيانة حالياً. حاول مرة أخرى.";
const REPAIR_BOOKING_PREFILL_ERROR = "[RBK-302] تعذر تحميل بيانات الحساب لحجز الصيانة.";
const REPAIR_BOOKING_ENDPOINT = "/api/repair-booking";
const ERROR_CODE_PATTERN = /\[[A-Z]{2,4}-\d{3}\]/;

/**
 * Builds a normalized repair booking error result.
 *
 * @param {unknown} error
 * @returns {{ error: { message: string } }}
 */
function createRepairBookingErrorResult(error) {
  const message = String(error?.message || '').trim();
  const normalizedMessage = ERROR_CODE_PATTERN.test(message)
    ? message
    : REPAIR_BOOKING_SAVE_ERROR;

  return {
    error: {
      message: normalizedMessage,
    },
  };
}

/**
 * Generates a short client-side identifier for repair bookings.
 *
 * @returns {string}
 */
export function createRepairBookingId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `bk-${crypto.randomUUID().replace(/-/g, "").slice(0, 9)}`;
  }

  return `bk-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Loads the authenticated account snapshot used to prefill the repair form.
 *
 * @param {Record<string, unknown>} [client]
 * @returns {Promise<{ userId: string, name: string, phone: string, isAccountPrefilled: boolean }>}
 */
export async function getRepairBookingAccountSnapshot(client) {
  const resolvedClient = client || await loadSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await resolvedClient.auth.getUser();

  if (userError && !isMissingAuthSessionError(userError)) {
    console.error(`${REPAIR_BOOKING_PREFILL_ERROR} Failed to load authenticated user:`, userError);
  }

  if (!user) {
    return {
      userId: "",
      name: "",
      phone: "",
      isAccountPrefilled: false,
    };
  }

  const profileResponse = await resolvedClient
    .from("user_profiles")
    .select("full_name, phone")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileResponse.error) {
    console.error(`${REPAIR_BOOKING_PREFILL_ERROR} Failed to load profile snapshot:`, profileResponse.error);
  }

  return {
    userId: user.id || "",
    name: profileResponse.data?.full_name || "",
    phone: profileResponse.data?.phone || "",
    isAccountPrefilled: true,
  };
}

/**
 * Persists a repair booking via the server-side gate.
 *
 * The previous implementation inserted directly into `repair_bookings` from
 * the browser, which meant the model-layer validation could be bypassed by
 * any client that crafted its own payload. The new flow POSTs to
 * `/api/repair-booking`, which re-runs validation, sanitizes input, and
 * uses the service-role client so we don't have to loosen RLS.
 *
 * @param {{
 *   client?: { auth: { getSession: () => Promise<{ data?: { session?: { access_token?: string } | null } }> | Promise<null> } },
 *   form: {
 *     address?: string,
 *     description?: string,
 *     mode?: string,
 *     name?: string,
 *     phone?: string,
 *     preferredDate?: string,
 *     preferred_date?: string,
 *     serviceId?: string,
 *     service_id?: string,
 *   },
 *   idempotencyKey?: string,
 * }} input - Form payload and optional request dependencies.
 * @returns {Promise<{ data?: Record<string, unknown> | null, error?: { message: string } | null }>} Result envelope.
 */
export async function createRepairBooking({ client, form, idempotencyKey = "" }) {
  try {
    const supabase = client || await loadSupabaseClient();
    const session = await supabase.auth.getSession().catch(() => null);
    const token = session?.data?.session?.access_token || "";
    const requestIdempotencyKey = String(idempotencyKey || "").trim() || createIdempotencyKey();

    const headers = {
      "Content-Type": "application/json",
      "Idempotency-Key": requestIdempotencyKey,
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(REPAIR_BOOKING_ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: form?.name || "",
        phone: form?.phone || "",
        serviceId: form?.serviceId || form?.service_id || "",
        description: form?.description || "",
        mode: form?.mode || "",
        address: form?.address || "",
        preferredDate: form?.preferredDate || form?.preferred_date || "",
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.success) {
      return createRepairBookingErrorResult({ message: payload?.error || REPAIR_BOOKING_SAVE_ERROR });
    }

    return { data: payload?.data || null, error: null };
  } catch (error) {
    return createRepairBookingErrorResult(error);
  }
}
