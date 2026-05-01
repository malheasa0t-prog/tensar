import { supabase } from "../lib/supabaseClient.js";
import { isMissingAuthSessionError } from "../lib/supabaseAuthError.js";

const REPAIR_BOOKING_SAVE_ERROR = "[RBK-301] تعذر إرسال طلب الصيانة حالياً. حاول مرة أخرى.";
const REPAIR_BOOKING_PREFILL_ERROR = "[RBK-302] تعذر تحميل بيانات الحساب لحجز الصيانة.";
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
 * Detects whether the database rejected the optional user reference column.
 *
 * @param {{ message?: string } | null} error
 * @returns {boolean}
 */
function shouldRetryWithoutUserId(error) {
  return /user_id/i.test(error?.message || "");
}

/**
 * Loads the authenticated account snapshot used to prefill the repair form.
 *
 * @param {typeof supabase} [client]
 * @returns {Promise<{ userId: string, name: string, phone: string, isAccountPrefilled: boolean }>}
 */
export async function getRepairBookingAccountSnapshot(client = supabase) {
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();

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

  const profileResponse = await client
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
 * Persists a repair booking and gracefully retries when the schema does not accept `user_id`.
 *
 * @param {Record<string, unknown>} payload
 * @param {string} [userId]
 * @returns {Promise<{ error: { message?: string } | null }>}
 */
export async function createRepairBooking(payload, userId = "") {
  if (userId) {
    const response = await supabase.from("repair_bookings").insert([{ ...payload, user_id: userId }]);

    if (response.error && shouldRetryWithoutUserId(response.error)) {
      const retryResponse = await supabase.from("repair_bookings").insert([payload]);
      return retryResponse.error ? createRepairBookingErrorResult(retryResponse.error) : retryResponse;
    }

    return response.error ? createRepairBookingErrorResult(response.error) : response;
  }

  const response = await supabase.from("repair_bookings").insert([payload]);
  return response.error ? createRepairBookingErrorResult(response.error) : response;
}
