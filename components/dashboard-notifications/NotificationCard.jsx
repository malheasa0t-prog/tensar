import Link from 'next/link';
import {
  formatNotificationDateTime,
  getNotificationLink,
  NOTIFICATION_TYPE_META,
} from '@/lib/dashboardNotificationsModel';

/**
 * Renders a single notification row with context actions.
 *
 * @param {{
 *   notification: Record<string, unknown>,
 *   busy: boolean,
 *   onMarkAsRead: (notificationId: string) => void,
 * }} props
 * @returns {JSX.Element}
 */
export default function NotificationCard({ notification, busy, onMarkAsRead }) {
  const meta = NOTIFICATION_TYPE_META[notification.type] || NOTIFICATION_TYPE_META.info;
  const targetLink = getNotificationLink(notification);

  return (
    <div
      style={{
        background: notification.is_read ? 'var(--card-bg)' : 'rgba(16,185,129,0.09)',
        border: notification.is_read
          ? '1px solid var(--border-color)'
          : '1px solid rgba(16,185,129,0.26)',
        borderRadius: '18px',
        padding: '18px 20px',
        display: 'grid',
        gap: '12px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '14px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'grid', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '999px',
                background: `${meta.color}18`,
                color: meta.color,
                fontSize: '0.82rem',
                fontWeight: '700',
              }}
            >
              <span>{meta.icon}</span>
              <span>{meta.label}</span>
            </span>

            {!notification.is_read ? (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '5px 10px',
                  borderRadius: '999px',
                  background: 'rgba(16,185,129,0.16)',
                  color: 'var(--primary)',
                  fontSize: '0.78rem',
                  fontWeight: '800',
                }}
              >
                جديد
              </span>
            ) : null}
          </div>

          <div>
            <h4 style={{ fontSize: '1rem', marginBottom: '6px' }}>{notification.title}</h4>
            <p style={{ margin: 0, color: 'var(--text-muted)' }}>
              {notification.body || 'لا يوجد نص إضافي.'}
            </p>
          </div>
        </div>

        <div style={{ textAlign: 'left', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
          {formatNotificationDateTime(notification.created_at)}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        {!notification.is_read ? (
          <button
            type="button"
            onClick={() => onMarkAsRead(notification.id)}
            className="btn btn-outline btn-sm"
            disabled={busy}
          >
            {busy ? '⏳ جاري التحديث...' : 'تعليم كمقروء'}
          </button>
        ) : null}

        {targetLink ? (
          <Link href={targetLink} className="btn btn-outline btn-sm">
            فتح الصفحة المرتبطة
          </Link>
        ) : null}
      </div>
    </div>
  );
}
