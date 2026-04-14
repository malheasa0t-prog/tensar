import { supabase } from "@/lib/supabaseClient";

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
 * @returns {Promise<{ userId: string, name: string, phone: string, isAccountPrefilled: boolean }>}
 */
export async function getRepairBookingAccountSnapshot() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      userId: "",
      name: "",
      phone: "",
      isAccountPrefilled: false,
    };
  }

  const profileResponse = await supabase
    .from("user_profiles")
    .select("full_name, phone")
    .eq("user_id", user.id)
    .maybeSingle();

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
      return supabase.from("repair_bookings").insert([payload]);
    }

    return response;
  }

  return supabase.from("repair_bookings").insert([payload]);
}
