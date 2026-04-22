import { filterVisibleNotifications } from "../lib/dashboardNotificationsModel.js";
import { loadSupabaseClient } from "../lib/loadSupabaseClient.js";

const NOTIFICATIONS_LOAD_ERROR = "[NTF-401] تعذر تحميل الإشعارات حالياً";
const NOTIFICATION_MARK_ERROR = "[NTF-402] تعذر تحديث الإشعار";
const NOTIFICATIONS_MARK_ALL_ERROR = "[NTF-403] تعذر تعليم جميع الإشعارات كمقروءة";

/**
 * Resolves the Supabase client used by notification helpers.
 *
 * @param {Record<string, unknown> | null | undefined} client
 * @returns {Promise<Record<string, unknown>>}
 */
async function resolveNotificationsClient(client) {
  return client || loadSupabaseClient();
}

/**
 * Returns the current authenticated user id for the notifications dashboard.
 *
 * @returns {Promise<string>}
 */
export async function getNotificationsUserId() {
  const supabase = await resolveNotificationsClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user?.id || "";
}

/**
 * Loads the latest notifications for the current user.
 *
 * @param {string} userId
 * @param {Record<string, unknown>} [client]
 * @returns {Promise<{ notifications: Array<Record<string, unknown>>, error: string }>}
 */
export async function fetchNotificationsSnapshot(userId, client) {
  if (!userId) {
    return {
      notifications: [],
      error: "",
    };
  }

  const supabase = await resolveNotificationsClient(client);
  const response = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("is_read", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(100);

  return {
    notifications: filterVisibleNotifications(response.data || []),
    error: response.error ? NOTIFICATIONS_LOAD_ERROR : "",
  };
}

/**
 * Marks a single notification as read for the current user.
 *
 * @param {{ userId: string, notificationId: string }} params
 * @param {Record<string, unknown>} [client]
 * @returns {Promise<string>}
 */
export async function markNotificationAsRead({ userId, notificationId }, client) {
  const supabase = await resolveNotificationsClient(client);
  const response = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId)
    .eq("user_id", userId)
    .eq("is_read", false);

  return response.error ? NOTIFICATION_MARK_ERROR : "";
}

/**
 * Marks all unread notifications as read for the current user.
 *
 * @param {{ userId: string, notificationIds: string[] }} params
 * @param {Record<string, unknown>} [client]
 * @returns {Promise<string>}
 */
export async function markAllNotificationsAsRead({ userId, notificationIds }, client) {
  if (!notificationIds.length) {
    return "";
  }

  const supabase = await resolveNotificationsClient(client);
  const response = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", userId)
    .in("id", notificationIds);

  return response.error ? NOTIFICATIONS_MARK_ALL_ERROR : "";
}

/**
 * Subscribes to realtime notification changes for the current user.
 *
 * @param {string} userId
 * @param {() => void} onChange
 * @param {Record<string, unknown>} [client]
 * @returns {() => void}
 */
export function subscribeToNotifications(userId, onChange, client) {
  if (!userId) {
    return () => {};
  }

  let active = true;
  let unsubscribe = () => {};

  /**
   * Attaches the realtime notification subscription lazily.
   *
   * @returns {Promise<void>}
   */
  async function attachSubscription() {
    const supabase = await resolveNotificationsClient(client);

    if (!active) {
      return;
    }

    const channel = supabase
      .channel(`dashboard-notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        onChange
      )
      .subscribe();

    unsubscribe = () => {
      supabase.removeChannel(channel);
    };
  }

  void attachSubscription();

  return () => {
    active = false;
    unsubscribe();
  };
}
