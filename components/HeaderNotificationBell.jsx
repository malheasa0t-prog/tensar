'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import AppIcon from '@/components/AppIcon';
import HeaderNotificationBellItem from '@/components/HeaderNotificationBellItem';
import {
  getHeaderNotificationHref,
  getHeaderNotificationsPreview,
  getHeaderNotificationTitle,
  getUnreadNotificationsLabel,
  hasUnreadNotificationsChanged,
} from '@/lib/headerNotificationsModel';

/**
 * Header bell that opens a quick notifications modal.
 *
 * @param {{
 *   authLoading: boolean,
 *   user: { id?: string | null } | null,
 * }} props
 * @returns {JSX.Element}
 */
export default function HeaderNotificationBell({ authLoading, user }) {
  const [busyIds, setBusyIds] = useState({});
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [shouldRing, setShouldRing] = useState(false);
  const previousUnreadRef = useRef(0);

  const isAuthenticated = Boolean(user?.id);
  const unreadCount = notifications.filter((item) => !item.is_read).length;
  const previewNotifications = getHeaderNotificationsPreview(notifications);
  const title = getHeaderNotificationTitle({
    authLoading,
    isAuthenticated,
    unreadCount,
  });

  /**
   * Loads the current notification snapshot for the active user.
   *
   * @param {{ silent?: boolean }} [options]
   * @returns {Promise<void>}
   */
  async function loadNotifications(options = {}) {
    if (!user?.id) {
      setNotifications([]);
      setError('');
      setLoading(false);
      return;
    }

    if (!options.silent) {
      setLoading(true);
    }

    const { fetchNotificationsSnapshot } = await import('@/services/dashboardNotificationsService');
    const snapshot = await fetchNotificationsSnapshot(user.id);
    setNotifications(snapshot.notifications);
    setError(snapshot.error);
    setLoading(false);
  }

  useEffect(() => {
    if (!user?.id) {
      setNotifications([]);
      setError('');
      setIsOpen(false);
      setLoading(false);
      previousUnreadRef.current = 0;
      return undefined;
    }

    let unsubscribe = () => {};

    /**
     * Attaches the notifications subscription after the user is authenticated.
     *
     * @returns {Promise<void>}
     */
    async function subscribeToUserNotifications() {
      const { subscribeToNotifications } = await import('@/services/dashboardNotificationsService');

      if (!user?.id) {
        return;
      }

      unsubscribe = subscribeToNotifications(user.id, () => {
        void loadNotifications({ silent: true });
      });
    }

    void loadNotifications();
    void subscribeToUserNotifications();

    return () => {
      unsubscribe();
    };
  }, [user?.id]);

  useEffect(() => {
    if (hasUnreadNotificationsChanged(previousUnreadRef.current, unreadCount)) {
      setShouldRing(true);
      const timeoutId = window.setTimeout(() => setShouldRing(false), 900);
      previousUnreadRef.current = unreadCount;
      return () => window.clearTimeout(timeoutId);
    }

    previousUnreadRef.current = unreadCount;
    return undefined;
  }, [unreadCount]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    /**
     * Closes the modal with the Escape key.
     *
     * @param {KeyboardEvent} event
     * @returns {void}
     */
    function handleEscape(event) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    /**
     * Closes the quick modal when a global close request is dispatched.
     *
     * @returns {void}
     */
    function handleCloseRequest() {
      setIsOpen(false);
    }

    window.addEventListener('tz-close-overlays', handleCloseRequest);
    return () => window.removeEventListener('tz-close-overlays', handleCloseRequest);
  }, []);

  /**
   * Marks a single notification as read and syncs local state.
   *
   * @param {string} notificationId
   * @returns {Promise<void>}
   */
  async function handleMarkAsRead(notificationId) {
    if (!user?.id) {
      return;
    }

    setBusyIds((previousState) => ({ ...previousState, [notificationId]: true }));
    const { markNotificationAsRead } = await import('@/services/dashboardNotificationsService');
    const updateError = await markNotificationAsRead({ notificationId, userId: user.id });

    setBusyIds((previousState) => {
      const nextState = { ...previousState };
      delete nextState[notificationId];
      return nextState;
    });

    if (updateError) {
      setError(updateError);
      return;
    }

    setNotifications((previousState) =>
      previousState.map((item) => (item.id === notificationId ? { ...item, is_read: true } : item))
    );
    window.dispatchEvent(new CustomEvent('tz-notifications-updated'));
  }

  /**
   * Marks every unread notification as read from the quick modal.
   *
   * @returns {Promise<void>}
   */
  async function handleMarkAllAsRead() {
    if (!user?.id || unreadCount === 0) {
      return;
    }

    setBulkActionLoading(true);
    const unreadIds = notifications.filter((item) => !item.is_read).map((item) => item.id);
    const { markAllNotificationsAsRead } = await import('@/services/dashboardNotificationsService');
    const updateError = await markAllNotificationsAsRead({ notificationIds: unreadIds, userId: user.id });
    setBulkActionLoading(false);

    if (updateError) {
      setError(updateError);
      return;
    }

    setNotifications((previousState) => previousState.map((item) => ({ ...item, is_read: true })));
    window.dispatchEvent(new CustomEvent('tz-notifications-updated'));
  }

  if (!isAuthenticated) {
    return (
      <Link
        href={getHeaderNotificationHref(false)}
        className="nav-icon-btn nav-notification-btn"
        aria-label="تسجيل الدخول لعرض الإشعارات"
        title={title}
      >
        <AppIcon name="bell" size={18} />
      </Link>
    );
  }

  return (
    <>
      <button
        type="button"
        className={`nav-icon-btn nav-notification-btn${unreadCount > 0 ? ' has-unread' : ''}${isOpen ? ' is-open' : ''}${shouldRing ? ' bell-notify' : ''}`}
        aria-label="فتح الإشعارات"
        title={title}
        onClick={() => setIsOpen((previousState) => !previousState)}
        disabled={authLoading}
      >
        <AppIcon name="bell" size={18} />
        {unreadCount > 0 ? (
          <span className="cart-badge is-bouncing">{unreadCount > 99 ? '99+' : unreadCount}</span>
        ) : null}
      </button>

      {isOpen ? (
        <div className="header-notifications-overlay" onClick={() => setIsOpen(false)}>
          <div
            className="header-notifications-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="header-notifications-title"
          >
            <div className="header-notifications-header">
              <div>
                <h3 id="header-notifications-title">الإشعارات</h3>
                <p>{getUnreadNotificationsLabel(unreadCount)}</p>
              </div>

              <button
                type="button"
                className="header-notifications-close"
                onClick={() => setIsOpen(false)}
                aria-label="إغلاق الإشعارات"
              >
                ×
              </button>
            </div>

            {error ? <div className="header-notifications-alert">{error}</div> : null}

            <div className="header-notifications-toolbar">
              <span className="header-notifications-count">{notifications.length} إشعار</span>

              <div className="header-notifications-actions">
                <button
                  type="button"
                  className="header-notification-mark"
                  onClick={() => void handleMarkAllAsRead()}
                  disabled={bulkActionLoading || unreadCount === 0}
                >
                  {bulkActionLoading ? 'جارٍ...' : 'تعليم الكل'}
                </button>

                <Link
                  href="/dashboard/notifications"
                  className="header-notification-link"
                  onClick={() => setIsOpen(false)}
                >
                  عرض الكل
                </Link>
              </div>
            </div>

            <div className="header-notifications-list">
              {loading ? (
                <div className="header-notifications-empty">جارٍ تحميل الإشعارات...</div>
              ) : previewNotifications.length > 0 ? (
                previewNotifications.map((notification) => (
                  <HeaderNotificationBellItem
                    key={notification.id}
                    busy={Boolean(busyIds[notification.id])}
                    notification={notification}
                    onClose={() => setIsOpen(false)}
                    onMarkAsRead={handleMarkAsRead}
                  />
                ))
              ) : (
                <div className="header-notifications-empty">لا توجد إشعارات حالياً.</div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
