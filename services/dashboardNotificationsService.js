import { supabase } from '@/lib/supabaseClient';

/**
 * Returns the current authenticated user id for the notifications dashboard.
 *
 * @returns {Promise<string>}
 */
export async function getNotificationsUserId() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user?.id || '';
}

/**
 * Loads the latest notifications for the current user.
 *
 * @param {string} userId
 * @returns {Promise<{ notifications: Array<Record<string, unknown>>, error: string }>}
 */
export async function fetchNotificationsSnapshot(userId) {
  if (!userId) {
    return {
      notifications: [],
      error: '',
    };
  }

  const response = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('is_read', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(100);

  return {
    notifications: response.data || [],
    error: response.error ? 'تعذر تحميل الإشعارات حالياً' : '',
  };
}

/**
 * Marks a single notification as read for the current user.
 *
 * @param {{ userId: string, notificationId: string }} params
 * @returns {Promise<string>}
 */
export async function markNotificationAsRead({ userId, notificationId }) {
  const response = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .eq('user_id', userId)
    .eq('is_read', false);

  return response.error ? 'تعذر تحديث الإشعار' : '';
}

/**
 * Marks all unread notifications as read for the current user.
 *
 * @param {{ userId: string, notificationIds: string[] }} params
 * @returns {Promise<string>}
 */
export async function markAllNotificationsAsRead({ userId, notificationIds }) {
  if (!notificationIds.length) {
    return '';
  }

  const response = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .in('id', notificationIds);

  return response.error ? 'تعذر تعليم جميع الإشعارات كمقروءة' : '';
}
