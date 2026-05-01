/**
 * Dashboard shell data-loading helpers.
 */

import { supabase } from "../lib/supabaseClient.js";
import { isMissingAuthSessionError } from "../lib/supabaseAuthError.js";

/**
 * Fetches the authenticated dashboard user from Supabase auth.
 *
 * @param {{ client?: typeof supabase }} [input]
 * @returns {Promise<Record<string, unknown> | null>}
 */
export async function fetchDashboardSessionUser({ client = supabase } = {}) {
  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error) {
    if (isMissingAuthSessionError(error)) {
      return null;
    }

    throw new Error("[DSH-306] تعذر التحقق من جلسة المستخدم الحالية.");
  }

  return user || null;
}

/**
 * Fetches the dashboard profile snapshot for the current user.
 *
 * @param {{ client?: typeof supabase, userId: string }} input
 * @returns {Promise<Record<string, unknown> | null>}
 */
export async function fetchDashboardProfile({ client = supabase, userId }) {
  const response = await client.from("user_profiles").select("*").eq("user_id", userId).single();
  return response.data || null;
}

/**
 * Fetches the unread notifications count for the active user.
 *
 * @param {{ client?: typeof supabase, userId: string }} input
 * @returns {Promise<number>}
 */
export async function fetchUnreadNotificationsCount({ client = supabase, userId }) {
  const { count } = await client
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false);

  return Number(count || 0);
}

/**
 * Fetches the wallet snapshot for the active dashboard user.
 *
 * @param {{ client?: typeof supabase, userId: string }} input
 * @returns {Promise<Record<string, unknown> | null>}
 */
export async function fetchDashboardWalletSnapshot({ client = supabase, userId }) {
  const response = await client.from("wallets").select("*").eq("user_id", userId).single();
  return response.data || null;
}

/**
 * Subscribes to dashboard auth changes and returns a safe unsubscribe function.
 *
 * @param {{
 *   client?: typeof supabase,
 *   onAuthChange: (input: { event: string, session: { user?: Record<string, unknown> | null } | null }) => void,
 * }} input
 * @returns {() => void}
 */
export function subscribeToDashboardAuthChanges({ client = supabase, onAuthChange }) {
  const subscription = client.auth.onAuthStateChange((event, session) => {
    onAuthChange({ event, session });
  });

  return () => {
    subscription?.data?.subscription?.unsubscribe?.();
  };
}
