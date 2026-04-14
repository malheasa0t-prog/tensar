'use client';

import Link from 'next/link';
import AppIcon from '@/components/AppIcon';
import { getNotificationLink } from '@/lib/dashboardNotificationsModel';
import {
  formatRelativeNotificationTime,
  getHeaderNotificationVisualMeta,
} from '@/lib/headerNotificationsModel';

/**
 * Compact notification item displayed inside the header modal.
 *
 * @param {{
 *   busy: boolean,
 *   notification: Record<string, unknown>,
 *   onClose: () => void,
 *   onMarkAsRead: (notificationId: string) => Promise<void>,
 * }} props
 * @returns {JSX.Element}
 */
export default function HeaderNotificationBellItem({
  busy,
  notification,
  onClose,
  onMarkAsRead,
}) {
  const meta = getHeaderNotificationVisualMeta(notification);
  const targetLink = getNotificationLink(notification);

  return (
    <div className={`header-notification-item${notification.is_read ? '' : ' is-unread'}`}>
      <div className="header-notification-meta">
        <span
          className="header-notification-type"
          style={{ color: meta.color, background: `${meta.color}16` }}
        >
          <AppIcon name={meta.icon} size={14} />
          <span>{meta.label}</span>
        </span>
        <span className="header-notification-time">
          {formatRelativeNotificationTime(notification.created_at)}
        </span>
      </div>

      <div className="header-notification-copy">
        <strong>{notification.title}</strong>
        <p>{notification.body || 'لا يوجد نص إضافي.'}</p>
      </div>

      <div className="header-notification-row-actions">
        {targetLink ? (
          <Link
            href={targetLink}
            className="header-notification-link"
            onClick={() => {
              if (!notification.is_read) {
                void onMarkAsRead(notification.id);
              }
              onClose();
            }}
          >
            <AppIcon name="arrow-left" size={14} />
            <span>فتح</span>
          </Link>
        ) : (
          <span className="header-notification-link is-muted">بدون صفحة مرتبطة</span>
        )}

        {!notification.is_read ? (
          <button
            type="button"
            className="header-notification-mark"
            onClick={() => void onMarkAsRead(notification.id)}
            disabled={busy}
          >
            {busy ? 'جارٍ...' : 'تمت القراءة'}
          </button>
        ) : (
          <span className="header-notification-state">تمت قراءته</span>
        )}
      </div>
    </div>
  );
}
