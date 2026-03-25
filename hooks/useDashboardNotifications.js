'use client';

import { useEffect, useState } from 'react';
import { buildNotificationsStats } from '@/lib/dashboardNotificationsModel';
import {
  fetchNotificationsSnapshot,
  getNotificationsUserId,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from '@/services/dashboardNotificationsService';

/**
 * Manages loading, polling, filtering, and mutating dashboard notifications.
 *
 * @returns {{
 *   loading: boolean,
 *   error: string,
 *   refreshing: boolean,
 *   bulkActionLoading: boolean,
 *   showUnreadOnly: boolean,
 *   notifications: Array<Record<string, unknown>>,
 *   visibleNotifications: Array<Record<string, unknown>>,
 *   busyIds: Record<string, boolean>,
 *   stats: { total: number, unread: number, adminBroadcasts: number },
 *   setShowUnreadOnly: (value: boolean) => void,
 *   refreshNotifications: () => Promise<void>,
 *   markAsRead: (notificationId: string) => Promise<void>,
 *   markAllAsRead: () => Promise<void>,
 * }}
 */
export function useDashboardNotifications() {
  const [userId, setUserId] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [busyIds, setBusyIds] = useState({});

  /**
   * Loads notifications for the active user with optional silent refresh.
   *
   * @param {{ currentUserId?: string, silent?: boolean }} [options]
   * @returns {Promise<void>}
   */
  async function loadNotifications(options = {}) {
    const { currentUserId = userId, silent = false } = options;

    if (!currentUserId) {
      setLoading(false);
      return;
    }

    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    const snapshot = await fetchNotificationsSnapshot(currentUserId);

    setNotifications(snapshot.notifications);
    setError(snapshot.error);

    if (silent) {
      setRefreshing(false);
    } else {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    let intervalId = null;

    /**
     * Bootstraps the notification dashboard and starts polling.
     *
     * @returns {Promise<void>}
     */
    async function initNotifications() {
      const currentUserId = await getNotificationsUserId();

      if (!active) {
        return;
      }

      if (!currentUserId) {
        setLoading(false);
        return;
      }

      setUserId(currentUserId);
      await loadNotifications({ currentUserId });

      if (!active) {
        return;
      }

      intervalId = window.setInterval(() => {
        loadNotifications({ currentUserId, silent: true });
      }, 20000);
    }

    initNotifications();

    return () => {
      active = false;
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, []);

  /**
   * Marks a single notification as read and updates the local list.
   *
   * @param {string} notificationId
   * @returns {Promise<void>}
   */
  async function markAsRead(notificationId) {
    if (!userId) {
      return;
    }

    setBusyIds((prev) => ({ ...prev, [notificationId]: true }));

    const updateError = await markNotificationAsRead({ userId, notificationId });

    setBusyIds((prev) => {
      const next = { ...prev };
      delete next[notificationId];
      return next;
    });

    if (updateError) {
      setError(updateError);
      return;
    }

    setNotifications((prev) =>
      prev.map((item) => (item.id === notificationId ? { ...item, is_read: true } : item))
    );
    window.dispatchEvent(new CustomEvent('tz-notifications-updated'));
  }

  /**
   * Marks every unread notification as read in a single mutation.
   *
   * @returns {Promise<void>}
   */
  async function markAllAsRead() {
    if (!userId) {
      return;
    }

    const unreadIds = notifications.filter((item) => !item.is_read).map((item) => item.id);
    if (!unreadIds.length) {
      return;
    }

    setBulkActionLoading(true);

    const updateError = await markAllNotificationsAsRead({
      userId,
      notificationIds: unreadIds,
    });

    setBulkActionLoading(false);

    if (updateError) {
      setError(updateError);
      return;
    }

    setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })));
    window.dispatchEvent(new CustomEvent('tz-notifications-updated'));
  }

  const stats = buildNotificationsStats(notifications);
  const visibleNotifications = showUnreadOnly
    ? notifications.filter((item) => !item.is_read)
    : notifications;

  return {
    loading,
    error,
    refreshing,
    bulkActionLoading,
    showUnreadOnly,
    notifications,
    visibleNotifications,
    busyIds,
    stats,
    setShowUnreadOnly,
    refreshNotifications: () => loadNotifications({ silent: true }),
    markAsRead,
    markAllAsRead,
  };
}
