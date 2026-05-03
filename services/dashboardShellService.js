/**
 * Dashboard shell data-loading helpers.
 */

import { loadSupabaseClient } from "../lib/loadSupabaseClient.js";
import { isMissingAuthSessionError } from "../lib/supabaseAuthError.js";

/**
 * Resolves the dashboard data client lazily.
 *
 * @param {Record<string, unknown> | null | undefined} client
 * @returns {Promise<Record<string, unknown>>}
 */
async function resolveDashboardClient(client) {
  return client || loadSupabaseClient();
}

/**
 * Fetches the authenticated dashboard user from Supabase auth.
 *
 * @param {{ client?: Record<string, unknown> }} [input]
 * @returns {Promise<Record<string, unknown> | null>}
 */
export async function fetchDashboardSessionUser({ client } = {}) {
  const resolvedClient = await resolveDashboardClient(client);
  const {
    data: { user },
    error,
  } = await resolvedClient.auth.getUser();

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
 * @param {{ client?: Record<string, unknown>, userId: string }} input
 * @returns {Promise<Record<string, unknown> | null>}
 */
export async function fetchDashboardProfile({ client, userId }) {
  const resolvedClient = await resolveDashboardClient(client);
  const response = await resolvedClient.from("user_profiles").select("*").eq("user_id", userId).single();
  return response.data || null;
}

/**
 * Fetches the unread notifications count for the active user.
 *
 * @param {{ client?: Record<string, unknown>, userId: string }} input
 * @returns {Promise<number>}
 */
export async function fetchUnreadNotificationsCount({ client, userId }) {
  const resolvedClient = await resolveDashboardClient(client);
  const { count } = await resolvedClient
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false);

  return Number(count || 0);
}

/**
 * Fetches the wallet snapshot for the active dashboard user.
 *
 * @param {{ client?: Record<string, unknown>, userId: string }} input
 * @returns {Promise<Record<string, unknown> | null>}
 */
export async function fetchDashboardWalletSnapshot({ client, userId }) {
  const resolvedClient = await resolveDashboardClient(client);
  const response = await resolvedClient.from("wallets").select("*").eq("user_id", userId).single();
  return response.data || null;
}

/**
 * Subscribes to dashboard auth changes and returns a safe unsubscribe function.
 *
 * @param {{
 *   client?: Record<string, unknown>,
 *   onAuthChange: (input: { event: string, session: { user?: Record<string, unknown> | null } | null }) => void,
 * }} input
 * @returns {() => void}
 */
export function subscribeToDashboardAuthChanges({ client, onAuthChange }) {
  if (typeof onAuthChange !== "function") {
    return () => {};
  }

  if (client) {
    const subscription = client.auth.onAuthStateChange((event, session) => {
      onAuthChange({ event, session });
    });

    return () => {
      subscription?.data?.subscription?.unsubscribe?.();
    };
  }

  let active = true;
  let unsubscribe = () => {};

  /**
   * Attaches the dashboard auth listener once the client is available.
   *
   * @returns {Promise<void>}
   */
  async function attachSubscription() {
    const resolvedClient = await resolveDashboardClient(client);

    if (!active) {
      return;
    }

    const subscription = resolvedClient.auth.onAuthStateChange((event, session) => {
      onAuthChange({ event, session });
    });

    unsubscribe = () => {
      subscription?.data?.subscription?.unsubscribe?.();
    };
  }

  void attachSubscription();

  return () => {
    active = false;
    unsubscribe();
  };
}
